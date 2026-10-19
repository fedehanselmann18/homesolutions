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

import uuid
from datetime import date, datetime

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.db import Base


def uuid_pk() -> Mapped[uuid.UUID]:
    return mapped_column(primary_key=True, default=uuid.uuid4)


class TimestampMixin:
    """fecha_creacion/fecha_actualizacion automáticas, las pone la DB sola."""

    fecha_creacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ---------------------------------------------------------------------------
# Usuario
# ---------------------------------------------------------------------------


class Usuario(TimestampMixin, Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre_usuario: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False, default="admin")  # "admin" | "lectura"
    # Baja temporal sin borrar la cuenta (la borraría de verdad rompería el
    # historial: RESTRICT en todo lo que referencia usuario). Una cuenta
    # inactiva no puede loguearse ni sostener una sesión ya abierta -- ver
    # login() en routes/login.py y resolver_usuario_vigente en auth/oAuth2.py.
    # Solo la cuenta "Manager" la puede prender/apagar.
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    # "Visto por última vez": se actualiza en
    # resolver_usuario_vigente (auth/oAuth2.py) con throttle -- no en cada
    # request, alcanza con saber "activo hace poco". NULL para cuentas que
    # nunca hicieron un request autenticado desde que existe esta columna
    # (incluida cualquier cuenta ya creada antes de esta migración).
    #
    # OJO si tocás esto: el UPDATE que la pisa NO puede tocar
    # fecha_actualizacion (es el reloj de revocación de sesión, B-06, y
    # onupdate=func.now() se dispara en CUALQUIER UPDATE de la fila, incluso
    # uno que ni siquiera toca esa columna) -- si no se neutraliza a mano
    # (ver _registrar_actividad_si_corresponde), cada ping de actividad
    # invalidaría la sesión que lo está generando.
    ultima_actividad: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class UsuarioAutorizado(TimestampMixin, Base):
    """
    Whitelist de quién puede autoregistrarse en /registro y con qué rol
    (antes era la env var ROLES_PERMITIDOS_JSON, ver config.py): pasarlo a
    la base permite que la cuenta "Manager" sume o saque gente del equipo
    desde la app, sin editar el .env ni redeployar.

    Una fila acá es una invitación pendiente, no una cuenta: la cuenta
    (Usuario) recién existe cuando la persona se registra. Por eso la fila
    NO se borra al registrarse -- se sigue usando para saber con qué rol se
    autorizó a cada quien.

    "Manager" está en esta tabla (la sembró la migración e7b2f4c19a83) y su
    fila no se puede revocar: es lo que permite recrear la cuenta de
    mantenimiento desde /registro si se pierde la contraseña (ver
    revocar_autorizacion en routes/usuarios.py).
    """

    __tablename__ = "usuarios_autorizados"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre_usuario: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False)  # "admin" | "lectura"


class IntentoLogin(Base):
    """
    Logins fallidos seguidos de cada cuenta y hasta cuándo está bloqueada
    (ver app/intentos_login.py): el freno contra fuerza bruta POR CUENTA, que
    complementa el límite por IP de slowapi.

    Tabla aparte y no columnas en usuarios, a propósito: cualquier UPDATE a
    la fila del usuario dispara onupdate de fecha_actualizacion, que es el
    reloj de revocación de sesión (B-06) -- un atacante probando contraseñas
    desloguearía a la persona real en cada intento. Acá eso no puede pasar.

    Sin TimestampMixin por lo mismo que Auditoria: las fechas que importan son
    las propias (ultimo_fallo, bloqueado_hasta), no las de la fila.
    """

    __tablename__ = "intentos_login"

    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True
    )
    fallidos: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ultimo_fallo: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bloqueado_hasta: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class RefreshTokenRevocado(Base):
    """
    Refresh tokens dados de baja con /auth/logout, por su claim "jti" (ver
    auth/oAuth2.py). Sin esto, cerrar sesión solo borraba la cookie del
    browser: una copia robada del token seguía sirviendo hasta vencer (7 días).

    Lista negra y no lista blanca de sesiones: solo crece con los logouts, y
    las filas vencidas se limpian solas en el próximo logout (expira_en =
    el "exp" del token; pasado eso el token ya no sirve de todos modos).
    """

    __tablename__ = "refresh_tokens_revocados"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)


# ---------------------------------------------------------------------------
# Auditoría
# ---------------------------------------------------------------------------


