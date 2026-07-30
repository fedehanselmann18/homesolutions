"""
Pydantic schemas para HomeSolutions.

Convención por entidad:
- <Entidad>Base    -> campos compartidos entre Create y Out
- <Entidad>Create  -> lo que se manda al crear (sin id, sin campos calculados)
- <Entidad>Update  -> mismos campos que Create pero todos Optional (PATCH parcial)
- <Entidad>Out     -> lo que se devuelve (incluye id, timestamps y, donde aplica,
                       relaciones anidadas)

Los campos "tipo select" (estado, tipo_factura, condicion_pago, etc.) se dejan
como `str` simple, sin Literal/Enum — la validación de esos valores la maneja
el front, mismo criterio que en los modelos de SQLAlchemy.

TimestampOut: como TODOS los modelos de SQLAlchemy tienen fecha_creacion/
fecha_actualizacion automáticas (ver TimestampMixin en models.py), TODOS los
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

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict
from typing import Optional


class TimestampOut(BaseModel):
    fecha_creacion: datetime
    fecha_actualizacion: datetime

# ---------------------------------------------------------------------------
# Token schemas
# ---------------------------------------------------------------------------
class RespuestaToken(BaseModel):
    access_token: str
    token_type: str

class DatosToken(BaseModel):
    user_id: Optional[uuid.UUID] = None


# ---------------------------------------------------------------------------
# Usuario
# ---------------------------------------------------------------------------

class UsuarioBase(BaseModel):
    nombre_usuario: str
    rol: str  # "admin" | "lectura"


class UsuarioCreate(UsuarioBase):
    password: str  # se hashea en el service, nunca se guarda en texto plano


class UsuarioUpdate(BaseModel):
    nombre_usuario: str | None = None
    rol: str | None = None
    password: str | None = None


class UsuarioOut(UsuarioBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


# ---------------------------------------------------------------------------
# Proyecto / Fase
# ---------------------------------------------------------------------------

class ProyectoBase(BaseModel):
    nombre: str
    direccion: str
    fecha_inicio: date
    estado: str  # a_iniciar/en_curso/terminado
    precio_acordado: float


class ProyectoCreate(ProyectoBase):
    pass


class ProyectoUpdate(BaseModel):
    nombre: str | None = None
    direccion: str | None = None
    fecha_inicio: date | None = None
    estado: str | None = None
    precio_acordado: float | None = None


class ProyectoOut(ProyectoBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)
    
    id: uuid.UUID


class FaseBase(BaseModel):
    nombre: str
    descripcion: str | None = None
    estado: str  # por_empezar/en_curso/terminada/auditada


class FaseCreate(FaseBase):
    proyecto_id: uuid.UUID


class FaseUpdate(BaseModel):
    nombre: str | None = None
    descripcion: str | None = None
    estado: str | None = None


class FaseOut(FaseBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proyecto_id: uuid.UUID


# ---------------------------------------------------------------------------
# Proveedor / Producto / Categorías / Impuesto
# ---------------------------------------------------------------------------

class ProveedorBase(BaseModel):
    nombre: str
    cuit: str
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorUpdate(BaseModel):
    nombre: str | None = None
    cuit: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None


class ProveedorOut(ProveedorBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class CategoriaBase(BaseModel):
    nombre: str
    tipo: str  # CORREGIDO: faltaba — mano_obra/equipo/materiales, obligatorio en el modelo


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaUpdate(BaseModel):  # CORREGIDO: faltaba este schema por completo
    nombre: str | None = None
    tipo: str | None = None


class CategoriaOut(CategoriaBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class CategoriaGastoBase(BaseModel):
    nombre: str


class CategoriaGastoCreate(CategoriaGastoBase):
    pass

class CategoriaGastoUpdate(BaseModel):
    nombre: str | None = None


class CategoriaGastoOut(CategoriaGastoBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class ImpuestoBase(BaseModel):
    nombre: str


class ImpuestoCreate(ImpuestoBase):
    pass

class ImpuestoUpdate(BaseModel):
    nombre: str | None = None


class ImpuestoOut(ImpuestoBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class ProductoBase(BaseModel):
    marca: str
    modelo: str
    tipo: str  # mano_obra/equipo/materiales
    precio: float  # precio de catálogo del proveedor


class ProductoCreate(ProductoBase):
    proveedor_id: uuid.UUID
    categoria_ids: list[uuid.UUID] = []


class ProductoUpdate(BaseModel):
    marca: str | None = None
    modelo: str | None = None
    tipo: str | None = None
    precio: float | None = None
    categoria_ids: list[uuid.UUID] | None = None


class ProductoOut(ProductoBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proveedor_id: uuid.UUID
    categorias: list[CategoriaOut] = []


# ---------------------------------------------------------------------------
# Compra (+ detalle, impuestos, comprobantes)
# ---------------------------------------------------------------------------

class DetalleCompraBase(BaseModel):
    producto_id: uuid.UUID
    cantidad: float
    precio_unitario: float


class DetalleCompraCreate(DetalleCompraBase):
    pass


class DetalleCompraOut(DetalleCompraBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID


class CompraImpuestoBase(BaseModel):
    impuesto_id: uuid.UUID
    monto: float


class CompraImpuestoCreate(CompraImpuestoBase):
    pass


class CompraImpuestoOut(CompraImpuestoBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID  # CORREGIDO: faltaba exponer el id propio de la línea (ahora que ya no es parte de la PK compuesta)
    impuesto: ImpuestoOut


class ComprobanteCompraOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    archivo_path: str


class NotaCompraDetalleOut(TimestampOut):
    """Línea de producto devuelto dentro de una NotaCompra (origen="devolucion_producto")."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    detalle_compra_id: uuid.UUID | None = None
    cantidad: float
    precio_unitario: float  # frozen al momento de crear la nota


class NotaCompraImpuestoOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    impuesto_id: uuid.UUID
    monto: float
    impuesto: ImpuestoOut


class NotaCompraOut(TimestampOut):
    """Movimiento de cuenta corriente (nota de crédito/débito) de una Compra.
    El archivo (comprobante que te dan) se sube junto con el resto en el mismo
    endpoint multipart -- no hay NotaCompraCreate porque los campos no-archivo
    viajan como Form fields, no como JSON (ver routes/compras.py)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    compra_id: uuid.UUID
    proveedor_id: uuid.UUID
    usuario_id: uuid.UUID
    tipo: str  # "nota_credito" | "nota_debito"
    origen: str | None = None  # "devolucion_producto" | "acuerdo_comercial" | "otro"
    tipo_factura: str  # SIEMPRE obligatorio (factura A/B/C, remito, recibo, otro)
    monto: float
    descripcion: str
    fecha: date
    archivo_path: str
    detalles: list[NotaCompraDetalleOut] = []  # solo si origen="devolucion_producto"
    impuestos_aplicados: list[NotaCompraImpuestoOut] = []


class CompraBase(BaseModel):
    descripcion: str
    precio_neto: float
    tipo_factura: str
    fecha: date
    condicion_pago: str
    estado_pago: str  # pendiente/pagado
    estado_envio: str  # pedido/entregado


class CompraCreate(CompraBase):
    fase_id: uuid.UUID
    proveedor_id: uuid.UUID
    # CORREGIDO: se saca usuario_id — lo asigna el service desde el JWT (DatosToken.user_id),
    # nunca lo manda el front.
    detalle: list[DetalleCompraCreate] = []  # sus categorías se derivan de acá, no se eligen a mano
    impuestos: list[CompraImpuestoCreate] = []
    # los comprobantes (archivos) se suben aparte, en un endpoint propio multipart/form-data


class CompraUpdate(BaseModel):
    fase_id: uuid.UUID | None = None
    proveedor_id: uuid.UUID | None = None
    # CORREGIDO: se saca usuario_id — no se reasigna la autoría de una Compra vía PATCH.
    descripcion: str | None = None
    precio_neto: float | None = None
    tipo_factura: str | None = None
    fecha: date | None = None
    condicion_pago: str | None = None
    estado_pago: str | None = None
    estado_envio: str | None = None


class CompraOut(CompraBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    fase_id: uuid.UUID
    proveedor_id: uuid.UUID
    usuario_id: uuid.UUID  # se mantiene en el Out: es dato legítimo de lectura (autoría)
    precio_total: float  # calculado (precio_neto + impuestos - NC + ND), no se carga a mano
    categorias: list[CategoriaOut] = []  # derivadas del detalle de productos, no se cargan a mano
    tipos_compra: list[str] = []  # derivados del tipo de cada producto en el detalle, no se cargan a mano
    detalle: list[DetalleCompraOut] = []
    impuestos_aplicados: list[CompraImpuestoOut] = []
    comprobantes: list[ComprobanteCompraOut] = []
    notas: list[NotaCompraOut] = []  # cuenta corriente: notas de crédito/débito


# ---------------------------------------------------------------------------
# Gasto (+ comprobantes)
# ---------------------------------------------------------------------------

class ComprobanteGastoOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    archivo_path: str


class GastoBase(BaseModel):
    monto: float
    descripcion: str
    fecha: date
    tipo_factura: str


class GastoCreate(GastoBase):
    proyecto_id: uuid.UUID
    fase_id: uuid.UUID | None = None
    # CORREGIDO: se saca usuario_id — lo asigna el service desde el JWT.
    categoria_gasto_ids: list[uuid.UUID] = []


class GastoUpdate(BaseModel):
    fase_id: uuid.UUID | None = None
    # CORREGIDO: se saca usuario_id.
    monto: float | None = None
    descripcion: str | None = None
    fecha: date | None = None
    tipo_factura: str | None = None
    categoria_gasto_ids: list[uuid.UUID] | None = None


class GastoOut(GastoBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proyecto_id: uuid.UUID
    fase_id: uuid.UUID | None = None
    usuario_id: uuid.UUID
    categorias: list[CategoriaGastoOut] = []
    comprobantes: list[ComprobanteGastoOut] = []


# ---------------------------------------------------------------------------
# Cobro (+ comprobantes)
# ---------------------------------------------------------------------------

class ComprobanteCobroOut(TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    archivo_path: str


class NotaCobroOut(TimestampOut):
    """Movimiento de cuenta corriente (nota de crédito/débito) de un Cobro.
    Mismo criterio que NotaCompraOut, sin detalle_compra_id (Cobro no tiene
    líneas de producto)."""
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cobro_id: uuid.UUID
    proyecto_id: uuid.UUID
    usuario_id: uuid.UUID
    tipo: str  # "nota_credito" | "nota_debito"
    origen: str | None = None  # "ajuste_precio" | "acuerdo_comercial" | "otro"
    tipo_factura: str  # SIEMPRE obligatorio, ver NotaCompraOut
    monto: float
    descripcion: str
    fecha: date
    archivo_path: str


class CobroBase(BaseModel):
    monto: float
    descripcion: str
    fecha: date
    tipo_factura: str


class CobroCreate(CobroBase):
    proyecto_id: uuid.UUID
    # CORREGIDO: se saca usuario_id — lo asigna el service desde el JWT.


class CobroUpdate(BaseModel):
    # CORREGIDO: se saca usuario_id.
    monto: float | None = None
    descripcion: str | None = None
    fecha: date | None = None
    tipo_factura: str | None = None


class CobroOut(CobroBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proyecto_id: uuid.UUID
    usuario_id: uuid.UUID
    monto_neto: float  # calculado (monto - NC + ND), no se carga a mano
    comprobantes: list[ComprobanteCobroOut] = []
    notas: list[NotaCobroOut] = []  # cuenta corriente: notas de crédito/débito