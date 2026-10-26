import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.category import CategoryOut
from app.schemas.common import TimestampOut


class ProductBase(BaseModel):
    marca: str
    modelo: str
    tipo: str  # mano_obra/equipo/materiales
    precio: float  # precio de catálogo del proveedor


class ProductCreate(ProductBase):
    proveedor_id: uuid.UUID
    categoria_ids: list[uuid.UUID] = []


class ProductUpdate(BaseModel):
    marca: str | None = None
    modelo: str | None = None
    tipo: str | None = None
    precio: float | None = None
    categoria_ids: list[uuid.UUID] | None = None


class ProductOut(ProductBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proveedor_id: uuid.UUID
    categorias: list[CategoryOut] = []