class Auditoria(Base):
    """
    Rastro persistido de las acciones importantes: create/update/delete de
    Proyecto, Compra, Gasto y Cobro, más todo el mantenimiento de cuentas que
    hace "Manager" (ver app/audit.py y routes/usuarios.py).

    Hasta acá eso solo iba al logger del servidor, así que responder "quién
    borró esta compra" pedía entrar a los logs de Railway. Esta tabla es lo
    que hace esa pregunta contestable desde la propia app (GET /auditoria,
    solo "Manager").

    NO usa TimestampMixin a propósito: una fila de auditoría es inmutable --
    nunca se edita ni se toca después de insertada, así que
    fecha_actualizacion no significaría nada. Lo único que importa es
    creado_en, o sea CUÁNDO pasó lo que se está registrando.

    Tampoco se borra desde la app: no hay endpoint de delete. Si algún día
    hace falta recortar el historial, va como tarea de mantenimiento
    explícita, no como un botón.
    """

    __tablename__ = "auditoria"

    id: Mapped[uuid.UUID] = uuid_pk()
    # Quién hizo la acción. RESTRICT por el mismo criterio que el resto del
    # historial: una cuenta no se borra (se desactiva, ver Usuario.activo), y
    # menos todavía si dejó rastro acá.
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # "create" | "update" | "delete" para las entidades de negocio; para las
    # acciones de Manager es la frase corta que ya usaba el log ("desactivar",
    # "cambiar rol a admin", etc.).
    accion: Mapped[str] = mapped_column(String(50), nullable=False)
    # "Proyecto" | "Compra" | "Gasto" | "Cobro" | "Usuario" | "Autorizacion".
    tipo_recurso: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # String y SIN foreign key, a propósito: buena parte de estas filas
    # registran un borrado, así que el recurso ya no existe -- una FK haría
    # imposible insertar justo el caso que más interesa auditar. String
    # porque tampoco todo recurso_id es un UUID (una autorización que todavía
    # no se creó no tiene id).
    recurso_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Contexto extra libre (ej. sobre qué usuario se ejecutó una acción de
    # Manager). Opcional: la mayoría de las filas no lo necesitan.
    detalle: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    usuario: Mapped["Usuario"] = relationship()


# ---------------------------------------------------------------------------
# Configuración
# ---------------------------------------------------------------------------


class Configuracion(Base):
    """
    Valores de configuración editables desde la app (GET/PATCH /configuracion,
    solo "Manager"), clave/valor, con fallback automático a Settings/.env
    cuando la clave no tiene fila -- ver app/configuracion.py, que resuelve
    ese fallback, y CLAVES_CONFIGURABLES ahí para cuáles claves son estas.

    Mismo problema que resolvió la migración d5a3c1e88f42 con la whitelist de
    autoregistro (antes ROLES_PERMITIDOS_JSON): cambiar un valor no tiene que
    exigir editar el .env y redeployar. La diferencia es que acá "sin fila"
    es un estado normal y esperado (no todo el mundo pisa el default), así
    que no hay semilla: la tabla arranca vacía a propósito.

    NO uses esto para secretos: SECRET_KEY ni las credenciales de DB/bucket se
    migran acá (ver el comentario de CLAVES_CONFIGURABLES) -- una tabla es
    legible por cualquiera con acceso a la base, algo que un .env fuera del
    repo no es.
    """

    __tablename__ = "configuracion"

    clave: Mapped[str] = mapped_column(String(100), primary_key=True)
    valor: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


# ---------------------------------------------------------------------------
# Cotización del dólar
# ---------------------------------------------------------------------------

# Tipos de dólar con los que se puede cargar un movimiento). A diferencia del resto de los
# "tipo select" de este archivo, este SÍ se valida en el backend (Literal en
# schemas.py): define con qué cotización se congela plata, no es una etiqueta.
TIPOS_CAMBIO = ("oficial", "blue", "otro")


class Cotizacion(TimestampMixin, Base):
    """
    Histórico del dólar (pesos por dólar) por fecha y tipo. Es una FUENTE DE
    SUGERENCIA, no la verdad de ningún movimiento: el form de carga precarga
    de acá el valor del día (o el último cargado), y lo que vale es la
    cotización que quedó congelada en el movimiento (cotizacion_dolar en
    Compra, Gasto, Cobro y las notas). Editar o borrar una fila de esta tabla
    NO reescribe la historia de lo ya cargado.

    Una sola fila por (fecha, tipo): el dólar blue de un día es uno solo.
    """

    __tablename__ = "cotizaciones"
    __table_args__ = (UniqueConstraint("fecha", "tipo", name="uq_cotizacion_fecha_tipo"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    fecha: Mapped[date] = mapped_column(nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # oficial | blue | otro
    # Numeric(12,4): aguanta 1487.3456 con margen.
    valor: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)


class CotizacionCongeladaMixin:
    """
    La cotización con la que se cargó un movimiento de plata (compra, gasto,
    cobro, notas), copiada en el momento de la carga. Es la que vale para
    ese movimiento para siempre: una compra de marzo sigue valiendo lo que
    valió aunque después cambie el dólar o se edite la tabla cotizaciones.

    Convive con las DOS cifras persistidas del movimiento (sufijos _ars/_usd): una la tipea el
    usuario y la otra la calcula el backend con app/tipo_cambio.py.
    """

    cotizacion_dolar: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)  # pesos por dólar
    tipo_cambio: Mapped[str] = mapped_column(String(20), nullable=False)  # oficial | blue | otro


def _ajuste_notas(notas: list, campo: str) -> float:
    """Débito - crédito de una lista de notas (NotaCompra o NotaCobro), en la
    moneda que diga `campo` ("monto_ars" | "monto_usd")."""
    credito = sum(float(getattr(n, campo)) for n in notas if n.tipo == "nota_credito")
    debito = sum(float(getattr(n, campo)) for n in notas if n.tipo == "nota_debito")
    return debito - credito


# ---------------------------------------------------------------------------
# Proyecto / Fase
# ---------------------------------------------------------------------------


class Proyecto(TimestampMixin, Base):
    __tablename__ = "proyectos"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    direccion: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    estado: Mapped[str] = mapped_column(String(20), nullable=False)  # a_iniciar/en_curso/terminado
    # El precio se acuerda con el cliente en dólares. Su equivalente en pesos
    # NO se persiste: se calcula al leer con la última cotización cargada
    # ("cuánto vale hoy el contrato").
    precio_acordado_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # El dólar del día de la firma, como trazabilidad. Nullable y fuera de
    # toda cuenta: un proyecto cargado tiempo después puede no tenerlo.
    cotizacion_acordada: Mapped[float | None] = mapped_column(Numeric(12, 4))
    tipo_cambio_acordado: Mapped[str | None] = mapped_column(String(20))

    fases: Mapped[list["Fase"]] = relationship(back_populates="proyecto", cascade="all, delete-orphan")
    gastos: Mapped[list["Gasto"]] = relationship(back_populates="proyecto", cascade="all, delete-orphan")
    cobros: Mapped[list["Cobro"]] = relationship(back_populates="proyecto", cascade="all, delete-orphan")


class Fase(TimestampMixin, Base):
    __tablename__ = "fases"

    id: Mapped[uuid.UUID] = uuid_pk()
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(500))
    estado: Mapped[str] = mapped_column(String(20), nullable=False)  # por_empezar/en_curso/terminada/auditada
    # Número de orden de la fase dentro de SU proyecto (1, 2, 3...) -- lo
    # asigna solo el backend al crear (siguiente número libre para ese
    # proyecto) y se reacomoda para no dejar huecos al borrar una fase del
    # medio. No es global: cada proyecto tiene su propia numeración 1..N.
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Desde cuándo está "en_curso" esta fase, para poder mostrar "hace X
    # días" de forma correcta. A propósito NO se usa fecha_actualizacion
    # para esto: ese campo se pisa con CUALQUIER edición de la fase (nombre,
    # descripción, etc.), no solo con el cambio de estado, así que "en curso
    # hace 0 días" aparecía cada vez que se tocaba algo de una fase que ya
    # estaba en curso. Se pone en None cuando la fase sale de en_curso.
    # Es una FECHA (oct 2026), no un instante: la elige el usuario al pasarla
    # a en curso, o es la del primer movimiento que la arrancó. Antes era el
    # momento en que se cargaba, y cargar una compra vieja dejaba la fase "en
    # curso desde hoy".
    fecha_en_curso_desde: Mapped[date | None] = mapped_column()

    proyecto: Mapped["Proyecto"] = relationship(back_populates="fases")
    # Compra NO puede existir sin Fase -> se borra en cascada junto con ella (ver Compra.fase_id).
    compras: Mapped[list["Compra"]] = relationship(back_populates="fase", cascade="all, delete-orphan")
    # Gasto SÍ puede existir sin Fase (sigue perteneciendo al Proyecto) -> no se borra, se desvincula.
    gastos: Mapped[list["Gasto"]] = relationship(back_populates="fase")


# ---------------------------------------------------------------------------
# Proveedor / Producto / Categorias / Impuesto (catálogos)
# ---------------------------------------------------------------------------


class Proveedor(TimestampMixin, Base):
    __tablename__ = "proveedores"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    # Opcional: hay proveedores (distribuidoras chicas, comercios de barrio)
    # de los que no se tiene el CUIT, y no poder cargarlos por eso no tiene
    # sentido -- el dato fiscal se completa después si aparece.
    cuit: Mapped[str | None] = mapped_column(String(20))
    direccion: Mapped[str | None] = mapped_column(String(255))
    telefono: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(150))

    # Si el proveedor no tiene compras cargadas, borrarlo se lleva su catálogo.
    # Si tiene compras, Compra.proveedor_id (RESTRICT) va a impedir el borrado antes de llegar acá.
    productos: Mapped[list["Producto"]] = relationship(
        back_populates="proveedor", cascade="all, delete-orphan"
    )


