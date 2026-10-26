import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import TimestampOut
from app.schemas.invoice_type import InvoiceTypeBase, _nombre_tipo_factura_limpio


def _dias_ordenados(valor: list[int] | None) -> list[int] | None:
    """[60, 30, 30] -> [30, 60]. Cada día entre 1 y 365, como mucho 12 plazos."""
    if valor is None:
        return None
    dias = sorted(set(valor))
    if any(d < 1 or d > 365 for d in dias):
        raise ValueError("Cada plazo tiene que ser de 1 a 365 días")
    if len(dias) > 12:
        raise ValueError("Como mucho 12 plazos")
    return dias


class PaymentConditionBase(BaseModel):
    nombre: str = Field(max_length=100)
    # [] = contado (un pago el día de la factura); [30, 60] = mitad y mitad.
    dias: list[int] = []

    _limpiar_nombre = field_validator("nombre")(_nombre_tipo_factura_limpio)
    _ordenar_dias = field_validator("dias")(_dias_ordenados)


class PaymentConditionCreate(PaymentConditionBase):
    pass


class PaymentConditionUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=100)
    dias: list[int] | None = None

    _limpiar_nombre = field_validator("nombre")(_nombre_tipo_factura_limpio)
    _ordenar_dias = field_validator("dias")(_dias_ordenados)


class PaymentConditionOut(PaymentConditionBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    orden: int
    protegido: bool


class PaymentInstallmentOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    compra_id: uuid.UUID | None = None
    gasto_id: uuid.UUID | None = None
    numero: int
    dias: int
    fecha_vencimiento: date
    monto: float  # pesos; en USD hereda la cotización de su movimiento
    pagado: bool
    fecha_pago: date | None = None


class PaymentInstallmentUpdate(BaseModel):
    pagado: bool
    # Sin mandarla: hoy. Sólo cuenta si pagado=True.
    fecha_pago: date | None = None


class PaymentMethodCreate(InvoiceTypeBase):
    pass


class PaymentMethodUpdate(BaseModel):
    # El código no se edita nunca: nombre y activo.
    nombre: str | None = Field(default=None, max_length=100)
    activo: bool | None = None

    _limpiar_nombre = field_validator("nombre")(_nombre_tipo_factura_limpio)


class PaymentMethodOut(InvoiceTypeBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    codigo: str
    orden: int
    activo: bool
