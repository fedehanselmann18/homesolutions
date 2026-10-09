"""
Tipos de factura: las opciones del select de compras, gastos, cobros y notas
(ver models.TipoFactura y app/tipos_factura.py). Se administran desde Ajustes.

GET    /tipos-factura/        -> en orden, «Otros» último
GET    /tipos-factura/{id}
POST   /tipos-factura/crear   -> requiere_admin, va al final; el código sale del nombre
PUT    /tipos-factura/{id}    -> requiere_admin, sólo el nombre (el código no cambia)
DELETE /tipos-factura/{id}    -> requiere_admin (RESTRICT si tiene movimientos; «Otros» nunca)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.db.errores import es_violacion_unicidad
from app.schemas import TipoFacturaCreate, TipoFacturaOut, TipoFacturaUpdate
from app.tipos_factura import CODIGO_OTROS, generar_codigo, listar

router = APIRouter(prefix="/tipos-factura", tags=["tipos_factura"])

NOMBRE_REPETIDO = "Ya existe un tipo de factura con ese nombre"
CODIGO_REPETIDO = "Ya existe un tipo de factura muy parecido a ese nombre"
NOMBRE_SIN_LETRAS = "El nombre tiene que tener al menos una letra o número"
NO_ENCONTRADO = "Tipo de factura no encontrado"
OTROS_PROTEGIDO = "«Otros» no se puede eliminar: es el que usa la IA cuando no reconoce el comprobante"
EN_USO = "No se puede eliminar el tipo de factura porque tiene movimientos asociados"


def _buscar(db: Session, tipo_id: str) -> models.TipoFactura:
    tipo = db.query(models.TipoFactura).filter(models.TipoFactura.id == tipo_id).first()
    if not tipo:
        raise HTTPException(status_code=404, detail=NO_ENCONTRADO)
    return tipo


@router.get("/", response_model=list[TipoFacturaOut], status_code=status.HTTP_200_OK)
def get_tipos_factura(
    db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    return listar(db)


@router.get("/{tipo_id}", response_model=TipoFacturaOut, status_code=status.HTTP_200_OK)
def get_tipo_factura(
    tipo_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    return _buscar(db, tipo_id)


@router.post("/crear", response_model=TipoFacturaOut, status_code=status.HTTP_201_CREATED)
def crear_tipo_factura(
    datos: TipoFacturaCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    codigo = generar_codigo(datos.nombre)
    if not codigo:
        raise HTTPException(status_code=400, detail=NOMBRE_SIN_LETRAS)
    if db.query(models.TipoFactura.id).filter(models.TipoFactura.nombre == datos.nombre).first():
        raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
    if db.query(models.TipoFactura.id).filter(models.TipoFactura.codigo == codigo).first():
        raise HTTPException(status_code=400, detail=CODIGO_REPETIDO)

    ultimo_orden = db.query(func.max(models.TipoFactura.orden)).scalar() or 0
    nuevo = models.TipoFactura(codigo=codigo, nombre=datos.nombre, orden=ultimo_orden + 1)
    try:
        db.add(nuevo)
        db.commit()
        db.refresh(nuevo)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
        raise HTTPException(status_code=400, detail="Error al crear el tipo de factura: datos inválidos")
    return nuevo


@router.put("/{tipo_id}", response_model=TipoFacturaOut, status_code=status.HTTP_200_OK)
def actualizar_tipo_factura(
    tipo_id: str,
    datos: TipoFacturaUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    tipo = _buscar(db, tipo_id)
    for key, value in datos.model_dump(exclude_unset=True).items():
        setattr(tipo, key, value)
    try:
        db.commit()
        db.refresh(tipo)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=NOMBRE_REPETIDO)
        raise HTTPException(status_code=400, detail="Error al actualizar el tipo de factura: datos inválidos")
    return tipo


@router.delete("/{tipo_id}", response_model=TipoFacturaOut, status_code=status.HTTP_200_OK)
def eliminar_tipo_factura(
    tipo_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    tipo = _buscar(db, tipo_id)
    if tipo.codigo == CODIGO_OTROS:
        raise HTTPException(status_code=400, detail=OTROS_PROTEGIDO)

    datos = TipoFacturaOut.model_validate(tipo)
    try:
        db.delete(tipo)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail=EN_USO)
    return datos
