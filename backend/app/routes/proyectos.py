import re
import unicodedata
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.audit import log_auditoria
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.files.storage import eliminar_comprobante
from app.reportes.calculos import calcular_reporte_proyecto
from app.reportes.pdf_proyecto import generar_pdf_proyecto
from app.routes.cotizaciones import ultima_cotizacion
from app.schemas import ProyectoCreate, ProyectoOut, ProyectoUpdate

router = APIRouter(tags=["Proyectos"], prefix="/proyectos")

# Obtener todos los proyectos + proyectos por id de proyecto
# Obtener todos los proyectos = Para las cards de los proyectos
# Obtener proyectos por id de proyecto = Para la vista de detalles del proyecto


@router.get("/", response_model=list[ProyectoOut], status_code=status.HTTP_200_OK)
def get_all_projects(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    return db.query(models.Proyecto).all()


@router.get(
    "/{proyecto_id}", response_model=ProyectoOut, status_code=status.HTTP_200_OK
)  # ProyectoOut : la base del proyecto + id al final
def get_project_by_id(
    proyecto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return proyecto


# POST : Crear proyecto


@router.post("/crear", response_model=ProyectoOut, status_code=status.HTTP_201_CREATED)
def create_project(
    proyecto: ProyectoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):

    nuevo_proyecto = models.Proyecto(
        nombre=proyecto.nombre,
        direccion=proyecto.direccion,
        fecha_inicio=proyecto.fecha_inicio,
        estado=proyecto.estado,
        precio_acordado_usd=proyecto.precio_acordado_usd,
        cotizacion_acordada=proyecto.cotizacion_acordada,
        tipo_cambio_acordado=proyecto.tipo_cambio_acordado,
    )
    try:
        db.add(nuevo_proyecto)
        db.commit()
        db.refresh(nuevo_proyecto)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el proyecto: datos inválidos")

    log_auditoria(db, current_user.id, "create", "Proyecto", nuevo_proyecto.id)
    return nuevo_proyecto


# DELETE : Eliminar un proyecto por id de proyecto


@router.delete("/{proyecto_id}", response_model=ProyectoOut, status_code=status.HTTP_200_OK)
def delete_project(
    proyecto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    proyecto_data = ProyectoOut.model_validate(proyecto)

    # Limpiar archivos físicos de todo el árbol antes del CASCADE
    for fase in proyecto.fases:
        for compra in fase.compras:
            for comprobante in compra.comprobantes:
                eliminar_comprobante(comprobante.archivo_path)
    for gasto in proyecto.gastos:
        for comprobante in gasto.comprobantes:
            eliminar_comprobante(comprobante.archivo_path)
    for cobro in proyecto.cobros:
        for comprobante in cobro.comprobantes:
            eliminar_comprobante(comprobante.archivo_path)

    db.delete(proyecto)
    db.commit()

    log_auditoria(db, current_user.id, "delete", "Proyecto", proyecto_data.id)
    return proyecto_data


# PUT : Actualizar un proyecto por id de proyecto


@router.put("/{proyecto_id}", response_model=ProyectoOut, status_code=status.HTTP_200_OK)
def update_project(
    proyecto_id: str,
    proyecto: ProyectoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    proyecto_existente = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto_existente:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    for key, value in proyecto.model_dump(exclude_unset=True).items():
        setattr(proyecto_existente, key, value)

    try:
        db.commit()
        db.refresh(proyecto_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar el proyecto: datos inválidos")

    log_auditoria(db, current_user.id, "update", "Proyecto", proyecto_existente.id)
    return proyecto_existente


# GET : Reporte PDF del proyecto (resumen financiero, cascada de rentabilidad,
# notas de crédito/débito, estado de fases, deuda a proveedores). Uso interno,
# on-demand -- ver app/reportes/.


@router.get("/{proyecto_id}/reporte-pdf", status_code=status.HTTP_200_OK)
def get_reporte_pdf_proyecto(
    proyecto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    fases = db.query(models.Fase).filter(models.Fase.proyecto_id == proyecto_id).all()

    gastos = (
        db.query(models.Gasto)
        .options(joinedload(models.Gasto.categorias))
        .filter(models.Gasto.proyecto_id == proyecto_id)
        .all()
    )

    cobros = (
        db.query(models.Cobro)
        .options(joinedload(models.Cobro.notas))
        .filter(models.Cobro.proyecto_id == proyecto_id)
        .all()
    )

    compras = (
        db.query(models.Compra)
        .join(models.Fase)
        .options(
            joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
            joinedload(models.Compra.notas),
            joinedload(models.Compra.proveedor),
        )
        .filter(models.Fase.proyecto_id == proyecto_id)
        .all()
    )

    # El precio acordado en pesos es lo único sin cifra congelada: se pasa
    # con la última cotización cargada (decisión #8). Del mismo tipo de
    # dólar con que se acordó el proyecto si se registró y hay alguna; si
    # no, la última de cualquier tipo -- mismo criterio que usa el front.
    cotizacion = ultima_cotizacion(db, proyecto.tipo_cambio_acordado) or ultima_cotizacion(db)
    reporte = calcular_reporte_proyecto(
        proyecto, fases, gastos, cobros, compras, float(cotizacion.valor) if cotizacion else None
    )
    pdf_bytes = generar_pdf_proyecto(proyecto, fases, gastos, cobros, compras, reporte, cotizacion)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": _content_disposition(f"reporte-{proyecto.nombre}.pdf")},
    )


def _content_disposition(nombre_archivo: str) -> str:
    """
    Los headers HTTP viajan en latin-1: un nombre de obra con "—" (el guion
    largo que mete el autocorrector del celu), "€" o un emoji tiraba un 500
    al armar la respuesta, y unas comillas en el nombre cortaban el header.
    Va en las dos formas del RFC 6266: filename= en ASCII pelado para
    clientes viejos, y filename*= en UTF-8 con el nombre real, que es el que
    usan los browsers.
    """
    nombre = re.sub(r"[\s/\\]+", "-", nombre_archivo)
    ascii_plano = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode("ascii")
    ascii_plano = re.sub(r"[^A-Za-z0-9._-]", "", ascii_plano) or "reporte.pdf"
    return f"attachment; filename=\"{ascii_plano}\"; filename*=UTF-8''{quote(nombre, safe='')}"
