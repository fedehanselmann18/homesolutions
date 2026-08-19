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

import re
import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator

# XX-XXXXXXXX-X, con o sin guiones (los grupos son fijos: 2 dígitos de tipo,
# 8 de DNI/razón social, 1 verificador -- ver _validar_cuit).
_CUIT_REGEX = re.compile(r"^(\d{2})-?(\d{8})-?(\d{1})$")
_CUIT_MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]


def _validar_cuit(valor: str) -> str:
    """Valida formato (11 dígitos, con o sin guiones) y el dígito
    verificador con el algoritmo estándar de AFIP (módulo 11). Devuelve el
    valor tal cual lo mandó el cliente (con o sin guiones, no se normaliza)
    si es válido, o levanta ValueError con un mensaje claro si no."""
    coincidencia = _CUIT_REGEX.match(valor.strip())
    if not coincidencia:
        raise ValueError("El CUIT tiene que tener el formato XX-XXXXXXXX-X (11 dígitos, con o sin guiones)")

    digitos = "".join(coincidencia.groups())
    suma = sum(int(d) * m for d, m in zip(digitos[:10], _CUIT_MULTIPLICADORES))
    resto = suma % 11
    verificador_esperado = 11 - resto
    if verificador_esperado == 11:
        verificador_esperado = 0

    if verificador_esperado == 10 or int(digitos[10]) != verificador_esperado:
        raise ValueError("El CUIT no es válido (el dígito verificador no coincide)")

    return valor.strip()


class TimestampOut(BaseModel):
    fecha_creacion: datetime
    fecha_actualizacion: datetime


# ---------------------------------------------------------------------------
# Token schemas
# ---------------------------------------------------------------------------
class RespuestaLogin(BaseModel):
    """Body de POST /auth/login. El JWT en sí NO viaja acá -- ver comentario
    en routes/login.py sobre por qué (B-05: evitar que el token quede
    expuesto en logs/histories que sí capturan el body de la respuesta)."""

    message: str


class DatosToken(BaseModel):
    user_id: Optional[uuid.UUID] = None
    # Cuándo se emitió el JWT (claim "iat") -- ver revocación en
    # auth/oAuth2.py (B-06): un token con iat anterior a la última
    # modificación del usuario se trata como inválido.
    iat: Optional[datetime] = None


# ---------------------------------------------------------------------------
# Usuario
# ---------------------------------------------------------------------------


class UsuarioBase(BaseModel):
    nombre_usuario: str
    rol: str  # "admin" | "lectura"


class UsuarioCreate(UsuarioBase):
    password: str  # se hashea en el service, nunca se guarda en texto plano

    # Opcional: el rol REAL sale siempre de la whitelist (tabla
    # usuarios_autorizados, ver create_user), nunca de acá. El front ya no
    # lo manda -- no puede saberlo, porque /usuarios/opciones-registro
    # devuelve solo nombres para no filtrar quién es admin a cualquiera sin
    # sesión. Si un cliente igual lo manda y no coincide, se rechaza (400)
    # en vez de ignorarlo en silencio.
    rol: Optional[str] = None

    @field_validator("password")
    @classmethod
    def password_minima(cls, valor: str) -> str:
        if len(valor) < 8:
            raise ValueError("La contraseña tiene que tener al menos 8 caracteres")
        return valor


class UsuarioResetPassword(BaseModel):
    """
    Body de POST /usuarios/{user_id}/resetear-password: solo la contraseña
    nueva, que escribe a mano la cuenta "Manager" (ver requiere_manager en
    auth/oAuth2.py). Mismo mínimo de 8 caracteres que al crear la cuenta.
    """

    password: str

    @field_validator("password")
    @classmethod
    def password_minima(cls, valor: str) -> str:
        if len(valor) < 8:
            raise ValueError("La contraseña tiene que tener al menos 8 caracteres")
        return valor


class UsuarioCambioRol(BaseModel):
    """
    Body de PATCH /usuarios/{user_id}/rol (solo la cuenta "Manager").

    Literal en vez de str: Pydantic rechaza cualquier otro valor con un 422
    sin que haga falta un validator a mano, y de paso el rol inválido nunca
    llega a la capa de ruta.
    """

    rol: Literal["admin", "lectura"]


