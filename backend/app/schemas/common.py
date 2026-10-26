from datetime import datetime
from typing import Literal

from pydantic import BaseModel, field_validator


class TimestampOut(BaseModel):
    fecha_creacion: datetime
    fecha_actualizacion: datetime


# Mismo set que models.EXCHANGE_RATE_TYPES. Literal y no str (a diferencia del resto
# de los "tipo select"): con qué dólar se congela la plata no es una etiqueta
# libre, y un valor inválido tiene que frenarse acá con un 422.
ExchangeRateType = Literal["oficial", "blue", "otro"]


def _validar_cotizacion(valor: float | None) -> float | None:
    """Pesos por dólar: tiene que ser > 0. Un cero dividiría por cero al
    congelar el USD y un negativo no significa nada. None pasa (campo
    opcional en los Update o en el proyecto)."""
    if valor is not None and valor <= 0:
        raise ValueError("La cotización del dólar tiene que ser mayor a 0")
    return valor


class FrozenExchangeRateIn(BaseModel):
    """
    Lo que todo movimiento de plata manda al crearse: con qué dólar se cargó.
    Las DOS cifras no viajan acá: el front manda solo la que se tipea (ARS en
    compras/gastos, USD en cobros) y la otra la calcula el backend siempre --
    si el front igual la mandara, Pydantic la descarta (no es un campo de
    estos schemas), así que no hay forma de pisar el congelado desde afuera.
    """

    cotizacion_dolar: float
    tipo_cambio: ExchangeRateType

    @field_validator("cotizacion_dolar")
    @classmethod
    def cotizacion_positiva(cls, valor: float) -> float:
        return _validar_cotizacion(valor)


class FrozenExchangeRateUpdate(BaseModel):
    """Versión opcional para los PUT parciales: cambiar la cotización de un
    movimiento ya cargado (ej. se tipeó mal) recalcula su cifra congelada."""

    cotizacion_dolar: float | None = None
    tipo_cambio: ExchangeRateType | None = None

    @field_validator("cotizacion_dolar")
    @classmethod
    def cotizacion_positiva(cls, valor: float | None) -> float | None:
        return _validar_cotizacion(valor)


class FrozenExchangeRateOut(BaseModel):
    cotizacion_dolar: float
    tipo_cambio: str
