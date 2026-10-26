import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict

from app.schemas.common import (
    FrozenExchangeRateIn,
    FrozenExchangeRateOut,
    FrozenExchangeRateUpdate,
    TimestampOut,
)


class ClientPaymentReceiptOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    archivo_path: str


class ClientPaymentNoteOut(TimestampOut):
    """Movimiento de cuenta corriente (nota de crédito/débito) de un Cobro.
    Mismo criterio que NotaCompraOut, sin detalle_compra_id (Cobro no tiene
    líneas de producto)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cobro_id: uuid.UUID
    proyecto_id: uuid.UUID
    usuario_id: uuid.UUID
    tipo: str  # "nota_credito" | "nota_debito"
    origen: str | None = None  # "ajuste_precio" | "acuerdo_comercial" | "otro"
    tipo_factura: str  # SIEMPRE obligatorio, ver NotaCompraOut
    monto_usd: float  # se tipea en dólares, como el cobro
    monto_ars: float  # congelado con la cotización de LA NOTA
    cotizacion_dolar: float
    tipo_cambio: str
    descripcion: str
    fecha: date
    archivo_path: str


class ClientPaymentBase(BaseModel):
    monto_usd: float  # el cliente paga en dólares; el ARS lo congela el backend
    descripcion: str
    fecha: date
    tipo_factura: str


class ClientPaymentCreate(ClientPaymentBase, FrozenExchangeRateIn):
    proyecto_id: uuid.UUID


class ClientPaymentUpdate(FrozenExchangeRateUpdate):
    # CORREGIDO: se saca usuario_id.
    monto_usd: float | None = None
    descripcion: str | None = None
    fecha: date | None = None
    tipo_factura: str | None = None


class ClientPaymentOut(ClientPaymentBase, FrozenExchangeRateOut, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proyecto_id: uuid.UUID
    usuario_id: uuid.UUID
    monto_ars: float  # congelado por el backend
    # Calculados (bruto - NC + ND), no se cargan a mano. Cada nota suma con
    # SU cotización, por eso el ARS no es monto_neto_usd * cotización.
    monto_neto_usd: float
    monto_neto_ars: float
    comprobantes: list[ClientPaymentReceiptOut] = []
    notas: list[ClientPaymentNoteOut] = []  # cuenta corriente: notas de crédito/débito
