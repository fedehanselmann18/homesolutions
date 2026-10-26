import uuid

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk


class Category(TimestampMixin, Base):
    """Categoría compartida entre Producto y Compra (Aires, Cafeteras, Cables...)."""

    __tablename__ = "categorias"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # mano_obra/equipo/materiales


class ExpenseCategory(TimestampMixin, Base):
    """Categoría propia de Gasto (Flete, Almuerzo, Gastos bancarios...)."""

    __tablename__ = "categorias_gasto"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
