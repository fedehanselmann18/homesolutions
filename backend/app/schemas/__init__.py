"""
Pydantic schemas para HomeSolutions.

Convención por entidad:
- <Entidad>Base    -> campos compartidos entre Create y Out
- <Entidad>Create  -> lo que se manda al crear (sin id, sin campos calculados)
- <Entidad>Update  -> mismos campos que Create pero todos Optional (PATCH parcial)
- <Entidad>Out     -> lo que se devuelve (incluye id, timestamps y, donde aplica,
                       relaciones anidadas)

Los campos "tipo select" (estado, condicion_pago, etc.) se dejan como `str`
simple, sin Literal/Enum — la validación de esos valores la maneja el front,
mismo criterio que en los modelos de SQLAlchemy. tipo_factura también es
`str`, pero es el código de un TipoFactura de la base y lo validan las rutas
(ver app/domain/invoice_types.py).

TimestampOut: como TODOS los modelos de SQLAlchemy tienen fecha_creacion/
fecha_actualizacion automáticas (ver TimestampMixin en models/), TODOS los
Out heredan también de este mixin para que esos dos campos viajen en la
respuesta de la API. Create/Update NO lo llevan porque esos campos no se
cargan a mano, los pone la base sola.

CORREGIDO (respecto a la versión anterior):
- usuario_id se saca de Compra/Gasto/Cobro Create y Update: nunca viaja en el
  body. El service lo toma siempre de DatosToken.user_id (el JWT), así nadie
  puede cargar un movimiento "a nombre de otro" ni romper la regla de
  "solo quien lo creó puede editar/borrar". Se mantiene en los *Out porque
  ahí sí es un dato de lectura legítimo.
- CategoriaBase ahora incluye `tipo` (obligatorio en el modelo, faltaba acá).
- Se agrega CategoriaUpdate, que faltaba.
- CompraImpuestoBase/Create sin cambios: nunca mandaban `nombre`, así que ya
  estaban bien — el problema estaba del lado del modelo.
"""

from app.schemas.ai import (  # noqa: F401
    AICatalogProduct,
    AICatalogReading,
    AIReceiptExtraction,
    AISuggestedCatalogSupplier,
    AISuggestedItem,
    AISuggestedTax,
)
from app.schemas.audit_log import (  # noqa: F401
    AuditLogOut,
    AuditLogPage,
)
from app.schemas.auth import (  # noqa: F401
    MIN_PASSWORD_LENGTH,
    LoginResponse,
    TokenData,
)
from app.schemas.category import (  # noqa: F401
    CategoryBase,
    CategoryCreate,
    CategoryOut,
    CategoryUpdate,
    ExpenseCategoryBase,
    ExpenseCategoryCreate,
    ExpenseCategoryOut,
    ExpenseCategoryUpdate,
)
from app.schemas.client_payment import (  # noqa: F401
    ClientPaymentBase,
    ClientPaymentCreate,
    ClientPaymentNoteOut,
    ClientPaymentOut,
    ClientPaymentReceiptOut,
    ClientPaymentUpdate,
)
from app.schemas.common import (  # noqa: F401
    ExchangeRateType,
    FrozenExchangeRateIn,
    FrozenExchangeRateOut,
    FrozenExchangeRateUpdate,
    TimestampOut,
    _validar_cotizacion,
)
from app.schemas.default_phase import (  # noqa: F401
    DefaultPhaseBase,
    DefaultPhaseCreate,
    DefaultPhaseOut,
    DefaultPhaseUpdate,
)
from app.schemas.exchange_rate import (  # noqa: F401
    ExchangeRateBase,
    ExchangeRateCreate,
    ExchangeRateOut,
    ExchangeRateUpdate,
)
from app.schemas.expense import (  # noqa: F401
    ExpenseBase,
    ExpenseCreate,
    ExpenseOut,
    ExpenseReceiptOut,
    ExpenseUpdate,
)
from app.schemas.file_management import (  # noqa: F401
    BrokenFile,
    BucketObject,
    BucketReconciliation,
    PurgeOrphansRequest,
    PurgeOrphansResult,
)
from app.schemas.invoice_type import (  # noqa: F401
    InvoiceTypeBase,
    InvoiceTypeCreate,
    InvoiceTypeOut,
    InvoiceTypeUpdate,
    _nombre_tipo_factura_limpio,
)
from app.schemas.payment import (  # noqa: F401
    PaymentConditionBase,
    PaymentConditionCreate,
    PaymentConditionOut,
    PaymentConditionUpdate,
    PaymentInstallmentOut,
    PaymentInstallmentUpdate,
    PaymentMethodCreate,
    PaymentMethodOut,
    PaymentMethodUpdate,
    _dias_ordenados,
)
from app.schemas.product import (  # noqa: F401
    ProductBase,
    ProductCreate,
    ProductOut,
    ProductUpdate,
)
from app.schemas.project import (  # noqa: F401
    PhaseBase,
    PhaseCreate,
    PhaseOut,
    PhaseReorder,
    PhaseUpdate,
    ProjectBase,
    ProjectCreate,
    ProjectOut,
    ProjectUpdate,
    _nombre_fase_limpio,
)
from app.schemas.purchase import (  # noqa: F401
    PurchaseBase,
    PurchaseCreate,
    PurchaseItemBase,
    PurchaseItemCreate,
    PurchaseItemOut,
    PurchaseNoteItemOut,
    PurchaseNoteOut,
    PurchaseNoteTaxOut,
    PurchaseOut,
    PurchaseReceiptOut,
    PurchaseTaxBase,
    PurchaseTaxCreate,
    PurchaseTaxOut,
    PurchaseUpdate,
)
from app.schemas.setting import (  # noqa: F401
    SettingUpdate,
    SettingValue,
)
from app.schemas.supplier import (  # noqa: F401
    _CUIT_MULTIPLICADORES,
    _CUIT_REGEX,
    SupplierBase,
    SupplierCreate,
    SupplierOut,
    SupplierUpdate,
    _validar_cuit,
)
from app.schemas.tax import (  # noqa: F401
    TaxBase,
    TaxCreate,
    TaxOut,
    TaxUpdate,
    _grupo_limpio,
)
from app.schemas.user import (  # noqa: F401
    AuthorizedUserCreate,
    AuthorizedUserOut,
    UserBase,
    UserCreate,
    UserOut,
    UserResetPassword,
    UserRoleChange,
)