class Categoria(TimestampMixin, Base):
    """Categoría compartida entre Producto y Compra (Aires, Cafeteras, Cables...)."""

    __tablename__ = "categorias"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # mano_obra/equipo/materiales


class CategoriaGasto(TimestampMixin, Base):
    """Categoría propia de Gasto (Flete, Almuerzo, Gastos bancarios...)."""

    __tablename__ = "categorias_gasto"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


class FasePredeterminada(TimestampMixin, Base):
    """Nombre sugerido para una fase (Relevamiento y anteproyecto, Montaje
    de unidades interiores...): son las opciones del select del modal de
    fase. NO hay FK desde Fase -- la fase guarda el nombre como texto, así
    que se puede escribir uno a mano que no esté acá, y renombrar o borrar
    una predeterminada no toca las fases ya creadas."""

    __tablename__ = "fases_predeterminadas"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    # Posición en el select (1, 2, 3...): las de fábrica siguen el orden
    # natural de una obra; una nueva va al final (ver routes/fases_predeterminadas.py).
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class TipoFactura(TimestampMixin, Base):
    """Tipo de comprobante (Factura A, Remito, Factura interna...): las
    opciones del select de compras, gastos, cobros y notas. Se administran
    desde Ajustes.

    Los movimientos guardan el `codigo` (no el id) con FK RESTRICT: renombrar
    cambia la etiqueta en todo el historial sin tocar los movimientos, y no
    se puede borrar un tipo en uso. El código se arma del nombre al crear y
    no cambia nunca (ver app/tipos_factura.py)."""

    __tablename__ = "tipos_factura"

    id: Mapped[uuid.UUID] = uuid_pk()
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # Posición en el select; uno nuevo va al final ("Otros" igual sale último,
    # ver app/tipos_factura.py).
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)


