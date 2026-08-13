from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.exc import IntegrityError
from app.db.db import get_db
from app.db import models
from app.schemas import ProyectoCreate, ProyectoUpdate, ProyectoOut
from app.audit import log_auditoria
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.files.storage import eliminar_comprobante
from app.reportes.calculos import calcular_analisis_proyecto
from app.reportes.pdf_proyecto import generar_pdf_proyecto


router = APIRouter (
    tags=["Proyectos"],
    prefix="/proyectos"
)

# Obtener todos los proyectos + proyectos por id de proyecto
# Obtener todos los proyectos = Para las cards de los proyectos
# Obtener proyectos por id de proyecto = Para la vista de detalles del proyecto

@router.get("/", response_model=list[ProyectoOut],status_code=status.HTTP_200_OK)
def get_all_projects(db: Session = Depends(get_db),
                     current_user: models.Usuario = Depends(get_current_user)):
    return db.query(models.Proyecto).all()

@router.get("/{proyecto_id}", response_model=ProyectoOut, status_code=status.HTTP_200_OK) # ProyectoOut : la base del proyecto + id al final
def get_project_by_id(proyecto_id: str,
                      db: Session = Depends(get_db),
                      current_user: models.Usuario = Depends(get_current_user)):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")
    return proyecto

# POST : Crear proyecto

@router.post("/crear", response_model=ProyectoOut, status_code=status.HTTP_201_CREATED)
def create_project(proyecto: ProyectoCreate,
                   db: Session = Depends(get_db),
                   current_user: models.Usuario = Depends(requiere_admin)):
    

    
    nuevo_proyecto = models.Proyecto(
        nombre=proyecto.nombre,
        direccion=proyecto.direccion,
        fecha_inicio=proyecto.fecha_inicio,
        estado=proyecto.estado,
        precio_acordado=proyecto.precio_acordado
    )
    try:
        db.add(nuevo_proyecto)
        db.commit()
        db.refresh(nuevo_proyecto)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el proyecto: datos inválidos")

    log_auditoria(current_user.id, "create", "Proyecto", nuevo_proyecto.id)
    return nuevo_proyecto

# DELETE : Eliminar un proyecto por id de proyecto

@router.delete("/{proyecto_id}", response_model=ProyectoOut, status_code=status.HTTP_200_OK)
def delete_project(proyecto_id: str,
                   db: Session = Depends(get_db),
                   current_user: models.Usuario = Depends(requiere_admin)):
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

    log_auditoria(current_user.id, "delete", "Proyecto", proyecto_data.id)
    return proyecto_data

# PUT : Actualizar un proyecto por id de proyecto

@router.put("/{proyecto_id}", response_model=ProyectoOut, status_code=status.HTTP_200_OK)
def update_project(proyecto_id: str,
                   proyecto: ProyectoUpdate,
                   db: Session = Depends(get_db),
                   current_user: models.Usuario = Depends(requiere_admin)):
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

    log_auditoria(current_user.id, "update", "Proyecto", proyecto_existente.id)
    return proyecto_existente


# GET : Reporte PDF del proyecto (resumen financiero, cascada de rentabilidad,
# notas de crédito/débito, estado de fases, deuda a proveedores). Uso interno,
# on-demand -- ver app/reportes/.

@router.get("/{proyecto_id}/reporte-pdf", status_code=status.HTTP_200_OK)
def get_reporte_pdf_proyecto(proyecto_id: str,
                              db: Session = Depends(get_db),
                              current_user: models.Usuario = Depends(requiere_admin)):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    fases = db.query(models.Fase).filter(models.Fase.proyecto_id == proyecto_id).all()

    gastos = db.query(models.Gasto).options(
        joinedload(models.Gasto.categorias)
    ).filter(models.Gasto.proyecto_id == proyecto_id).all()

    cobros = db.query(models.Cobro).options(
        joinedload(models.Cobro.notas)
    ).filter(models.Cobro.proyecto_id == proyecto_id).all()

    compras = db.query(models.Compra).join(models.Fase).options(
        joinedload(models.Compra.impuestos_aplicados),
        joinedload(models.Compra.notas),
        joinedload(models.Compra.proveedor),
    ).filter(models.Fase.proyecto_id == proyecto_id).all()

    analisis = calcular_analisis_proyecto(proyecto, fases, gastos, cobros, compras)
    pdf_bytes = generar_pdf_proyecto(proyecto, fases, gastos, cobros, compras, analisis)

    nombre_archivo = f"reporte-{proyecto.nombre}.pdf".replace(" ", "-").replace("/", "-")
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre_archivo}"'},
    )