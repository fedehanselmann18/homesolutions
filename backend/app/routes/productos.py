from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.pagination import ParametrosPaginacion
from app.schemas import ProductoCreate, ProductoOut, ProductoUpdate

router = APIRouter(prefix="/productos", tags=["productos"])


@router.get("/", response_model=list[ProductoOut], status_code=status.HTTP_200_OK)
def get_all_productos(
    paginacion: ParametrosPaginacion = Depends(),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    query = (
        db.query(models.Producto)
        .options(joinedload(models.Producto.categorias))
        .order_by(models.Producto.fecha_creacion.desc())
        .offset(paginacion.offset)
    )
    if paginacion.limit is not None:
        query = query.limit(paginacion.limit)
    return query.all()


@router.get("/{producto_id}", response_model=ProductoOut, status_code=status.HTTP_200_OK)
def get_producto_by_id(
    producto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    producto = (
        db.query(models.Producto)
        .options(joinedload(models.Producto.categorias))
        .filter(models.Producto.id == producto_id)
        .first()
    )
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    return producto


@router.get(
    "/proveedores/{proveedor_id}/productos", response_model=list[ProductoOut], status_code=status.HTTP_200_OK
)
def get_productos_by_proveedor(
    proveedor_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    proveedor = db.query(models.Proveedor).filter(models.Proveedor.id == proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    return (
        db.query(models.Producto)
        .options(joinedload(models.Producto.categorias))
        .filter(models.Producto.proveedor_id == proveedor_id)
        .all()
    )


@router.post("/crear", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def create_producto(
    producto: ProductoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    proveedor = db.query(models.Proveedor).filter(models.Proveedor.id == producto.proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    categorias = []
    if producto.categoria_ids:
        categorias = db.query(models.Categoria).filter(models.Categoria.id.in_(producto.categoria_ids)).all()
        if len(categorias) != len(producto.categoria_ids):
            raise HTTPException(status_code=404, detail="Una o más categorías no existen")

    nuevo_producto = models.Producto(
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


@router.put("/{producto_id}", response_model=ProductoOut, status_code=status.HTTP_200_OK)
def update_producto(
    producto_id: str,
    producto: ProductoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    producto_existente = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto_existente:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    datos = producto.model_dump(exclude_unset=True)

    # categoria_ids se maneja aparte: no es una columna directa, es la relación M2M
    if "categoria_ids" in datos:
        ids = datos.pop("categoria_ids")
        categorias = db.query(models.Categoria).filter(models.Categoria.id.in_(ids)).all()
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


@router.delete("/{producto_id}", response_model=ProductoOut, status_code=status.HTTP_200_OK)
def delete_producto(
    producto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    producto = db.query(models.Producto).filter(models.Producto.id == producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    producto_data = ProductoOut.model_validate(producto)

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
