from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.audit import log_auditoria
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.estados_obra import activar_por_movimiento
from app.files.storage import eliminar_comprobante, subir_comprobante, ver_comprobante
from app.limiter import limiter
from app.pagination import ParametrosPaginacion
from app.schemas import ComprobanteGastoOut, GastoCreate, GastoOut, GastoUpdate
from app.tipo_cambio import a_usd

router = APIRouter(prefix="/gastos", tags=["gastos"])


@router.get("/", response_model=list[GastoOut], status_code=status.HTTP_200_OK)
def get_all_gastos(
    paginacion: ParametrosPaginacion = Depends(),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    query = (
        db.query(models.Gasto)
        .options(joinedload(models.Gasto.categorias))
        .order_by(models.Gasto.fecha_creacion.desc())
        .offset(paginacion.offset)
    )
    if paginacion.limit is not None:
        query = query.limit(paginacion.limit)
    return query.all()


@router.get("/{gasto_id}", response_model=GastoOut, status_code=status.HTTP_200_OK)
def get_gasto_by_id(
    gasto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    gasto = (
        db.query(models.Gasto)
        .options(joinedload(models.Gasto.categorias))
        .filter(models.Gasto.id == gasto_id)
        .first()
    )
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return gasto


@router.get("/proyectos/{proyecto_id}/gastos", response_model=list[GastoOut], status_code=status.HTTP_200_OK)
def get_gastos_by_proyecto(
    proyecto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return (
        db.query(models.Gasto)
        .options(joinedload(models.Gasto.categorias))
        .filter(models.Gasto.proyecto_id == proyecto_id)
        .all()
    )


@router.get("/fases/{fase_id}/gastos", response_model=list[GastoOut], status_code=status.HTTP_200_OK)
def get_gastos_by_fase(
    fase_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    return (
        db.query(models.Gasto)
        .options(joinedload(models.Gasto.categorias))
        .filter(models.Gasto.fase_id == fase_id)
        .all()
    )


@router.post("/crear", response_model=GastoOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
def create_gasto(
    request: Request,
    gasto: GastoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == gasto.proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    fase = None
    if gasto.fase_id:
        fase = db.query(models.Fase).filter(models.Fase.id == gasto.fase_id).first()
        if not fase:
            raise HTTPException(status_code=404, detail="Fase no encontrada")

    categorias = []
    if gasto.categoria_gasto_ids:
        categorias = (
            db.query(models.CategoriaGasto)
            .filter(models.CategoriaGasto.id.in_(gasto.categoria_gasto_ids))
            .all()
        )
        if len(categorias) != len(gasto.categoria_gasto_ids):
            raise HTTPException(status_code=404, detail="Una o más categorías de gasto no existen")

    nuevo_gasto = models.Gasto(
        proyecto_id=gasto.proyecto_id,
        fase_id=gasto.fase_id,
        usuario_id=current_user.id,  # del JWT, nunca del body
        monto_ars=gasto.monto_ars,
        # Congelado acá, siempre: el front no manda (ni puede pisar) el USD.
        monto_usd=a_usd(gasto.monto_ars, gasto.cotizacion_dolar),
        cotizacion_dolar=gasto.cotizacion_dolar,
        tipo_cambio=gasto.tipo_cambio,
        descripcion=gasto.descripcion,
        fecha=gasto.fecha,
        tipo_factura=gasto.tipo_factura,
        categorias=categorias,
    )

    activar_por_movimiento(db, fase=fase, proyecto=proyecto)

    try:
        db.add(nuevo_gasto)
        db.commit()
        db.refresh(nuevo_gasto)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el gasto: datos inválidos")

    log_auditoria(db, current_user.id, "create", "Gasto", nuevo_gasto.id)
    return nuevo_gasto


@router.put("/{gasto_id}", response_model=GastoOut, status_code=status.HTTP_200_OK)
def update_gasto(
    gasto_id: str,
    gasto: GastoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    gasto_existente = db.query(models.Gasto).filter(models.Gasto.id == gasto_id).first()
    if not gasto_existente:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    datos = gasto.model_dump(exclude_unset=True)

    if "fase_id" in datos and datos["fase_id"] is not None:
        fase = db.query(models.Fase).filter(models.Fase.id == datos["fase_id"]).first()
        if not fase:
            raise HTTPException(status_code=404, detail="Fase no encontrada")

    if "categoria_gasto_ids" in datos:
        ids = datos.pop("categoria_gasto_ids")
        categorias = db.query(models.CategoriaGasto).filter(models.CategoriaGasto.id.in_(ids)).all()
        if len(categorias) != len(ids):
            raise HTTPException(status_code=404, detail="Una o más categorías de gasto no existen")
        gasto_existente.categorias = categorias

    for key, value in datos.items():
        setattr(gasto_existente, key, value)

    # Si cambió el monto o la cotización, el USD congelado se recalcula con
    # los valores que quedaron (uno puede venir nuevo y el otro ser el de antes).
    if "monto_ars" in datos or "cotizacion_dolar" in datos:
        gasto_existente.monto_usd = a_usd(gasto_existente.monto_ars, gasto_existente.cotizacion_dolar)

    try:
        db.commit()
        db.refresh(gasto_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar el gasto: datos inválidos")

    log_auditoria(db, current_user.id, "update", "Gasto", gasto_existente.id)
    return gasto_existente


@router.delete("/{gasto_id}", response_model=GastoOut, status_code=status.HTTP_200_OK)
def delete_gasto(
    gasto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    gasto = db.query(models.Gasto).filter(models.Gasto.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    gasto_data = GastoOut.model_validate(gasto)

    for comprobante in gasto.comprobantes:
        eliminar_comprobante(comprobante.archivo_path)

    db.delete(gasto)
    db.commit()

    log_auditoria(db, current_user.id, "delete", "Gasto", gasto_data.id)
    return gasto_data


@router.post(
    "/{gasto_id}/comprobantes", response_model=ComprobanteGastoOut, status_code=status.HTTP_201_CREATED
)
@limiter.limit("20/minute")
def upload_comprobante_gasto(
    request: Request,
    gasto_id: str,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    gasto = db.query(models.Gasto).filter(models.Gasto.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    path = subir_comprobante(archivo, "comprobantes_gasto", gasto_id)

    nuevo_comprobante = models.ComprobanteGasto(gasto_id=gasto_id, archivo_path=path)
    db.add(nuevo_comprobante)
    db.commit()
    db.refresh(nuevo_comprobante)

    return nuevo_comprobante


@router.get("/{gasto_id}/comprobantes/{comprobante_id}")
def get_comprobante_gasto(
    gasto_id: str,
    comprobante_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    comprobante = (
        db.query(models.ComprobanteGasto)
        .filter(models.ComprobanteGasto.id == comprobante_id, models.ComprobanteGasto.gasto_id == gasto_id)
        .first()
    )
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    return ver_comprobante(comprobante.archivo_path)


@router.delete("/{gasto_id}/comprobantes/{comprobante_id}", status_code=status.HTTP_200_OK)
def delete_comprobante_gasto(
    gasto_id: str,
    comprobante_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    comprobante = (
        db.query(models.ComprobanteGasto)
        .filter(models.ComprobanteGasto.id == comprobante_id, models.ComprobanteGasto.gasto_id == gasto_id)
        .first()
    )
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    eliminar_comprobante(comprobante.archivo_path)
    db.delete(comprobante)
    db.commit()

    return {"detail": "Comprobante eliminado"}
