"""
Condiciones de pago (Contado, 30 días, 30/60 días...): cuándo se paga una
compra o un gasto. Se administran desde Ajustes (ver models.CondicionPago y
app/plazos.py).

GET    /condiciones-pago/        -> en orden
GET    /condiciones-pago/{id}
POST   /condiciones-pago/crear   -> requiere_admin, va al final
PUT    /condiciones-pago/{id}    -> requiere_admin
DELETE /condiciones-pago/{id}    -> requiere_admin (RESTRICT si la usa algún movimiento)

Cambiar los días de una condición NO toca los plazos de lo que ya se cargó
con ella: cada movimiento armó sus plazos al cargarse.
«Contado» (protegido) no se borra ni cambia sus días: es el default.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.db.errores import es_violacion_unicidad
from app.schemas import CondicionPagoCreate, CondicionPagoOut, CondicionPagoUpdate

router = APIRouter(prefix="/condiciones-pago", tags=["condiciones_pago"])

NOMBRE_REPETIDO = "Ya existe una condición de pago con ese nombre"
NO_ENCONTRADA = "Condición de pago no encontrada"
CONTADO_PROTEGIDO = "«Contado» no se puede eliminar: es la condición que usan por default compras y gastos"
CONTADO_SIN_DIAS = "«Contado» no lleva días: se paga el día de la factura"
EN_USO = "No se puede eliminar la condición de pago porque tiene compras o gastos asociados"


def _buscar(db: Session, condicion_id: str) -> models.CondicionPago:
    condicion = db.query(models.CondicionPago).filter(models.CondicionPago.id == condicion_id).first()
    if not condicion:
        raise HTTPException(status_code=404, detail=NO_ENCONTRADA)
    return condicion


@router.get("/", response_model=list[CondicionPagoOut], status_code=status.HTTP_200_OK)
def get_condiciones_pago(
    db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    return (
        db.query(models.CondicionPago).order_by(models.CondicionPago.orden, models.CondicionPago.nombre).all()
    )


@router.get("/{condicion_id}", response_model=CondicionPagoOut, status_code=status.HTTP_200_OK)
def get_condicion_pago(
    condicion_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    return _buscar(db, condicion_id)


@router.post("/crear", response_model=CondicionPagoOut, status_code=status.HTTP_201_CREATED)
def crear_condicion_pago(
    datos: CondicionPagoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    ultimo_orden = db.query(func.max(models.CondicionPago.orden)).scalar() or 0
    nueva = models.CondicionPago(
        nombre=datos.nombre, dias=datos.dias, orden=ultimo_orden + 1, protegido=False
    )
    try:
        db.add(nueva)
        db.commit()
        db.refresh(nueva)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
        raise HTTPException(status_code=400, detail="Error al crear la condición de pago: datos inválidos")
    return nueva


@router.put("/{condicion_id}", response_model=CondicionPagoOut, status_code=status.HTTP_200_OK)
def actualizar_condicion_pago(
    condicion_id: str,
    datos: CondicionPagoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    condicion = _buscar(db, condicion_id)
    cambios = datos.model_dump(exclude_unset=True)
    if condicion.protegido and cambios.get("dias"):
        raise HTTPException(status_code=400, detail=CONTADO_SIN_DIAS)
    for key, value in cambios.items():
        setattr(condicion, key, value)
    try:
        db.commit()
        db.refresh(condicion)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
        raise HTTPException(
            status_code=400, detail="Error al actualizar la condición de pago: datos inválidos"
        )
    return condicion


@router.delete("/{condicion_id}", response_model=CondicionPagoOut, status_code=status.HTTP_200_OK)
def eliminar_condicion_pago(
    condicion_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    condicion = _buscar(db, condicion_id)
    if condicion.protegido:
        raise HTTPException(status_code=400, detail=CONTADO_PROTEGIDO)

    datos = CondicionPagoOut.model_validate(condicion)
    try:
        db.delete(condicion)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=EN_USO)
    return datos
