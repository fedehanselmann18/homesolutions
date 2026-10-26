"""
Modelos de SQLAlchemy para HomeSolutions.

Convenciones:
- Todos los PK son UUID.
- Los campos "tipo select" (estado, condicion_pago, etc.) son String simple,
  sin Enum/CHECK — la validación de esos valores la maneja el front (ya
  definido así en el modelado con Agus). Excepción: tipo_factura, que es una
  lista configurable desde Ajustes (TipoFactura) y guarda el *código* del
  tipo con FK a tipos_factura.codigo (RESTRICT).
- precio_total_ars/_usd de Compra NO se guardan: son precio_neto + impuestos
  +- notas. precio_neto_ars SÍ se carga a mano (puede haber descuentos/redondeos
  que no coincidan exacto con la suma del detalle — eso se valida en el
  service, no se fuerza en el modelo).
- Doble moneda: nombre pelado (monto, precio,
  precio_unitario) = una sola moneda, pesos. Sufijo _ars/_usd = doble
  registro, las dos cifras persistidas con la cotización congelada del
  movimiento (CotizacionCongeladaMixin).
- El rol de Usuario (admin/lectura) es un dato de la tabla; el chequeo de
  permisos real se hace en el service layer contra el JWT, no acá.
- Todas las tablas tienen fecha_creacion/fecha_actualizacion AUTOMÁTICAS
  (auditoría de sistema) además de los campos de fecha "de negocio" que ya
  cargás a mano (fecha, fecha_inicio) — son cosas distintas, no se pisan.
- Reglas de borrado (ondelete): CASCADE en todo lo que no puede existir sin
  su padre (detalle, impuestos aplicados, comprobantes, fases de un proyecto,
  compras de una fase). RESTRICT en catálogos referenciados desde historial
  financiero (proveedor, producto, usuario, impuesto) para no perder
  trazabilidad. SET NULL en Gasto.fase_id, porque el Gasto sigue perteneciendo
  al Proyecto aunque se borre la Fase.

Ajustá el import de `Base` a como esté armado tu database.py.
"""

from app.db.models.audit_log import (  # noqa: F401
    AuditLog,
)
from app.db.models.base import (  # noqa: F401
    FrozenExchangeRateMixin,
    TimestampMixin,
    _ajuste_notas,
    uuid_pk,
)
from app.db.models.category import (  # noqa: F401
    Category,
    ExpenseCategory,
)
from app.db.models.client_payment import (  # noqa: F401
    ClientPayment,
    ClientPaymentNote,
    ClientPaymentReceipt,
)
from app.db.models.default_phase import (  # noqa: F401
    DefaultPhase,
)
from app.db.models.exchange_rate import (  # noqa: F401
    ExchangeRate,
)
from app.db.models.expense import (  # noqa: F401
    Expense,
    ExpenseReceipt,
    expense_category,
)
from app.db.models.invoice_type import (  # noqa: F401
    InvoiceType,
)
from app.db.models.payment import (  # noqa: F401
    PaymentCondition,
    PaymentInstallment,
    PaymentMethod,
    _condicion_contado,
)
from app.db.models.product import (  # noqa: F401
    Product,
    product_category,
)
from app.db.models.project import (  # noqa: F401
    Phase,
    Project,
)
from app.db.models.purchase import (  # noqa: F401
    Purchase,
    PurchaseItem,
    PurchaseReceipt,
    PurchaseTax,
)
from app.db.models.purchase_note import (  # noqa: F401
    PurchaseNote,
    PurchaseNoteItem,
    PurchaseNoteTax,
    validar_integridad_nota_compra,
)
from app.db.models.setting import (  # noqa: F401
    Setting,
)
from app.db.models.supplier import (  # noqa: F401
    Supplier,
)
from app.db.models.tax import (  # noqa: F401
    Tax,
)
from app.db.models.user import (  # noqa: F401
    AuthorizedUser,
    LoginAttempt,
    RevokedRefreshToken,
    User,
)
