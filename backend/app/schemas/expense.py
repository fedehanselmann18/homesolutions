import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import ExpenseCategoryOut
from app.schemas.common import (
    FrozenExchangeRateIn,
    FrozenExchangeRateOut,
    FrozenExchangeRateUpdate,
    TimestampOut,
)
from app.schemas.payment import PaymentConditionOut, PaymentInstallmentOut


class ExpenseReceiptOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    archivo_path: str


class ExpenseBase(BaseModel):
    monto_ars: float  # se tipea en pesos; el USD lo congela el backend
    descripcion: str
    fecha: date
    tipo_factura: str


class ExpenseCreate(ExpenseBase, FrozenExchangeRateIn):
    proyecto_id: uuid.UUID
    fase_id: uuid.UUID | None = None
    # CORREGIDO: se saca usuario_id — lo asigna el service desde el JWT.
    categoria_gasto_ids: list[uuid.UUID] = []
    # Default Contado y pagado: cargar un flete sigue siendo un paso.
    condicion_pago_id: uuid.UUID | None = None
    medio_pago: str | None = Field(default=None, max_length=30)
    estado_pago: str = "pagado"


class ExpenseUpdate(FrozenExchangeRateUpdate):
    fase_id: uuid.UUID | None = None
    # CORREGIDO: se saca usuario_id.
    monto_ars: float | None = None
    descripcion: str | None = None
    fecha: date | None = None
    tipo_factura: str | None = None
    categoria_gasto_ids: list[uuid.UUID] | None = None
    condicion_pago_id: uuid.UUID | None = None
    medio_pago: str | None = Field(default=None, max_length=30)
    estado_pago: str | None = None  # marca o desmarca todos los plazos


class ExpenseOut(ExpenseBase, FrozenExchangeRateOut, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    monto_usd: float  # congelado por el backend
    proyecto_id: uuid.UUID
    fase_id: uuid.UUID | None = None
    usuario_id: uuid.UUID
    categorias: list[ExpenseCategoryOut] = []
    comprobantes: list[ExpenseReceiptOut] = []
    condicion_pago_id: uuid.UUID
    condicion_pago: "PaymentConditionOut"
    medio_pago: str | None = None
    estado_pago: str
    plazos: list["PaymentInstallmentOut"] = []
