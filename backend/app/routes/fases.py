from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.files.storage import eliminar_comprobante
from app.schemas import FaseCreate, FaseOut, FaseReordenar, FaseUpdate

router = APIRouter(prefix="/fases", tags=["fases"])


@router.get("/", response_model=list[FaseOut], status_code=status.HTTP_200_OK)
def get_all_fases(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    return db.query(models.Fase).order_by(models.Fase.proyecto_id, models.Fase.orden).all()


@router.get("/{fase_id}", response_model=FaseOut, status_code=status.HTTP_200_OK)
def get_fase_by_id(
    fase_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")
    return fase


@router.get("/proyectos/{proyecto_id}/fases", response_model=list[FaseOut], status_code=status.HTTP_200_OK)
def get_fases_by_proyecto(
    proyecto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return (
        db.query(models.Fase).filter(models.Fase.proyecto_id == proyecto_id).order_by(models.Fase.orden).all()
    )


@router.post("/crear", response_model=FaseOut, status_code=status.HTTP_201_CREATED)
def create_fase(
    fase: FaseCreate, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == fase.proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # El número de fase (1, 2, 3...) lo asigna el backend: es "siguiente
    # libre para este proyecto", no se puede elegir al crear. Ver
    # FaseReordenar/mover_fase para cambiar el orden después.
    orden_maximo = (
        db.query(func.max(models.Fase.orden)).filter(models.Fase.proyecto_id == fase.proyecto_id).scalar()
    )
    siguiente_orden = (orden_maximo or 0) + 1

    nueva_fase = models.Fase(
        proyecto_id=fase.proyecto_id,
        nombre=fase.nombre,
        descripcion=fase.descripcion,
        estado=fase.estado,
        orden=siguiente_orden,
        fecha_en_curso_desde=datetime.now(timezone.utc) if fase.estado == "en_curso" else None,
    )

    try:
        db.add(nueva_fase)
        db.commit()
        db.refresh(nueva_fase)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear la fase: datos inválidos")

    return nueva_fase


@router.patch("/{fase_id}/mover", response_model=list[FaseOut], status_code=status.HTTP_200_OK)
def mover_fase(
    fase_id: str,
    payload: FaseReordenar,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    """Intercambia el número de esta fase con el de su vecina (anterior o
    siguiente) dentro del mismo proyecto. Devuelve las fases del proyecto
    ya reordenadas para que el front pueda refrescar la tabla entera."""
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    fases_proyecto = (
        db.query(models.Fase)
        .filter(models.Fase.proyecto_id == fase.proyecto_id)
        .order_by(models.Fase.orden)
        .all()
    )
    indice = next(i for i, f in enumerate(fases_proyecto) if f.id == fase.id)

    if payload.direccion == "arriba":
        if indice == 0:
            raise HTTPException(status_code=400, detail="La fase ya es la primera")
        vecina = fases_proyecto[indice - 1]
    else:
        if indice == len(fases_proyecto) - 1:
            raise HTTPException(status_code=400, detail="La fase ya es la última")
        vecina = fases_proyecto[indice + 1]

    fase.orden, vecina.orden = vecina.orden, fase.orden
    db.commit()

    return (
        db.query(models.Fase)
        .filter(models.Fase.proyecto_id == fase.proyecto_id)
        .order_by(models.Fase.orden)
        .all()
    )


@router.put("/{fase_id}", response_model=FaseOut, status_code=status.HTTP_200_OK)
def update_fase(
    fase_id: str,
    fase: FaseUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    fase_existente = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase_existente:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    estado_anterior = fase_existente.estado

    for key, value in fase.model_dump(exclude_unset=True).items():
        setattr(fase_existente, key, value)

    # "Días en curso" se cuenta desde que la fase ENTRÓ en curso, no desde
    # la última edición cualquiera -- fecha_actualizacion se pisa con
    # cualquier cambio (nombre, descripción...), así que usarla para esto
    # hacía aparecer "en curso hace 0 días" apenas se tocaba algo de una
    # fase que ya estaba en curso hace rato.
    if fase_existente.estado == "en_curso" and estado_anterior != "en_curso":
        fase_existente.fecha_en_curso_desde = datetime.now(timezone.utc)
    elif fase_existente.estado != "en_curso" and estado_anterior == "en_curso":
        fase_existente.fecha_en_curso_desde = None

    try:
        db.commit()
        db.refresh(fase_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar la fase: datos inválidos")

    return fase_existente


@router.delete("/{fase_id}", response_model=FaseOut, status_code=status.HTTP_200_OK)
def delete_fase(
    fase_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    fase_data = FaseOut.model_validate(fase)
    proyecto_id = fase.proyecto_id

    # CASCADE se lleva las Compras de esta Fase (con sus detalle/impuestos/comprobantes en DB),
    # pero NO borra los archivos físicos de los comprobantes -> hay que limpiarlos a mano antes.
    for compra in fase.compras:
        for comprobante in compra.comprobantes:
            eliminar_comprobante(comprobante.archivo_path)

    db.delete(fase)
    db.commit()

    # Si se borró una fase del medio (ej. la 2 de 4), las que quedan no
    # pueden dejar un hueco en la numeración -> se reacomodan a 1..N.
    restantes = (
        db.query(models.Fase).filter(models.Fase.proyecto_id == proyecto_id).order_by(models.Fase.orden).all()
    )
    for i, f in enumerate(restantes, start=1):
        if f.orden != i:
            f.orden = i
    db.commit()

    return fase_data
