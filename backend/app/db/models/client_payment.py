import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    ForeignKey,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import FrozenExchangeRateMixin, TimestampMixin, _ajuste_notas, uuid_pk

if TYPE_CHECKING:
    from app.db.models.project import Project
    from app.db.models.user import User


class ClientPayment(FrozenExchangeRateMixin, TimestampMixin, Base):
    __tablename__ = "cobros"

    id: Mapped[uuid.UUID] = uuid_pk()
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Al revés que Gasto/Compra: el cliente paga en dólares, así que el USD
    # se tipea y el ARS lo congela el backend (ver app/domain/exchange_rate.py).
    monto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    monto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )

    proyecto: Mapped["Project"] = relationship(back_populates="cobros")
    usuario: Mapped["User"] = relationship()
    comprobantes: Mapped[list["ClientPaymentReceipt"]] = relationship(
        back_populates="cobro", cascade="all, delete-orphan"
    )
    # Cuenta corriente de este cobro con el "cliente" (Proyecto): notas de
    # crédito/débito. Mismo criterio que Compra.notas, ver NotaCobro.
    notas: Mapped[list["ClientPaymentNote"]] = relationship(
        back_populates="cobro", cascade="all, delete-orphan"
    )

    @property
    def monto_neto_usd(self) -> float:
        """
        monto_usd - notas de crédito + notas de débito (ver NotaCobro).
        monto_usd sigue siendo el bruto cargado a mano; esto es lo calculado,
        no se persiste. Cada nota suma con SU cotización, no la del cobro.
        """
        return float(self.monto_usd) + _ajuste_notas(self.notas, "monto_usd")

    @property
    def monto_neto_ars(self) -> float:
        return float(self.monto_ars) + _ajuste_notas(self.notas, "monto_ars")


class ClientPaymentReceipt(TimestampMixin, Base):
    """Archivo adjunto a un Cobro (factura, recibo...). Para movimientos de
    cuenta corriente (nota de crédito/débito) ver NotaCobro."""

    __tablename__ = "comprobantes_cobro"

    id: Mapped[uuid.UUID] = uuid_pk()
    cobro_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cobros.id", ondelete="CASCADE"), nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    cobro: Mapped["ClientPayment"] = relationship(back_populates="comprobantes")


class ClientPaymentNote(FrozenExchangeRateMixin, TimestampMixin, Base):
    """
    Movimiento de cuenta corriente con un "cliente" (Proyecto): nota de
    crédito o de débito. Mismo criterio que NotaCompra pero del lado Cobro --
    sin detalle_compra_id porque Cobro no tiene líneas de producto.

    Como el cobro, se tipea en USD (ajusta un precio acordado en dólares) y
    el ARS lo congela el backend con la cotización de la nota.
    """

    __tablename__ = "notas_cobro"

    id: Mapped[uuid.UUID] = uuid_pk()
    cobro_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cobros.id", ondelete="CASCADE"), nullable=False)
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="RESTRICT"), nullable=False
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )

    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # nota_credito | nota_debito
    origen: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )  # ajuste_precio | acuerdo_comercial | otro
    # SIEMPRE obligatorio, ver NotaCompra
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )
    monto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    monto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    cobro: Mapped["ClientPayment"] = relationship(back_populates="notas")
    proyecto: Mapped["Project"] = relationship()
    usuario: Mapped["User"] = relationship()
