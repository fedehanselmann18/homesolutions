import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import TimestampOut
from app.schemas.project import _nombre_fase_limpio


class DefaultPhaseBase(BaseModel):
    nombre: str = Field(max_length=150)

    _limpiar_nombre = field_validator("nombre")(_nombre_fase_limpio)


class DefaultPhaseCreate(DefaultPhaseBase):
    pass


class DefaultPhaseUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=150)

    _limpiar_nombre = field_validator("nombre")(_nombre_fase_limpio)


class DefaultPhaseOut(DefaultPhaseBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    orden: int
