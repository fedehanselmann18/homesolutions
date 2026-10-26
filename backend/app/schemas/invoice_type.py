import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.domain.invoice_types import CODIGO_OTROS
from app.schemas.common import TimestampOut


def _nombre_tipo_factura_limpio(valor: str | None) -> str | None:
    """Sin espacios de más, y nunca vacío."""
    if valor is None:
        return None
    limpio = " ".join(valor.split())
    if not limpio:
        raise ValueError("El nombre no puede estar vacío")
    return limpio


class InvoiceTypeBase(BaseModel):
    nombre: str = Field(max_length=100)

    _limpiar_nombre = field_validator("nombre")(_nombre_tipo_factura_limpio)


class InvoiceTypeCreate(InvoiceTypeBase):
    pass


class InvoiceTypeUpdate(BaseModel):
    # El código no se edita nunca: sólo el nombre.
    nombre: str | None = Field(default=None, max_length=100)

    _limpiar_nombre = field_validator("nombre")(_nombre_tipo_factura_limpio)


class InvoiceTypeOut(InvoiceTypeBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    codigo: str
    orden: int

    @computed_field
    @property
    def protegido(self) -> bool:
        """«Otros» no se borra: es al que cae la IA."""
        return self.codigo == CODIGO_OTROS