class MedioPago(TimestampMixin, Base):
    """Cómo se paga una compra o un gasto (efectivo, transferencia...): las
    opciones del control «Medio de pago». Se administran desde Ajustes.

    Igual que TipoFactura: los movimientos guardan el `codigo` con FK
    RESTRICT, y el código sale del nombre al crear y no cambia. Diferencia:
    no hay ninguno protegido, y uno con movimientos se desactiva (`activo`)
    en vez de borrarse: no aparece al cargar pero se sigue viendo bien en los
    movimientos viejos (ver app/medios_pago.py)."""

    __tablename__ = "medios_pago"

    id: Mapped[uuid.UUID] = uuid_pk()
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")


def _condicion_contado(context):
    """Default de condicion_pago_id: «Contado». Las rutas lo ponen siempre
    (con sus plazos); esto cubre lo que se crea directo con el ORM (scripts,
    tests), que si no chocaría contra el NOT NULL."""
    return context.connection.execute(
        text("SELECT id FROM condiciones_pago WHERE protegido ORDER BY orden LIMIT 1")
    ).scalar()


class CondicionPago(TimestampMixin, Base):
    """Cuándo se paga una compra o un gasto: «Contado» (sin plazos: un solo
    pago el día de la factura), «30 días» ([30]), «30/60 días» ([30, 60]: mitad
    y mitad)... Se arman en Ajustes. Los días cuentan desde la fecha del
    movimiento. «Contado» (protegido) no se borra ni cambia sus días: es el
    default de los gastos."""

    __tablename__ = "condiciones_pago"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # Lista de días ordenada, sin repetidos: [] = contado, [30, 60] = dos plazos.
    dias: Mapped[list[int]] = mapped_column(JSONB, nullable=False, default=list)
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    protegido: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)


class PlazoPago(TimestampMixin, Base):
    """Un pago de una compra o de un gasto según su condición (30/60 días =
    dos plazos). En pesos, como su movimiento; en dólares se convierte con la
    cotización congelada del movimiento (no tiene USD propio). Lo pendiente
    se reparte solo cuando cambia el total (ver app/plazos.py). Pertenece a
    una compra O a un gasto, nunca a los dos (CHECK)."""

    __tablename__ = "plazos_pago"
    __table_args__ = (
        CheckConstraint("(compra_id IS NULL) <> (gasto_id IS NULL)", name="ck_plazos_pago_compra_o_gasto"),
    )

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("compras.id", ondelete="CASCADE"), nullable=True, index=True
    )
    gasto_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("gastos.id", ondelete="CASCADE"), nullable=True, index=True
    )
    numero: Mapped[int] = mapped_column(Integer, nullable=False)  # 1, 2, 3... en orden de vencimiento
    dias: Mapped[int] = mapped_column(Integer, nullable=False)  # 0 = contado / ajuste del día
    fecha_vencimiento: Mapped[date] = mapped_column(nullable=False, index=True)
    monto: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    pagado: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    fecha_pago: Mapped[date | None] = mapped_column(nullable=True)

    compra: Mapped["Compra | None"] = relationship(back_populates="plazos")
    gasto: Mapped["Gasto | None"] = relationship(back_populates="plazos")


class Impuesto(TimestampMixin, Base):
    """IVA, percepciones, IIBB... (se arman en Ajustes).

    - alicuota: porcentaje fijo (21.00, 10.50). Si está, el front calcula el
      monto sobre el neto (y Agus lo puede sobrescribir para igualar el
      redondeo de la factura). Sin alícuota, el monto se tipea a mano.
    - grupo: cómo suma en el Análisis y el PDF ("IVA" junta IVA 21 e IVA
      10,5). Sin grupo, suma por su nombre. Una compra o nota no puede tener
      dos impuestos del mismo grupo: una alícuota de IVA por factura.
    """

    __tablename__ = "impuestos"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    alicuota: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    grupo: Mapped[str | None] = mapped_column(String(50), nullable=True)


producto_categoria = Table(
    "producto_categoria",
    Base.metadata,
    Column("producto_id", ForeignKey("productos.id", ondelete="CASCADE"), primary_key=True),
    Column("categoria_id", ForeignKey("categorias.id", ondelete="RESTRICT"), primary_key=True),
)


