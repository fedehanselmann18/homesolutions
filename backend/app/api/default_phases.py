"""
Nombres predeterminados de fase: las opciones del select del modal de fase
(ver models.DefaultPhase). Se administran desde Ajustes.

GET    /fases-predeterminadas/        -> en orden (1, 2, 3...)
POST   /fases-predeterminadas/crear   -> requiere_admin, va al final
PUT    /fases-predeterminadas/{id}    -> requiere_admin
DELETE /fases-predeterminadas/{id}    -> requiere_admin

Borrar o renombrar una no toca las fases ya creadas: la fase guarda el
nombre como texto, no una referencia a esta tabla.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oauth2 import get_current_user, requiere_admin
from app.db import models
from app.db.database import get_db
from app.db.errors import es_violacion_unicidad
from app.schemas import DefaultPhaseCreate, DefaultPhaseOut, DefaultPhaseUpdate

router = APIRouter(prefix="/fases-predeterminadas", tags=["fases_predeterminadas"])

NOMBRE_REPETIDO = "Ya existe una fase predeterminada con ese nombre"
NO_ENCONTRADA = "Fase predeterminada no encontrada"


def _buscar(db: Session, fase_id: str) -> models.DefaultPhase:
    fase = db.query(models.DefaultPhase).filter(models.DefaultPhase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail=NO_ENCONTRADA)
    return fase


@router.get("/", response_model=list[DefaultPhaseOut], status_code=status.HTTP_200_OK)
def get_fases_predeterminadas(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    return db.query(models.DefaultPhase).order_by(models.DefaultPhase.orden, models.DefaultPhase.nombre).all()


@router.post("/crear", response_model=DefaultPhaseOut, status_code=status.HTTP_201_CREATED)
def crear_fase_predeterminada(
    datos: DefaultPhaseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    ultimo_orden = db.query(func.max(models.DefaultPhase.orden)).scalar() or 0
    nueva = models.DefaultPhase(nombre=datos.nombre, orden=ultimo_orden + 1)
    try:
        db.add(nueva)
        db.commit()
        db.refresh(nueva)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
        raise HTTPException(status_code=400, detail="Error al crear la fase predeterminada: datos inválidos")
    return nueva


@router.put("/{fase_id}", response_model=DefaultPhaseOut, status_code=status.HTTP_200_OK)
def actualizar_fase_predeterminada(
    fase_id: str,
    datos: DefaultPhaseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    fase = _buscar(db, fase_id)
    for key, value in datos.model_dump(exclude_unset=True).items():
        setattr(fase, key, value)
    try:
        db.commit()
        db.refresh(fase)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
        raise HTTPException(
            status_code=400, detail="Error al actualizar la fase predeterminada: datos inválidos"
        )
    return fase


@router.delete("/{fase_id}", response_model=DefaultPhaseOut, status_code=status.HTTP_200_OK)
def eliminar_fase_predeterminada(
    fase_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    fase = _buscar(db, fase_id)
    datos = DefaultPhaseOut.model_validate(fase)
    db.delete(fase)
    db.commit()
    return datos
