import uuid

from pydantic import BaseModel, ConfigDict

from app.schemas.common import TimestampOut


class CategoryBase(BaseModel):
    nombre: str
    tipo: str  # CORREGIDO: faltaba — mano_obra/equipo/materiales, obligatorio en el modelo


class CategoryCreate(CategoryBase):
    pass


class CategoryUpdate(BaseModel):  # CORREGIDO: faltaba este schema por completo
    nombre: str | None = None
    tipo: str | None = None


class CategoryOut(CategoryBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class ExpenseCategoryBase(BaseModel):
    nombre: str


class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass


class ExpenseCategoryUpdate(BaseModel):
    nombre: str | None = None


class ExpenseCategoryOut(ExpenseCategoryBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
