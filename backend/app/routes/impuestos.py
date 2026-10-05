"""
GET    /impuestos/
GET    /impuestos/{id}
POST   /impuestos/crear   -> requiere_admin
PUT    /impuestos/{id}    -> requiere_admin
DELETE /impuestos/{id}    -> requiere_admin (RESTRICT vía CompraImpuesto)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.db.errores import es_violacion_unicidad
from app.schemas import ImpuestoCreate, ImpuestoOut, ImpuestoUpdate

router = APIRouter(prefix="/impuestos", tags=["impuestos"])


@router.get("/", response_model=list[ImpuestoOut], status_code=status.HTTP_200_OK)
def get_all_impuestos(
    db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    return db.query(models.Impuesto).all()


@router.get("/{impuesto_id}", response_model=ImpuestoOut, status_code=status.HTTP_200_OK)
def get_impuesto_by_id(
    impuesto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    impuesto = db.query(models.Impuesto).filter(models.Impuesto.id == impuesto_id).first()
    if not impuesto:
        raise HTTPException(status_code=404, detail="Impuesto no encontrado")
    return impuesto


@router.post("/crear", response_model=ImpuestoOut, status_code=status.HTTP_201_CREATED)
def create_impuesto(
    impuesto: ImpuestoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    nuevo_impuesto = models.Impuesto(nombre=impuesto.nombre)
    try:
        db.add(nuevo_impuesto)
        db.commit()
        db.refresh(nuevo_impuesto)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail="Ya existe un impuesto con ese nombre")
        raise HTTPException(status_code=400, detail="Error al crear el impuesto: datos inválidos")

    return nuevo_impuesto


@router.put("/{impuesto_id}", response_model=ImpuestoOut, status_code=status.HTTP_200_OK)
def update_impuesto(
    impuesto_id: str,
    impuesto: ImpuestoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    impuesto_existente = db.query(models.Impuesto).filter(models.Impuesto.id == impuesto_id).first()
    if not impuesto_existente:
        raise HTTPException(status_code=404, detail="Impuesto no encontrado")

    for key, value in impuesto.model_dump(exclude_unset=True).items():
        setattr(impuesto_existente, key, value)

    try:
        db.commit()
        db.refresh(impuesto_existente)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail="Ya existe un impuesto con ese nombre")
        raise HTTPException(status_code=400, detail="Error al actualizar el impuesto: datos inválidos")

    return impuesto_existente


@router.delete("/{impuesto_id}", response_model=ImpuestoOut, status_code=status.HTTP_200_OK)
def delete_impuesto(
    impuesto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    impuesto = db.query(models.Impuesto).filter(models.Impuesto.id == impuesto_id).first()
    if not impuesto:
        raise HTTPException(status_code=404, detail="Impuesto no encontrado")

    impuesto_data = ImpuestoOut.model_validate(impuesto)

    try:
        db.delete(impuesto)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el impuesto porque fue aplicado en una o más compras",
        )

    return impuesto_data
