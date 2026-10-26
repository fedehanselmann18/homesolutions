import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.common import ExchangeRateType, TimestampOut, _validar_cotizacion


class ExchangeRateBase(BaseModel):
    fecha: date
    tipo: ExchangeRateType
    valor: float  # pesos por dólar

    @field_validator("valor")
    @classmethod
    def valor_positivo(cls, valor: float) -> float:
        return _validar_cotizacion(valor)


class ExchangeRateCreate(ExchangeRateBase):
    pass


class ExchangeRateUpdate(BaseModel):
    fecha: date | None = None
    tipo: ExchangeRateType | None = None
    valor: float | None = None

    @field_validator("valor")
    @classmethod
    def valor_positivo(cls, valor: float | None) -> float | None:
        return _validar_cotizacion(valor)


class ExchangeRateOut(ExchangeRateBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
