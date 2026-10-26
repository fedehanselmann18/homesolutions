import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.category import CategoryOut
from app.schemas.common import (
    FrozenExchangeRateIn,
    FrozenExchangeRateOut,
    FrozenExchangeRateUpdate,
    TimestampOut,
)
from app.schemas.payment import PaymentConditionOut, PaymentInstallmentOut
from app.schemas.tax import TaxOut


class PurchaseItemBase(BaseModel):
    producto_id: uuid.UUID
    cantidad: float
    precio_unitario: float


class PurchaseItemCreate(PurchaseItemBase):
    pass


class PurchaseItemOut(PurchaseItemBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class PurchaseTaxBase(BaseModel):
    impuesto_id: uuid.UUID
    monto: float


class PurchaseTaxCreate(PurchaseTaxBase):
    pass


class PurchaseTaxOut(PurchaseTaxBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: (
        uuid.UUID
    )  # CORREGIDO: faltaba exponer el id propio de la línea (ahora que ya no es parte de la PK compuesta)
    impuesto: TaxOut


class PurchaseReceiptOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    archivo_path: str


class PurchaseNoteItemOut(TimestampOut):
    """Línea de producto devuelto dentro de una NotaCompra (origen="devolucion_producto")."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    detalle_compra_id: uuid.UUID | None = None
    cantidad: float
    precio_unitario: float  # frozen al momento de crear la nota


class PurchaseNoteTaxOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    impuesto_id: uuid.UUID
    monto: float
    impuesto: TaxOut


class PurchaseNoteOut(TimestampOut):
    """Movimiento de cuenta corriente (nota de crédito/débito) de una Compra.
    El archivo (comprobante que te dan) se sube junto con el resto en el mismo
    endpoint multipart -- no hay NotaCompraCreate porque los campos no-archivo
    viajan como Form fields, no como JSON (ver app/api/purchases.py)."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    compra_id: uuid.UUID
    proveedor_id: uuid.UUID
    usuario_id: uuid.UUID
    tipo: str  # "nota_credito" | "nota_debito"
    origen: str | None = None  # "devolucion_producto" | "acuerdo_comercial" | "otro"
    tipo_factura: str  # SIEMPRE obligatorio: código de un TipoFactura
    monto_ars: float
    monto_usd: float  # congelado con la cotización de LA NOTA, no la de su compra
    cotizacion_dolar: float
    tipo_cambio: str
    descripcion: str
    fecha: date
    archivo_path: str
    detalles: list[PurchaseNoteItemOut] = []  # solo si origen="devolucion_producto"
    impuestos_aplicados: list[PurchaseNoteTaxOut] = []


class PurchaseBase(BaseModel):
    descripcion: str
    precio_neto_ars: float  # se tipea en pesos; el USD lo congela el backend
    tipo_factura: str
    fecha: date
    # Cómo se paga (efectivo/transferencia/cheque/tarjeta), opcional.
    medio_pago: str | None = Field(default=None, max_length=30)
    # pendiente/pagado. Al crear: "pagado" deja todos los plazos pagados. Al
    # editar: marca o desmarca todos (el badge de la lista). Después es
    # derivado de los plazos (ver app/domain/payment_terms.py).
    estado_pago: str
    estado_envio: str  # pedido/entregado


class PurchaseCreate(PurchaseBase, FrozenExchangeRateIn):
    fase_id: uuid.UUID
    proveedor_id: uuid.UUID
    # Cuándo se paga (arma los plazos). Sin mandarla: Contado.
    condicion_pago_id: uuid.UUID | None = None
    # CORREGIDO: se saca usuario_id — lo asigna el service desde el JWT (DatosToken.user_id),
    # nunca lo manda el front.
    detalle: list[PurchaseItemCreate] = []  # sus categorías se derivan de acá, no se eligen a mano
    impuestos: list[PurchaseTaxCreate] = []


class PurchaseUpdate(FrozenExchangeRateUpdate):
    fase_id: uuid.UUID | None = None
    proveedor_id: uuid.UUID | None = None
    # CORREGIDO: se saca usuario_id — no se reasigna la autoría de una Compra vía PATCH.
    descripcion: str | None = None
    precio_neto_ars: float | None = None
    tipo_factura: str | None = None
    fecha: date | None = None
    condicion_pago_id: uuid.UUID | None = None
    medio_pago: str | None = Field(default=None, max_length=30)
    estado_pago: str | None = None
    estado_envio: str | None = None
    # El modal de edición manda la compra entera: es un formulario, así que lo
    # que quedó en pantalla es lo que tiene que quedar guardado. Sin estos dos
    # campos Pydantic los descartaba en silencio y editar un producto o un
    # impuesto no hacía nada (peor todavía: precio_neto_ars SÍ se guardaba, así
    # que el neto terminaba sin coincidir con su propio detalle).
    #
    # Son opcionales y se distinguen de "no los mandé" por exclude_unset: quien
    # sólo togglea pago/envío no manda ninguno de los dos y su detalle queda
    # intacto. Mandar [] sí vacía la lista, que es lo que uno espera de un
    # formulario donde borraste todas las filas.
    detalle: list[PurchaseItemCreate] | None = None
    impuestos: list[PurchaseTaxCreate] | None = None


class PurchaseOut(PurchaseBase, FrozenExchangeRateOut, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fase_id: uuid.UUID
    proveedor_id: uuid.UUID
    usuario_id: uuid.UUID  # se mantiene en el Out: es dato legítimo de lectura (autoría)
    precio_neto_usd: float  # congelado por el backend
    # Calculados (neto + impuestos - NC + ND), no se cargan a mano. El USD
    # suma cada nota con SU cotización, por eso no es total_ars / cotización.
    precio_total_ars: float
    precio_total_usd: float
    categorias: list[CategoryOut] = []  # derivadas del detalle de productos, no se cargan a mano
    tipos_compra: list[str] = []  # derivados del tipo de cada producto en el detalle, no se cargan a mano
    detalle: list[PurchaseItemOut] = []
    impuestos_aplicados: list[PurchaseTaxOut] = []
    comprobantes: list[PurchaseReceiptOut] = []
    notas: list[PurchaseNoteOut] = []  # cuenta corriente: notas de crédito/débito
    condicion_pago_id: uuid.UUID
    condicion_pago: "PaymentConditionOut"
    plazos: list["PaymentInstallmentOut"] = []
