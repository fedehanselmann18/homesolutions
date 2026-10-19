"""
Medios de pago: las opciones del control «Medio de pago» de compras y gastos
(ver models.MedioPago y app/medios_pago.py). Se administran desde Ajustes.

GET    /medios-pago/        -> en orden, con los desactivados (Ajustes y movimientos viejos)
GET    /medios-pago/{id}
POST   /medios-pago/crear   -> requiere_admin, va al final; el código sale del nombre
PUT    /medios-pago/{id}    -> requiere_admin, nombre y activo (el código no cambia)
DELETE /medios-pago/{id}    -> requiere_admin (RESTRICT si tiene movimientos: se desactiva)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.db.errores import es_violacion_unicidad
from app.medios_pago import listar
from app.schemas import MedioPagoCreate, MedioPagoOut, MedioPagoUpdate
from app.tipos_factura import generar_codigo

router = APIRouter(prefix="/medios-pago", tags=["medios_pago"])

NOMBRE_REPETIDO = "Ya existe un medio de pago con ese nombre"
CODIGO_REPETIDO = "Ya existe un medio de pago muy parecido a ese nombre"
NOMBRE_SIN_LETRAS = "El nombre tiene que tener al menos una letra o número"
NO_ENCONTRADO = "Medio de pago no encontrado"
EN_USO = "No se puede eliminar el medio de pago porque tiene movimientos asociados: desactivalo"


def _buscar(db: Session, medio_id: str) -> models.MedioPago:
    medio = db.query(models.MedioPago).filter(models.MedioPago.id == medio_id).first()
    if not medio:
        raise HTTPException(status_code=404, detail=NO_ENCONTRADO)
    return medio


@router.get("/", response_model=list[MedioPagoOut], status_code=status.HTTP_200_OK)
def get_medios_pago(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    return listar(db)


@router.get("/{medio_id}", response_model=MedioPagoOut, status_code=status.HTTP_200_OK)
def get_medio_pago(
    medio_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    return _buscar(db, medio_id)


@router.post("/crear", response_model=MedioPagoOut, status_code=status.HTTP_201_CREATED)
def crear_medio_pago(
    datos: MedioPagoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    codigo = generar_codigo(datos.nombre)
    if not codigo:
        raise HTTPException(status_code=400, detail=NOMBRE_SIN_LETRAS)
    if db.query(models.MedioPago.id).filter(models.MedioPago.nombre == datos.nombre).first():
        raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
    if db.query(models.MedioPago.id).filter(models.MedioPago.codigo == codigo).first():
        raise HTTPException(status_code=400, detail=CODIGO_REPETIDO)

    ultimo_orden = db.query(func.max(models.MedioPago.orden)).scalar() or 0
    nuevo = models.MedioPago(codigo=codigo, nombre=datos.nombre, orden=ultimo_orden + 1)
    try:
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
        raise HTTPException(status_code=400, detail="Error al crear el medio de pago: datos inválidos")
    return nuevo


@router.put("/{medio_id}", response_model=MedioPagoOut, status_code=status.HTTP_200_OK)
def actualizar_medio_pago(
    medio_id: str,
    datos: MedioPagoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    medio = _buscar(db, medio_id)
    for key, value in datos.model_dump(exclude_unset=True).items():
        if value is None:
            continue  # ni el nombre ni activo admiten null
        setattr(medio, key, value)
    try:
        db.commit()
        db.refresh(medio)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
        raise HTTPException(status_code=400, detail="Error al actualizar el medio de pago: datos inválidos")
    return medio


@router.delete("/{medio_id}", response_model=MedioPagoOut, status_code=status.HTTP_200_OK)
def eliminar_medio_pago(
    medio_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    medio = _buscar(db, medio_id)
    datos = MedioPagoOut.model_validate(medio)
    try:
        db.delete(medio)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=EN_USO)
    return datos
