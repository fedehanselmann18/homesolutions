import uuid
from datetime import datetime

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    DateTime,
    Numeric,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    """fecha_creacion/fecha_actualizacion automáticas, las pone la DB sola."""

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class FrozenExchangeRateMixin:
    """
    La cotización con la que se cargó un movimiento de plata (compra, gasto,
    cobro, notas), copiada en el momento de la carga. Es la que vale para
    ese movimiento para siempre: una compra de marzo sigue valiendo lo que
    valió aunque después cambie el dólar o se edite la tabla cotizaciones.

    Convive con las DOS cifras persistidas del movimiento (sufijos _ars/_usd): una la tipea el
    usuario y la otra la calcula el backend con app/domain/exchange_rate.py.
    """

    cotizacion_dolar: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)  # pesos por dólar
    tipo_cambio: Mapped[str] = mapped_column(String(20), nullable=False)  # oficial | blue | otro


def _ajuste_notas(notas: list, campo: str) -> float:
    """Débito - crédito de una lista de notas (NotaCompra o NotaCobro), en la
    moneda que diga `campo` ("monto_ars" | "monto_usd")."""
    credito = sum(float(getattr(n, campo)) for n in notas if n.tipo == "nota_credito")
    debito = sum(float(getattr(n, campo)) for n in notas if n.tipo == "nota_debito")
    return debito - credito