class Producto(TimestampMixin, Base):
    __tablename__ = "productos"

    id: Mapped[uuid.UUID] = uuid_pk()
    proveedor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proveedores.id", ondelete="CASCADE"), nullable=False
    )
    marca: Mapped[str] = mapped_column(String(100), nullable=False)
    modelo: Mapped[str] = mapped_column(String(100), nullable=False)
    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # mano_obra/equipo/materiales
    # Precio de catálogo del proveedor. Es el valor que se propone solo al
    # elegir el producto en una Compra (DetalleCompra.precio_unitario) -- ese
    # campo de la compra queda como fue en el momento, no se actualiza en
    # cascada si el precio de catálogo cambia después.
    precio: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    proveedor: Mapped["Proveedor"] = relationship(back_populates="productos")
    categorias: Mapped[list["Categoria"]] = relationship(secondary=producto_categoria)


# ---------------------------------------------------------------------------
# Compra (+ detalle, categorías, impuestos, comprobantes)
# ---------------------------------------------------------------------------


class Compra(CotizacionCongeladaMixin, TimestampMixin, Base):
    __tablename__ = "compras"

    id: Mapped[uuid.UUID] = uuid_pk()
    # CORREGIDO: la Compra siempre pertenece a una Fase (CompraCreate.fase_id es obligatorio,
    # así lo definiste con Agus) -> CASCADE + not nullable, no SET NULL.
    fase_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("fases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # RESTRICT: no se puede borrar un proveedor/usuario si tiene compras -> se pierde trazabilidad.
    proveedor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proveedores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    # Sin impuestos. Se carga en pesos; el USD lo congela el backend con
    # cotizacion_dolar (ver app/tipo_cambio.py).
    precio_neto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    precio_neto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    # Cuándo se paga (Contado, 30/60 días...): arma los plazos (ver app/plazos.py).
    condicion_pago_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("condiciones_pago.id", ondelete="RESTRICT"), nullable=False, default=_condicion_contado
    )
    # Cómo se paga, opcional: código de un MedioPago (se administra en Ajustes).
    medio_pago: Mapped[str | None] = mapped_column(
        String(30), ForeignKey("medios_pago.codigo", ondelete="RESTRICT"), nullable=True
    )
    # pendiente/pagado. DERIVADO de los plazos (pagado = todos pagados): se
    # guarda para que filtros, Panel y PDF no tengan que recorrer plazos.
    estado_pago: Mapped[str] = mapped_column(String(20), nullable=False)
    estado_envio: Mapped[str] = mapped_column(String(20), nullable=False)  # pedido/entregado

    condicion_pago: Mapped["CondicionPago"] = relationship()
    plazos: Mapped[list["PlazoPago"]] = relationship(
        back_populates="compra", cascade="all, delete-orphan", order_by="PlazoPago.numero"
    )
    fase: Mapped["Fase"] = relationship(back_populates="compras")
    proveedor: Mapped["Proveedor"] = relationship()
    usuario: Mapped["Usuario"] = relationship()
    detalle: Mapped[list["DetalleCompra"]] = relationship(
        back_populates="compra",
        cascade="all, delete-orphan",
        # al leer, hacer selectinload(Compra.detalle).joinedload(DetalleCompra.producto).joinedload(Producto.categorias)
        # para que las properties de abajo no disparen N+1 queries
    )
    impuestos_aplicados: Mapped[list["CompraImpuesto"]] = relationship(
        back_populates="compra", cascade="all, delete-orphan"
    )
    comprobantes: Mapped[list["ComprobanteCompra"]] = relationship(
        back_populates="compra", cascade="all, delete-orphan"
    )
    # Cuenta corriente de esta compra con el proveedor: notas de crédito/débito,
    # cada una opcionalmente atada a una línea puntual de producto devuelto
    # (ver NotaCompra más abajo). Comprobante* es SOLO el archivo (factura,
    # remito...); Nota* es un movimiento de plata con su propio motivo/origen.
    notas: Mapped[list["NotaCompra"]] = relationship(back_populates="compra", cascade="all, delete-orphan")

    @property
    def impuestos_ars(self) -> float:
        return sum(float(ci.monto) for ci in self.impuestos_aplicados)

    @property
    def impuestos_usd(self) -> float:
        """Los impuestos no guardan USD propio: se pagan con la factura, así
        que heredan la cotización congelada de SU compra."""
        return sum(ci.monto_usd for ci in self.impuestos_aplicados)

    @property
    def precio_total_ars(self) -> float:
        """
        precio_neto_ars + impuestos - notas de crédito + notas de débito (ver
        NotaCompra). No se persiste.

        B-04: requiere que impuestos_aplicados y notas vengan eager-loaded
        (ver joinedload(Compra.impuestos_aplicados) y
        joinedload(Compra.notas) en routes/compras.py). Si no, cada acceso
        a self.impuestos_aplicados/self.notas dispara una query aparte por
        Compra (N+1) EN SILENCIO -- SQLAlchemy no avisa, simplemente hace
        lazy load fila por fila. detalle NO hace falta para ESTE cálculo
        (sí lo usan categorias/tipos_compra, más abajo).
        """
        return float(self.precio_neto_ars) + self.impuestos_ars + _ajuste_notas(self.notas, "monto_ars")

    @property
    def precio_total_usd(self) -> float:
        """
        Mismo criterio que precio_total_ars, pero cada nota suma con SU
        propio USD congelado: una nota tiene fecha propia, o sea otro dólar.
        Por eso esto NO es precio_total_ars / cotizacion_dolar.
        """
        return float(self.precio_neto_usd) + self.impuestos_usd + _ajuste_notas(self.notas, "monto_usd")

    @property
    def categorias(self) -> list["Categoria"]:
        """
        Categorías de la Compra, DERIVADAS de las categorías de sus productos
        (Compra -> DetalleCompra -> Producto -> Categoria). No se cargan a mano:
        si compraste aires y cafeteras en la misma Compra, esto devuelve ambas
        categorías sin que nadie tenga que tildarlas por separado.
        """
        vistas: dict[uuid.UUID, "Categoria"] = {}
        for linea in self.detalle:
            for cat in linea.producto.categorias:
                vistas[cat.id] = cat
        return list(vistas.values())

    @property
    def tipos_compra(self) -> list[str]:
        """
        Tipos (mano_obra/equipo/materiales) presentes en esta Compra, DERIVADOS
        del tipo de cada Producto en el detalle. Mismo principio que categorias:
        si en una misma Compra hay un producto de "equipo" y otro de "materiales",
        esto devuelve ambos en vez de forzarte a elegir uno solo para toda la Compra.
        """
        vistos: dict[str, None] = {}
        for linea in self.detalle:
            vistos[linea.producto.tipo] = None
        return list(vistos.keys())


