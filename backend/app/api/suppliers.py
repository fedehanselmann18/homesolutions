"""
GET    /proveedores/
GET    /proveedores/{id}
POST   /proveedores/crear   -> requiere_admin
PUT    /proveedores/{id}    -> requiere_admin
DELETE /proveedores/{id}    -> requiere_admin
                                OJO: CASCADE sobre Producto. Si el proveedor tiene
                                productos cargados, borrarlo se los lleva puestos
                                (y si esos productos ya fueron usados en Compras,
                                el RESTRICT de DetalleCompra.producto_id va a frenar
                                el borrado más abajo en la cadena -> igual capturamos
                                el IntegrityError por las dudas).
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oauth2 import get_current_user, requiere_admin
from app.core.pagination import PaginationParams
from app.db import models
from app.db.database import get_db
from app.schemas import SupplierCreate, SupplierOut, SupplierUpdate

router = APIRouter(prefix="/proveedores", tags=["proveedores"])


@router.get("/", response_model=list[SupplierOut], status_code=status.HTTP_200_OK)
def get_all_proveedores(
    paginacion: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.Supplier).order_by(models.Supplier.fecha_creacion.desc()).offset(paginacion.offset)
    )
    if paginacion.limit is not None:
        query = query.limit(paginacion.limit)
    return query.all()


@router.get("/{proveedor_id}", response_model=SupplierOut, status_code=status.HTTP_200_OK)
def get_proveedor_by_id(
    proveedor_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    proveedor = db.query(models.Supplier).filter(models.Supplier.id == proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")
    return proveedor


@router.post("/crear", response_model=SupplierOut, status_code=status.HTTP_201_CREATED)
def create_proveedor(
    proveedor: SupplierCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    nuevo_proveedor = models.Supplier(
        nombre=proveedor.nombre,
        cuit=proveedor.cuit,
        direccion=proveedor.direccion,
        telefono=proveedor.telefono,
        email=proveedor.email,
    )
    try:
        db.add(nuevo_proveedor)
        db.commit()
        db.refresh(nuevo_proveedor)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el proveedor: datos inválidos")

    return nuevo_proveedor


@router.put("/{proveedor_id}", response_model=SupplierOut, status_code=status.HTTP_200_OK)
def update_proveedor(
    proveedor_id: str,
    proveedor: SupplierUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    proveedor_existente = db.query(models.Supplier).filter(models.Supplier.id == proveedor_id).first()
    if not proveedor_existente:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    for key, value in proveedor.model_dump(exclude_unset=True).items():
        setattr(proveedor_existente, key, value)

    try:
        db.commit()
        db.refresh(proveedor_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar el proveedor: datos inválidos")

    return proveedor_existente


@router.delete("/{proveedor_id}", response_model=SupplierOut, status_code=status.HTTP_200_OK)
def delete_proveedor(
    proveedor_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    proveedor = db.query(models.Supplier).filter(models.Supplier.id == proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    proveedor_data = SupplierOut.model_validate(proveedor)

    try:
        db.delete(proveedor)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail="No se puede eliminar el proveedor: tiene productos ya utilizados en compras",
        )

    return proveedor_data
