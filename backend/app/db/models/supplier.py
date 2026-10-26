import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.db.models.product import Product


class Supplier(TimestampMixin, Base):
    __tablename__ = "proveedores"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    # Opcional: hay proveedores (distribuidoras chicas, comercios de barrio)
    # de los que no se tiene el CUIT, y no poder cargarlos por eso no tiene
    # sentido -- el dato fiscal se completa después si aparece.
    cuit: Mapped[str | None] = mapped_column(String(20))
    direccion: Mapped[str | None] = mapped_column(String(255))
    telefono: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(150))

    # Si el proveedor no tiene compras cargadas, borrarlo se lleva su catálogo.
    # Si tiene compras, Compra.proveedor_id (RESTRICT) va a impedir el borrado antes de llegar acá.
    productos: Mapped[list["Product"]] = relationship(
        back_populates="proveedor", cascade="all, delete-orphan"
    )