class DetalleCompra(TimestampMixin, Base):
    """Línea de detalle: qué productos (y cantidad/precio) componen una Compra."""

    __tablename__ = "detalle_compra"

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    # RESTRICT: no se puede borrar un producto que ya fue comprado -> se pierde el historial.
    producto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False
    )
    cantidad: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    precio_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    compra: Mapped["Compra"] = relationship(back_populates="detalle")
    producto: Mapped["Producto"] = relationship()


class CompraImpuesto(TimestampMixin, Base):
    """
    Entidad asociativa Compra<->Impuesto: guarda cuánto de CADA impuesto se pagó.

    CORREGIDO:
    - PK simple (`id`) en vez de PK compuesta (id + compra_id + impuesto_id). Con las
      tres columnas como primary_key=True, `id` (UUID random) hacía que la restricción
      de unicidad nunca se cumpliera de verdad: se podía cargar el mismo impuesto dos
      veces en la misma Compra. Ahora la unicidad real se garantiza con el
      UniqueConstraint de abajo.
    - Se saca el campo `nombre`: es redundante con Impuesto.nombre (accedé vía la
      relación `impuesto.nombre`) y además rompía el insert, porque CompraImpuestoCreate
      nunca lo mandaba y la columna era NOT NULL sin default.
    """

    __tablename__ = "compra_impuesto"
    __table_args__ = (UniqueConstraint("compra_id", "impuesto_id", name="uq_compra_impuesto"),)

    id: Mapped[uuid.UUID] = uuid_pk()

    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    impuesto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("impuestos.id", ondelete="RESTRICT"), nullable=False
    )
    # Pesos (nombre pelado = una sola moneda).
    monto: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    compra: Mapped["Compra"] = relationship(back_populates="impuestos_aplicados")
    impuesto: Mapped["Impuesto"] = relationship()

    @property
    def monto_usd(self) -> float:
        """Hereda la cotización congelada de su compra. Sin redondear: se
        redondea al mostrar, así la suma de varios impuestos no acumula
        error de centavos."""
        return float(self.monto) / float(self.compra.cotizacion_dolar)


class ComprobanteCompra(TimestampMixin, Base):
    """Archivo adjunto a una Compra (factura, remito...). Sin plata propia:
    para movimientos de cuenta corriente (nota de crédito/débito) ver NotaCompra."""

    __tablename__ = "comprobantes_compra"

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    compra: Mapped["Compra"] = relationship(back_populates="comprobantes")


