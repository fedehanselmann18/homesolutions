import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.common import TimestampOut


def _grupo_limpio(valor: str | None) -> str | None:
    """Sin espacios de más; vacío = sin grupo (suma por su nombre)."""
    if valor is None:
        return None
    limpio = " ".join(valor.split())
    return limpio or None


class TaxBase(BaseModel):
    nombre: str
    # Porcentaje (21 = 21 %). None: el monto se tipea a mano.
    alicuota: float | None = Field(default=None, gt=0, le=100)
    # Cómo suma en el Análisis ("IVA"). None: suma por su nombre.
    grupo: str | None = Field(default=None, max_length=50)

    _limpiar_grupo = field_validator("grupo")(_grupo_limpio)


class TaxCreate(TaxBase):
    pass


class TaxUpdate(BaseModel):
    nombre: str | None = None
    alicuota: float | None = Field(default=None, gt=0, le=100)
    grupo: str | None = Field(default=None, max_length=50)

    _limpiar_grupo = field_validator("grupo")(_grupo_limpio)


class TaxOut(TaxBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
