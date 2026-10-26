import uuid
from typing import TYPE_CHECKING

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    Column,
    ForeignKey,
    Numeric,
    String,
    Table,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.db.models.category import Category
    from app.db.models.supplier import Supplier

product_category = Table(
    "producto_categoria",
    Base.metadata,
    Column("producto_id", ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True),
    Column("categoria_id", ForeignKey("categorias.id", ondelete="RESTRICT"), primary_key=True),
)


class Product(TimestampMixin, Base):
    __tablename__ = "productos"

    id: Mapped[uuid.UUID] = uuid_pk()
    proveedor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proveedores.id", ondelete="CASCADE"), nullable=False
    )
    marca: Mapped[str] = mapped_column(String(100), nullable=False)
    modelo: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # mano_obra/equipo/materiales
    # Precio de catálogo del proveedor. Es el valor que se propone solo al
    # elegir el producto en una Compra (DetalleCompra.precio_unitario) -- ese
    # campo de la compra queda como fue en el momento, no se actualiza en
    # cascada si el precio de catálogo cambia después.
    precio: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    proveedor: Mapped["Supplier"] = relationship(back_populates="productos")
    categorias: Mapped[list["Category"]] = relationship(secondary=product_category)