class NotaCompra(CotizacionCongeladaMixin, TimestampMixin, Base):
    """
    Movimiento de cuenta corriente con un Proveedor: nota de crédito o de
    débito. Por ahora siempre nace de adentro de una Compra puntual (CASCADE +
    not nullable), aunque proveedor_id queda denormalizado acá mismo (copiado
    de compra.proveedor_id al crearla) para el día que haya notas "sueltas"
    (acuerdo comercial sin compra de origen) -- ese día compra_id pasa a
    nullable/SET NULL y esta columna ya está lista.

    - tipo: "nota_credito" (a favor nuestro, resta de precio_total) |
      "nota_debito" (en contra nuestro, suma a precio_total).
    - origen: "devolucion_producto" | "acuerdo_comercial" | "otro" -- string
      libre, se valida en el front. Solo
      nota_credito admite "devolucion_producto".
    - tipo_factura: SIEMPRE obligatorio (código de un TipoFactura),
      sin importar tipo/origen -- el usuario pidió que toda nota, sea crédito
      o débito, quede etiquetada con el tipo de comprobante que la respalda.
    - detalles: líneas de producto devuelto, SOLO si origen="devolucion_producto"
      (ver NotaCompraDetalle). Una nota puede devolver varios productos de la
      misma compra a la vez.
    - impuestos_aplicados: impuestos que se suman a la devolución (ver
      NotaCompraImpuesto), mismo criterio que CompraImpuesto.
    - monto_ars: totalizador FROZEN calculado en el momento de creación (suma de
      detalles + impuestos, o tipeado a mano si es acuerdo_comercial/otro/débito).
      No se recalcula después: si se borra un detalle o cambia el precio del
      producto, esta nota sigue reflejando lo que efectivamente se acreditó.
    - monto_usd: monto_ars con la cotización de LA NOTA (no la de su compra:
      tiene fecha propia, o sea otro dólar). Lo congela el backend.
    """

    __tablename__ = "notas_compra"

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    proveedor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proveedores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # nota_credito | nota_debito
    origen: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )
    monto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    monto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)  # motivo
    fecha: Mapped[date] = mapped_column(nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)  # el comprobante que te dan

    compra: Mapped["Compra"] = relationship(back_populates="notas")
    proveedor: Mapped["Proveedor"] = relationship()
    usuario: Mapped["Usuario"] = relationship()
    detalles: Mapped[list["NotaCompraDetalle"]] = relationship(
        back_populates="nota", cascade="all, delete-orphan"
    )
    impuestos_aplicados: Mapped[list["NotaCompraImpuesto"]] = relationship(
        back_populates="nota", cascade="all, delete-orphan"
    )


class NotaCompraDetalle(TimestampMixin, Base):
    """
    Línea de producto devuelto dentro de una NotaCompra (origen="devolucion_producto").
    Varias líneas por nota = varios productos devueltos en un mismo movimiento.

    SET NULL en detalle_compra_id: si se borra la línea de compra original, la
    nota y su monto ya frozen siguen existiendo, solo se pierde la referencia
    exacta al producto (igual criterio que el detalle_compra_id anterior en NotaCompra).
    """

    __tablename__ = "notas_compra_detalle"

    id: Mapped[uuid.UUID] = uuid_pk()
    nota_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notas_compra.id", ondelete="CASCADE"), nullable=False
    )
    detalle_compra_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("detalle_compra.id", ondelete="SET NULL"), nullable=True
    )
    cantidad: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # precio_unitario frozen al momento de crear la nota (copiado de
    # DetalleCompra.precio_unitario): si el producto cambia de precio de
    # catálogo después, esta línea sigue reflejando lo que se acreditó.
    precio_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    nota: Mapped["NotaCompra"] = relationship(back_populates="detalles")
    detalle: Mapped["DetalleCompra | None"] = relationship()


def validar_integridad_nota_compra(nota: "NotaCompra", compra: "Compra") -> None:
    """
    NotaCompra.proveedor_id se denormaliza desde Compra.proveedor_id al
    crearla (ver routes/compras.py: crear_nota_compra) -- hasta acá era una
    copia implícita, sin nada que garantice que de verdad coincidan si algún
    código nuevo arma la nota distinto. Este chequeo lo hace explícito:
    levanta ValueError (el caller la traduce a 400) si por lo que sea no
    matchean, en vez de dejar que una nota quede asociada al proveedor
    equivocado en la cuenta corriente.
    """
    if nota.proveedor_id != compra.proveedor_id:
        raise ValueError(
            "La nota no puede quedar asociada a un proveedor distinto al de la compra que la originó"
        )


class NotaCompraImpuesto(TimestampMixin, Base):
    """Entidad asociativa NotaCompra<->Impuesto, mismo criterio que CompraImpuesto:
    impuestos que se suman al monto de una devolución de productos."""

    __tablename__ = "nota_compra_impuesto"
    __table_args__ = (UniqueConstraint("nota_id", "impuesto_id", name="uq_nota_compra_impuesto"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    nota_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notas_compra.id", ondelete="CASCADE"), nullable=False
    )
    impuesto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("impuestos.id", ondelete="RESTRICT"), nullable=False
    )
    # Pesos. Ya está sumado dentro de NotaCompra.monto_ars/monto_usd, así que
    # no necesita USD propio: si hiciera falta, hereda la cotización de su nota.
    monto: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    nota: Mapped["NotaCompra"] = relationship(back_populates="impuestos_aplicados")
    impuesto: Mapped["Impuesto"] = relationship()


# ---------------------------------------------------------------------------
# Gasto (+ categorías, comprobantes)
# ---------------------------------------------------------------------------

gasto_categoria = Table(
    "gasto_categoria",
    Base.metadata,
    Column("gasto_id", ForeignKey("gastos.id", ondelete="CASCADE"), primary_key=True),
    Column("categoria_gasto_id", ForeignKey("categorias_gasto.id", ondelete="RESTRICT"), primary_key=True),
)


