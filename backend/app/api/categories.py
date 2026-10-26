from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oauth2 import get_current_user, requiere_admin
from app.db import models
from app.db.database import get_db
from app.db.errors import es_violacion_unicidad
from app.schemas import CategoryCreate, CategoryOut, CategoryUpdate

router = APIRouter(prefix="/categorias", tags=["categorias"])


@router.get("/", response_model=list[CategoryOut], status_code=status.HTTP_200_OK)
def get_all_categories(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Category).all()


@router.get("/{categoria_id}", response_model=CategoryOut, status_code=status.HTTP_200_OK)
def get_category_by_id(
    categoria_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    categoria = db.query(models.Category).filter(models.Category.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")
    return categoria


@router.post("/crear", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    categoria: CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    nueva_categoria = models.Category(nombre=categoria.nombre, tipo=categoria.tipo)
    try:
        db.add(nueva_categoria)
        db.commit()
        db.refresh(nueva_categoria)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
        raise HTTPException(status_code=400, detail="Error al crear la categoría: datos inválidos")

    return nueva_categoria


@router.delete("/{categoria_id}", response_model=CategoryOut, status_code=status.HTTP_200_OK)
def delete_category(
    categoria_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    categoria = db.query(models.Category).filter(models.Category.id == categoria_id).first()
    if not categoria:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    categoria_data = CategoryOut.model_validate(categoria)
    try:
        db.delete(categoria)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400, detail="No se puede eliminar la categoría porque tiene productos asociados"
        )

    return categoria_data


@router.put("/{categoria_id}", response_model=CategoryOut, status_code=status.HTTP_200_OK)
def update_category(
    categoria_id: str,
    categoria: CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    categoria_existente = db.query(models.Category).filter(models.Category.id == categoria_id).first()
    if not categoria_existente:
        raise HTTPException(status_code=404, detail="Categoría no encontrada")

    for key, value in categoria.model_dump(exclude_unset=True).items():
        setattr(categoria_existente, key, value)

    try:
        db.commit()
        db.refresh(categoria_existente)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail="Ya existe una categoría con ese nombre")
        raise HTTPException(status_code=400, detail="Error al actualizar la categoría: datos inválidos")

    return categoria_existente
