import uuid
from datetime import date
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
from app.db.models.base import FrozenExchangeRateMixin, TimestampMixin, uuid_pk
from app.db.models.payment import _condicion_contado

if TYPE_CHECKING:
    from app.db.models.category import ExpenseCategory
    from app.db.models.payment import PaymentCondition, PaymentInstallment
    from app.db.models.project import Phase, Project
    from app.db.models.user import User

expense_category = Table(
    "gasto_categoria",
    Base.metadata,
    Column("gasto_id", ForeignKey("gastos.id", ondelete="CASCADE"), primary_key=True),
    Column("categoria_gasto_id", ForeignKey("categorias_gasto.id", ondelete="RESTRICT"), primary_key=True),
)


class Expense(FrozenExchangeRateMixin, TimestampMixin, Base):
    __tablename__ = "gastos"

    id: Mapped[uuid.UUID] = uuid_pk()
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # SET NULL: si se borra la Fase, el Gasto se desvincula pero sigue existiendo (es del Proyecto).
    fase_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("fases.id", ondelete="SET NULL"), nullable=True, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Se carga en pesos; el USD lo congela el backend (ver app/domain/exchange_rate.py).
    monto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    monto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )
    # Igual que en Compra: condición (arma los plazos), medio opcional y
    # estado derivado. Por default Contado y pagado: cargar un flete sigue
    # siendo un paso.
    condicion_pago_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("condiciones_pago.id", ondelete="RESTRICT"), nullable=False, default=_condicion_contado
    )
    medio_pago: Mapped[str | None] = mapped_column(
        String(30), ForeignKey("medios_pago.codigo", ondelete="RESTRICT"), nullable=True
    )
    estado_pago: Mapped[str] = mapped_column(String(20), nullable=False, default="pagado")

    condicion_pago: Mapped["PaymentCondition"] = relationship()
    plazos: Mapped[list["PaymentInstallment"]] = relationship(
        back_populates="gasto", cascade="all, delete-orphan", order_by="PaymentInstallment.numero"
    )
    proyecto: Mapped["Project"] = relationship(back_populates="gastos")
    fase: Mapped["Phase | None"] = relationship(back_populates="gastos")
    usuario: Mapped["User"] = relationship()
    categorias: Mapped[list["ExpenseCategory"]] = relationship(secondary=expense_category)
    comprobantes: Mapped[list["ExpenseReceipt"]] = relationship(
        back_populates="gasto", cascade="all, delete-orphan"
    )


class ExpenseReceipt(TimestampMixin, Base):
    __tablename__ = "comprobantes_gasto"

    id: Mapped[uuid.UUID] = uuid_pk()
    gasto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gastos.id", ondelete="CASCADE"), nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    gasto: Mapped["Expense"] = relationship(back_populates="comprobantes")
