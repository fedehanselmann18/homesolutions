import uuid
from datetime import date

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk


class ExchangeRate(TimestampMixin, Base):
    """
    Histórico del dólar (pesos por dólar) por fecha y tipo. Es una FUENTE DE
    SUGERENCIA, no la verdad de ningún movimiento: el form de carga precarga
    de acá el valor del día (o el último cargado), y lo que vale es la
    cotización que quedó congelada en el movimiento (cotizacion_dolar en
    Compra, Gasto, Cobro y las notas). Editar o borrar una fila de esta tabla
    NO reescribe la historia de lo ya cargado.

    Una sola fila por (fecha, tipo): el dólar blue de un día es uno solo.
    """

    __tablename__ = "cotizaciones"
    __table_args__ = (UniqueConstraint("fecha", "tipo", name="uq_cotizacion_fecha_tipo"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    fecha: Mapped[date] = mapped_column(nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # oficial | blue | otro
    # Numeric(12,4): aguanta 1487.3456 con margen.
    valor: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
