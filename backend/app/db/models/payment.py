import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    Boolean,
    CheckConstraint,
    ForeignKey,
    Integer,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.db.models.expense import Expense
    from app.db.models.purchase import Purchase


class PaymentMethod(TimestampMixin, Base):
    """Cómo se paga una compra o un gasto (efectivo, transferencia...): las
    opciones del control «Medio de pago». Se administran desde Ajustes.

    Igual que TipoFactura: los movimientos guardan el `codigo` con FK
    RESTRICT, y el código sale del nombre al crear y no cambia. Diferencia:
    no hay ninguno protegido, y uno con movimientos se desactiva (`activo`)
    en vez de borrarse: no aparece al cargar pero se sigue viendo bien en los
    movimientos viejos (ver app/domain/payment_methods.py)."""

    __tablename__ = "medios_pago"

    id: Mapped[uuid.UUID] = uuid_pk()
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


def _condicion_contado(context):
    """Default de condicion_pago_id: «Contado». Las rutas lo ponen siempre
    (con sus plazos); esto cubre lo que se crea directo con el ORM (scripts,
    tests), que si no chocaría contra el NOT NULL."""
    return context.connection.execute(
        text("SELECT id FROM condiciones_pago WHERE protegido ORDER BY orden LIMIT 1")
    ).scalar()


class PaymentCondition(TimestampMixin, Base):
    """Cuándo se paga una compra o un gasto: «Contado» (sin plazos: un solo
    pago el día de la factura), «30 días» ([30]), «30/60 días» ([30, 60]: mitad
    y mitad)... Se arman en Ajustes. Los días cuentan desde la fecha del
    movimiento. «Contado» (protegido) no se borra ni cambia sus días: es el
    default de los gastos."""

    __tablename__ = "condiciones_pago"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # Lista de días ordenada, sin repetidos: [] = contado, [30, 60] = dos plazos.
    dias: Mapped[list[int]] = mapped_column(JSONB, nullable=False, default=list)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    protegido: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class PaymentInstallment(TimestampMixin, Base):
    """Un pago de una compra o de un gasto según su condición (30/60 días =
    dos plazos). En pesos, como su movimiento; en dólares se convierte con la
    cotización congelada del movimiento (no tiene USD propio). Lo pendiente
    se reparte solo cuando cambia el total (ver app/domain/payment_terms.py). Pertenece a
    una compra O a un gasto, nunca a los dos (CHECK)."""

    __tablename__ = "plazos_pago"
    __table_args__ = (
        CheckConstraint("(compra_id IS NULL) <> (gasto_id IS NULL)", name="ck_plazos_pago_compra_o_gasto"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("compras.id", ondelete="CASCADE"), nullable=True, index=True
    )
    gasto_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("gastos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    numero: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3... en orden de vencimiento
    dias: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 = contado / ajuste del día
    fecha_vencimiento: Mapped[date] = mapped_column(nullable=False, index=True)
    monto: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    pagado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fecha_pago: Mapped[date | None] = mapped_column(nullable=True)

    compra: Mapped["Purchase | None"] = relationship(back_populates="plazos")
    gasto: Mapped["Expense | None"] = relationship(back_populates="plazos")