class UsuarioAutorizadoCreate(BaseModel):
    """
    Body de POST /usuarios/autorizados: sumar a alguien a la whitelist de
    autoregistro (ver models.UsuarioAutorizado).
    """

    nombre_usuario: str
    rol: Literal["admin", "lectura"]

    @field_validator("nombre_usuario")
    @classmethod
    def nombre_no_vacio(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El nombre de usuario no puede estar vacío")
        return limpio


class UsuarioAutorizadoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre_usuario: str
    rol: str
    # No es una columna: lo calcula el endpoint cruzando contra la tabla
    # usuarios, para que Manager vea de un vistazo quién ya se registró y
    # quién sigue pendiente (ver GET /usuarios/autorizados).
    ya_registrado: bool = False


class UsuarioUpdate(BaseModel):
    nombre_usuario: str | None = None
    rol: str | None = None
    password: str | None = None


class UsuarioOut(UsuarioBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Cuenta dada de baja temporalmente por "Manager" (ver models.Usuario).
    # El front lo usa para mostrar el estado en la lista de usuarios.
    activo: bool = True
    # Solo se completa en GET /usuarios/me (ver routes/usuarios.py). En el
    # resto de los endpoints que devuelven UsuarioOut queda None. Existe
    # porque en producción front (Vercel) y back (Railway) son dominios
    # distintos: el JS del front no puede leer la cookie csrf_token de otro
    # dominio, así que viaja acá una vez por sesión y el front la guarda en
    # memoria para reenviarla como header X-CSRF-Token.
    csrf_token: Optional[str] = None


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


class FaseReordenar(BaseModel):
    direccion: Literal["arriba", "abajo"]


class FaseOut(FaseBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    proyecto_id: uuid.UUID
    # Número de fase dentro del proyecto (1, 2, 3...). Lo asigna el backend
    # solo, no se manda en Create/Update -- ver FaseReordenar para cambiarlo.
    orden: int
    # Desde cuándo está en curso (None si nunca lo estuvo o ya no lo está).
    # El front lo usa para "en curso hace X días" en vez de fecha_actualizacion.
    fecha_en_curso_desde: datetime | None = None


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
    @field_validator("cuit")
    @classmethod
    def cuit_valido(cls, valor: str) -> str:
        return _validar_cuit(valor)


class ProveedorUpdate(BaseModel):
    nombre: str | None = None
    cuit: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None

    @field_validator("cuit")
    @classmethod
    def cuit_valido(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        return _validar_cuit(valor)


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

    id: (
        uuid.UUID
    )  # CORREGIDO: faltaba exponer el id propio de la línea (ahora que ya no es parte de la PK compuesta)
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


# ---------------------------------------------------------------------------
# IA (lectura automática de comprobantes)
# ---------------------------------------------------------------------------


class IADetalleSugerido(BaseModel):
    """
    Una línea de producto que la IA propone para el detalle de una Compra.
    Solo se sugiere si el producto pertenece al proveedor ya resuelto en la
    misma extracción (ver _validar_y_limpiar) -- precio_unitario NUNCA sale
    de acá: sigue siendo el precio de catálogo (Producto.precio), congelado
    al elegir el producto, igual que si lo cargaras a mano en ModalCompra.
    """

    producto_id: uuid.UUID
    cantidad: float


class IAImpuestoSugerido(BaseModel):
    """
    Una línea de impuesto (IVA, percepciones, retenciones...) que la IA leyó
    del comprobante. A diferencia de precio_unitario en IADetalleSugerido,
    acá `monto` SÍ sale directo de la factura -- es un importe de plata ya
    impreso ahí (no un id que haya que inventar), así que no hay el mismo
    riesgo que con matchear productos. impuesto_id solo se acepta si
    coincide con uno del catálogo que mandó el front (ver _validar_y_limpiar).
    """

    impuesto_id: uuid.UUID
    monto: float


class IAExtraccionComprobante(BaseModel):
    """
    Resultado de leer un comprobante (factura/remito/recibo) con Gemini, para
    prellenar ModalGasto/ModalCompra/ModalCobro (ver routes/ia.py).

    No se persiste nada acá -- es 100% para prellenar el formulario, el
    usuario siempre revisa y confirma con el submit normal antes de guardar.
    Los campos que no aplican al tipo de entidad pedido quedan en None (ej.
    Cobro no tiene fase/categoría/proveedor; Compra no tiene "monto" porque
    precio_neto se calcula solo a partir del detalle de productos, nunca se
    tipea a mano, ver ModalCompra.jsx).

    proveedor_id/fase_id/categoria_gasto_id solo se completan si coinciden
    EXACTO con un id de la lista que el front mandó en `contexto` -- si
    Gemini sugiere algo que no está en esa lista, se descarta a None y se
    agrega un aviso en `advertencias` en vez de guardar una referencia
    inventada (ver _validar_y_limpiar en app/ia/extractor.py). Mismo
    criterio para `detalle`: cada línea se descarta si el producto no existe
    en el catálogo que mandó el front o no pertenece al proveedor resuelto.
    """

    monto: float | None = None
    fecha: date | None = None
    tipo_factura: str | None = None
    descripcion: str | None = None
    proveedor_id: uuid.UUID | None = None
    fase_id: uuid.UUID | None = None
    categoria_gasto_id: uuid.UUID | None = None
    detalle: list[IADetalleSugerido] = []
    impuestos: list[IAImpuestoSugerido] = []
    advertencias: list[str] = []
