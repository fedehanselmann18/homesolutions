import uuid
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.common import ExchangeRateType, TimestampOut, _validar_cotizacion


class ProjectBase(BaseModel):
    nombre: str
    direccion: str
    fecha_inicio: date
    estado: str  # a_iniciar/en_curso/terminado
    precio_acordado_usd: float
    # Dólar del día de la firma: solo trazabilidad, no entra en ninguna
    # cuenta (ver models.Project). Opcional.
    cotizacion_acordada: float | None = None
    tipo_cambio_acordado: ExchangeRateType | None = None


class ProjectCreate(ProjectBase):
    @field_validator("cotizacion_acordada")
    @classmethod
    def cotizacion_positiva(cls, valor: float | None) -> float | None:
        return _validar_cotizacion(valor)


class ProjectUpdate(BaseModel):
    nombre: str | None = None
    direccion: str | None = None
    fecha_inicio: date | None = None
    estado: str | None = None
    precio_acordado_usd: float | None = None
    cotizacion_acordada: float | None = None
    tipo_cambio_acordado: ExchangeRateType | None = None

    @field_validator("cotizacion_acordada")
    @classmethod
    def cotizacion_positiva(cls, valor: float | None) -> float | None:
        return _validar_cotizacion(valor)


class ProjectOut(ProjectBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class PhaseBase(BaseModel):
    nombre: str
    descripcion: str | None = None
    estado: str  # por_empezar/en_curso/terminada/auditada


class PhaseCreate(PhaseBase):
    proyecto_id: uuid.UUID
    # Sólo cuenta si la fase queda en curso; sin ella, hoy.
    fecha_en_curso_desde: date | None = None


class PhaseUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    estado: str | None = None
    # Desde cuándo está en curso, elegida por el usuario. Al pasar a en
    # curso sin ella, hoy. Se ignora si la fase no queda en curso.
    fecha_en_curso_desde: date | None = None


class PhaseReorder(BaseModel):
    direccion: Literal["arriba", "abajo"]


class PhaseOut(PhaseBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proyecto_id: uuid.UUID
    # Número de fase dentro del proyecto (1, 2, 3...). Lo asigna el backend
    # solo, no se manda en Create/Update -- ver FaseReordenar para cambiarlo.
    orden: int
    # Desde cuándo está en curso (None si nunca lo estuvo o ya no lo está).
    # El front lo usa para "en curso hace X días" en vez de fecha_actualizacion.
    fecha_en_curso_desde: date | None = None


def _nombre_fase_limpio(valor: str | None) -> str | None:
    """Sin espacios de más, y nunca vacío: "  " no es un nombre de fase."""
    if valor is None:
        return None
    limpio = " ".join(valor.split())
    if not limpio:
        raise ValueError("El nombre no puede estar vacío")
    return limpio
