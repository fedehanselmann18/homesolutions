"""
Modelos de SQLAlchemy para HomeSolutions.

Convenciones:
- Todos los PK son UUID.
- Los campos "tipo select" (estado, tipo_factura, condicion_pago, etc.) son
  String simple, sin Enum/CHECK — la validación de esos valores la maneja
  el front (ya definido así en el modelado con Agus).
- precio_total de Compra NO se guarda: es precio_neto + suma de sus impuestos.
  precio_neto SÍ se carga a mano (puede haber descuentos/redondeos que no
  coincidan exacto con la suma del detalle — eso se valida en el service,
  no se fuerza en el modelo).
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
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Table,
    UniqueConstraint,
    func,
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

    NO uses esto para secretos: SECRET_KEY ni las credenciales de DB/R2 se
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

# Tipos de dólar con los que se puede cargar un movimiento (ver
# docs/PLAN_TIPO_CAMBIO.md, decisión #3). A diferencia del resto de los
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
    # Numeric(12,4): aguanta 1487.3456 con margen (ver PLAN_TIPO_CAMBIO.md, 6.6).
    valor: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)


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
    precio_acordado_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

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
    fecha_en_curso_desde: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

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


class Impuesto(TimestampMixin, Base):
    __tablename__ = "impuestos"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)


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


class Compra(TimestampMixin, Base):
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
    precio_neto: Mapped[float] = mapped_column(
        Numeric(12, 2), nullable=False
    )  # sin impuestos, se carga a mano
    tipo_factura: Mapped[str] = mapped_column(String(30), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    condicion_pago: Mapped[str] = mapped_column(String(30), nullable=False)
    estado_pago: Mapped[str] = mapped_column(String(20), nullable=False)  # pendiente/pagado
    estado_envio: Mapped[str] = mapped_column(String(20), nullable=False)  # pedido/entregado

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
    def precio_total(self) -> float:
        """
        precio_neto + suma de todos los impuestos aplicados - notas de crédito
        + notas de débito (ver NotaCompra). No se persiste.

        B-04: requiere que impuestos_aplicados y notas vengan eager-loaded
        (ver joinedload(Compra.impuestos_aplicados) y
        joinedload(Compra.notas) en routes/compras.py). Si no, cada acceso
        a self.impuestos_aplicados/self.notas dispara una query aparte por
        Compra (N+1) EN SILENCIO -- SQLAlchemy no avisa, simplemente hace
        lazy load fila por fila. detalle NO hace falta para ESTE cálculo
        (sí lo usan categorias/tipos_compra, más abajo).
        """
        notas_credito = sum(float(n.monto) for n in self.notas if n.tipo == "nota_credito")
        notas_debito = sum(float(n.monto) for n in self.notas if n.tipo == "nota_debito")
        return (
            float(self.precio_neto)
            + sum(float(ci.monto) for ci in self.impuestos_aplicados)
            - notas_credito
            + notas_debito
        )

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
    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    compra: Mapped["Compra"] = relationship(back_populates="impuestos_aplicados")
    impuesto: Mapped["Impuesto"] = relationship()


class ComprobanteCompra(TimestampMixin, Base):
    """Archivo adjunto a una Compra (factura, remito...). Sin plata propia:
    para movimientos de cuenta corriente (nota de crédito/débito) ver NotaCompra."""

    __tablename__ = "comprobantes_compra"

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    compra: Mapped["Compra"] = relationship(back_populates="comprobantes")


class NotaCompra(TimestampMixin, Base):
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
      libre, se valida en el front (mismo criterio que tipo_factura). Solo
      nota_credito admite "devolucion_producto".
    - tipo_factura: SIEMPRE obligatorio (factura A/B/C, remito, recibo, otro),
      sin importar tipo/origen -- el usuario pidió que toda nota, sea crédito
      o débito, quede etiquetada con el tipo de comprobante que la respalda.
    - detalles: líneas de producto devuelto, SOLO si origen="devolucion_producto"
      (ver NotaCompraDetalle). Una nota puede devolver varios productos de la
      misma compra a la vez.
    - impuestos_aplicados: impuestos que se suman a la devolución (ver
      NotaCompraImpuesto), mismo criterio que CompraImpuesto.
    - monto: totalizador FROZEN calculado en el momento de creación (suma de
      detalles + impuestos, o tipeado a mano si es acuerdo_comercial/otro/débito).
      No se recalcula después: si se borra un detalle o cambia el precio del
      producto, esta nota sigue reflejando lo que efectivamente se acreditó.
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
    tipo_factura: Mapped[str] = mapped_column(String(30), nullable=False)
    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
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
    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

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


class Gasto(TimestampMixin, Base):
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

    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    tipo_factura: Mapped[str] = mapped_column(String(30), nullable=False)

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


class Cobro(TimestampMixin, Base):
    __tablename__ = "cobros"

    id: Mapped[uuid.UUID] = uuid_pk()
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    tipo_factura: Mapped[str] = mapped_column(String(30), nullable=False)

    proyecto: Mapped["Proyecto"] = relationship(back_populates="cobros")
    usuario: Mapped["Usuario"] = relationship()
    comprobantes: Mapped[list["ComprobanteCobro"]] = relationship(
        back_populates="cobro", cascade="all, delete-orphan"
    )
    # Cuenta corriente de este cobro con el "cliente" (Proyecto): notas de
    # crédito/débito. Mismo criterio que Compra.notas, ver NotaCobro.
    notas: Mapped[list["NotaCobro"]] = relationship(back_populates="cobro", cascade="all, delete-orphan")

    @property
    def monto_neto(self) -> float:
        """
        monto - notas de crédito + notas de débito (ver NotaCobro). `monto`
        sigue siendo el bruto cargado a mano; esto es lo calculado, no se persiste.
        """
        notas_credito = sum(float(n.monto) for n in self.notas if n.tipo == "nota_credito")
        notas_debito = sum(float(n.monto) for n in self.notas if n.tipo == "nota_debito")
        return float(self.monto) - notas_credito + notas_debito


class ComprobanteCobro(TimestampMixin, Base):
    """Archivo adjunto a un Cobro (factura, recibo...). Para movimientos de
    cuenta corriente (nota de crédito/débito) ver NotaCobro."""

    __tablename__ = "comprobantes_cobro"

    id: Mapped[uuid.UUID] = uuid_pk()
    cobro_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cobros.id", ondelete="CASCADE"), nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    cobro: Mapped["Cobro"] = relationship(back_populates="comprobantes")


class NotaCobro(TimestampMixin, Base):
    """
    Movimiento de cuenta corriente con un "cliente" (Proyecto): nota de
    crédito o de débito. Mismo criterio que NotaCompra pero del lado Cobro --
    sin detalle_compra_id porque Cobro no tiene líneas de producto.
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
    tipo_factura: Mapped[str] = mapped_column(
        String(30), nullable=False
    )  # SIEMPRE obligatorio, ver NotaCompra
    monto: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha: Mapped[date] = mapped_column(nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    cobro: Mapped["Cobro"] = relationship(back_populates="notas")
    proyecto: Mapped["Proyecto"] = relationship()
    usuario: Mapped["Usuario"] = relationship()