class Gasto(CotizacionCongeladaMixin, TimestampMixin, Base):
    __tablename__ = "gastos"

    id: Mapped[uuid.UUID] = uuid_pk()
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # SET NULL: si se borra la Fase, el Gasto se desvincula pero sigue existiendo (es del Proyecto).
    fase_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("fases.id", ondelete="SET NULL"), nullable=True, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Se carga en pesos; el USD lo congela el backend (ver app/tipo_cambio.py).
    monto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    monto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )
    # Igual que en Compra: condición (arma los plazos), medio opcional y
    # estado derivado. Por default Contado y pagado: cargar un flete sigue
    # siendo un paso.
    condicion_pago_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("condiciones_pago.id", ondelete="RESTRICT"), nullable=False, default=_condicion_contado
    )
    medio_pago: Mapped[str | None] = mapped_column(
        String(30), ForeignKey("medios_pago.codigo", ondelete="RESTRICT"), nullable=True
    )
    estado_pago: Mapped[str] = mapped_column(String(20), nullable=False, default="pagado")

    condicion_pago: Mapped["CondicionPago"] = relationship()
    plazos: Mapped[list["PlazoPago"]] = relationship(
        back_populates="gasto", cascade="all, delete-orphan", order_by="PlazoPago.numero"
    )
    proyecto: Mapped["Proyecto"] = relationship(back_populates="gastos")
    fase: Mapped["Fase | None"] = relationship(back_populates="gastos")
    usuario: Mapped["Usuario"] = relationship()
    categorias: Mapped[list["CategoriaGasto"]] = relationship(secondary=gasto_categoria)
    comprobantes: Mapped[list["ComprobanteGasto"]] = relationship(
        back_populates="gasto", cascade="all, delete-orphan"
    )


class ComprobanteGasto(TimestampMixin, Base):
    __tablename__ = "comprobantes_gasto"

    id: Mapped[uuid.UUID] = uuid_pk()
    gasto_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("gastos.id", ondelete="CASCADE"), nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    gasto: Mapped["Gasto"] = relationship(back_populates="comprobantes")


# ---------------------------------------------------------------------------
# Cobro (+ comprobantes)
# ---------------------------------------------------------------------------


class Cobro(CotizacionCongeladaMixin, TimestampMixin, Base):
    __tablename__ = "cobros"

    id: Mapped[uuid.UUID] = uuid_pk()
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    # Al revés que Gasto/Compra: el cliente paga en dólares, así que el USD
    # se tipea y el ARS lo congela el backend (ver app/tipo_cambio.py).
    monto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    monto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )

    proyecto: Mapped["Proyecto"] = relationship(back_populates="cobros")
    usuario: Mapped["Usuario"] = relationship()
    comprobantes: Mapped[list["ComprobanteCobro"]] = relationship(
        back_populates="cobro", cascade="all, delete-orphan"
    )
    # Cuenta corriente de este cobro con el "cliente" (Proyecto): notas de
    # crédito/débito. Mismo criterio que Compra.notas, ver NotaCobro.
    notas: Mapped[list["NotaCobro"]] = relationship(back_populates="cobro", cascade="all, delete-orphan")

    @property
    def monto_neto_usd(self) -> float:
        """
        monto_usd - notas de crédito + notas de débito (ver NotaCobro).
        monto_usd sigue siendo el bruto cargado a mano; esto es lo calculado,
        no se persiste. Cada nota suma con SU cotización, no la del cobro.
        """
        return float(self.monto_usd) + _ajuste_notas(self.notas, "monto_usd")

    @property
    def monto_neto_ars(self) -> float:
        return float(self.monto_ars) + _ajuste_notas(self.notas, "monto_ars")


class ComprobanteCobro(TimestampMixin, Base):
    """Archivo adjunto a un Cobro (factura, recibo...). Para movimientos de
    cuenta corriente (nota de crédito/débito) ver NotaCobro."""

    __tablename__ = "comprobantes_cobro"

    id: Mapped[uuid.UUID] = uuid_pk()
    cobro_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cobros.id", ondelete="CASCADE"), nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    cobro: Mapped["Cobro"] = relationship(back_populates="comprobantes")


class NotaCobro(CotizacionCongeladaMixin, TimestampMixin, Base):
    """
    Movimiento de cuenta corriente con un "cliente" (Proyecto): nota de
    crédito o de débito. Mismo criterio que NotaCompra pero del lado Cobro --
    sin detalle_compra_id porque Cobro no tiene líneas de producto.

    Como el cobro, se tipea en USD (ajusta un precio acordado en dólares) y
    el ARS lo congela el backend con la cotización de la nota.
    """

    __tablename__ = "notas_cobro"

    id: Mapped[uuid.UUID] = uuid_pk()
    cobro_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cobros.id", ondelete="CASCADE"), nullable=False)
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="RESTRICT"), nullable=False
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False
    )

    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # nota_credito | nota_debito
    origen: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )  # ajuste_precio | acuerdo_comercial | otro
    # SIEMPRE obligatorio, ver NotaCompra
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )
    monto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    monto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    cobro: Mapped["Cobro"] = relationship(back_populates="notas")
    proyecto: Mapped["Proyecto"] = relationship()
    usuario: Mapped["Usuario"] = relationship()
