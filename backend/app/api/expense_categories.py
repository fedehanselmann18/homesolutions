"""
GET    /categorias-gasto/
GET    /categorias-gasto/{id}
POST   /categorias-gasto/crear   -> requiere_admin
PUT    /categorias-gasto/{id}    -> requiere_admin
DELETE /categorias-gasto/{id}    -> requiere_admin (RESTRICT vía gasto_categoria)
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oauth2 import get_current_user, requiere_admin
from app.db import models
from app.db.database import get_db
from app.db.errors import es_violacion_unicidad
from app.schemas import ExpenseCategoryCreate, ExpenseCategoryOut, ExpenseCategoryUpdate

router = APIRouter(prefix="/categorias-gasto", tags=["categorias_gasto"])


@router.get("/", response_model=list[ExpenseCategoryOut], status_code=status.HTTP_200_OK)
def get_all_categories_gasto(
    db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    return db.query(models.ExpenseCategory).all()


@router.get("/{categoria_id}", response_model=ExpenseCategoryOut, status_code=status.HTTP_200_OK)
def get_category_gasto_by_id(
    categoria_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    categoria = db.query(models.ExpenseCategory).filter(models.ExpenseCategory.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría de gasto no encontrada")
    return categoria


@router.post("/crear", response_model=ExpenseCategoryOut, status_code=status.HTTP_201_CREATED)
def create_category_gasto(
    categoria: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    nueva_categoria = models.ExpenseCategory(
        nombre=categoria.nombre,
    )
    try:
        db.add(nueva_categoria)
        db.commit()
        db.refresh(nueva_categoria)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail="Ya existe una categoría de gasto con ese nombre")
        raise HTTPException(status_code=400, detail="Error al crear la categoría de gasto: datos inválidos")

    return nueva_categoria


@router.put("/{categoria_id}", response_model=ExpenseCategoryOut, status_code=status.HTTP_200_OK)
def update_category_gasto(
    categoria_id: str,
    categoria: ExpenseCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    categoria_existente = (
        db.query(models.ExpenseCategory).filter(models.ExpenseCategory.id == categoria_id).first()
    )
    if not categoria_existente:
        raise HTTPException(status_code=404, detail="Categoría de gasto no encontrada")

    for key, value in categoria.model_dump(exclude_unset=True).items():
        setattr(categoria_existente, key, value)

    try:
        db.commit()
        db.refresh(categoria_existente)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail="Ya existe una categoría de gasto con ese nombre")
        raise HTTPException(
            status_code=400, detail="Error al actualizar la categoría de gasto: datos inválidos"
        )

    return categoria_existente


@router.delete("/{categoria_id}", response_model=ExpenseCategoryOut, status_code=status.HTTP_200_OK)
def delete_category_gasto(
    categoria_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    categoria = db.query(models.ExpenseCategory).filter(models.ExpenseCategory.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría de gasto no encontrada")

    categoria_data = ExpenseCategoryOut.model_validate(categoria)

    try:
        db.delete(categoria)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="No se puede eliminar la categoría de gasto porque tiene gastos asociados"
        )

    return categoria_data
