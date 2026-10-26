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

from app.auth.oauth2 import get_current_user, requiere_admin
from app.db import models
from app.db.database import get_db
from app.db.errors import es_violacion_unicidad
from app.schemas import TaxCreate, TaxOut, TaxUpdate

router = APIRouter(prefix="/impuestos", tags=["impuestos"])


@router.get("/", response_model=list[TaxOut], status_code=status.HTTP_200_OK)
def get_all_impuestos(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Tax).all()


@router.get("/{impuesto_id}", response_model=TaxOut, status_code=status.HTTP_200_OK)
def get_impuesto_by_id(
    impuesto_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    impuesto = db.query(models.Tax).filter(models.Tax.id == impuesto_id).first()
    if not impuesto:
        raise HTTPException(status_code=404, detail="Impuesto no encontrado")
    return impuesto


@router.post("/crear", response_model=TaxOut, status_code=status.HTTP_201_CREATED)
def create_impuesto(
    impuesto: TaxCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    nuevo_impuesto = models.Tax(**impuesto.model_dump())
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


@router.put("/{impuesto_id}", response_model=TaxOut, status_code=status.HTTP_200_OK)
def update_impuesto(
    impuesto_id: str,
    impuesto: TaxUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    impuesto_existente = db.query(models.Tax).filter(models.Tax.id == impuesto_id).first()
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


@router.delete("/{impuesto_id}", response_model=TaxOut, status_code=status.HTTP_200_OK)
def delete_impuesto(
    impuesto_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    impuesto = db.query(models.Tax).filter(models.Tax.id == impuesto_id).first()
    if not impuesto:
        raise HTTPException(status_code=404, detail="Impuesto no encontrado")

    impuesto_data = TaxOut.model_validate(impuesto)

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
