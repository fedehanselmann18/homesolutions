from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth.oauth2 import get_current_user, requiere_admin
from app.core.pagination import PaginationParams
from app.db import models
from app.db.database import get_db
from app.schemas import ProductCreate, ProductOut, ProductUpdate

router = APIRouter(prefix="/productos", tags=["productos"])


@router.get("/", response_model=list[ProductOut], status_code=status.HTTP_200_OK)
def get_all_productos(
    paginacion: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.Product)
        .options(joinedload(models.Product.categorias))
        .order_by(models.Product.fecha_creacion.desc())
        .offset(paginacion.offset)
    )
    if paginacion.limit is not None:
        query = query.limit(paginacion.limit)
    return query.all()


@router.get("/{producto_id}", response_model=ProductOut, status_code=status.HTTP_200_OK)
def get_producto_by_id(
    producto_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    producto = (
        db.query(models.Product)
        .options(joinedload(models.Product.categorias))
        .filter(models.Product.id == producto_id)
        .first()
    )
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@router.get(
    "/proveedores/{proveedor_id}/productos", response_model=list[ProductOut], status_code=status.HTTP_200_OK
)
def get_productos_by_proveedor(
    proveedor_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    proveedor = db.query(models.Supplier).filter(models.Supplier.id == proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    return (
        db.query(models.Product)
        .options(joinedload(models.Product.categorias))
        .filter(models.Product.proveedor_id == proveedor_id)
        .all()
    )


@router.post("/crear", response_model=ProductOut, status_code=status.HTTP_201_CREATED)
def create_producto(
    producto: ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    proveedor = db.query(models.Supplier).filter(models.Supplier.id == producto.proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    categorias = []
    if producto.categoria_ids:
        categorias = db.query(models.Category).filter(models.Category.id.in_(producto.categoria_ids)).all()
        if len(categorias) != len(producto.categoria_ids):
            raise HTTPException(status_code=404, detail="Una o más categorías no existen")

    nuevo_producto = models.Product(
        proveedor_id=producto.proveedor_id,
        marca=producto.marca,
        modelo=producto.modelo,
        tipo=producto.tipo,
        precio=producto.precio,
        categorias=categorias,
    )

    try:
        db.add(nuevo_producto)
        db.commit()
        db.refresh(nuevo_producto)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el producto: datos inválidos")

    return nuevo_producto


@router.put("/{producto_id}", response_model=ProductOut, status_code=status.HTTP_200_OK)
def update_producto(
    producto_id: str,
    producto: ProductUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    producto_existente = db.query(models.Product).filter(models.Product.id == producto_id).first()
    if not producto_existente:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    datos = producto.model_dump(exclude_unset=True)

    # categoria_ids se maneja aparte: no es una columna directa, es la relación M2M
    if "categoria_ids" in datos:
        ids = datos.pop("categoria_ids")
        categorias = db.query(models.Category).filter(models.Category.id.in_(ids)).all()
        if len(categorias) != len(ids):
            raise HTTPException(status_code=404, detail="Una o más categorías no existen")
        producto_existente.categorias = categorias

    for key, value in datos.items():
        setattr(producto_existente, key, value)

    try:
        db.commit()
        db.refresh(producto_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar el producto: datos inválidos")

    return producto_existente


@router.delete("/{producto_id}", response_model=ProductOut, status_code=status.HTTP_200_OK)
def delete_producto(
    producto_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    producto = db.query(models.Product).filter(models.Product.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    producto_data = ProductOut.model_validate(producto)

    try:
        db.delete(producto)
        db.commit()
    except IntegrityError:
        # RESTRICT: DetalleCompra.producto_id no permite borrar un producto ya comprado
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el producto porque ya fue usado en una o más compras",
        )

    return producto_data
