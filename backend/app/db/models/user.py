import uuid
from datetime import datetime

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    Boolean,
    DateTime,
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk


class User(TimestampMixin, Base):
    __tablename__ = "usuarios"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre_usuario: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False, default="admin")  # "admin" | "lectura"
    # Baja temporal sin borrar la cuenta (la borraría de verdad rompería el
    # historial: RESTRICT en todo lo que referencia usuario). Una cuenta
    # inactiva no puede loguearse ni sostener una sesión ya abierta -- ver
    # login() en api/authentication.py y resolver_usuario_vigente en auth/oauth2.py.
    # Solo la cuenta "Manager" la puede prender/apagar.
    activo: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    # "Visto por última vez": se actualiza en
    # resolver_usuario_vigente (auth/oauth2.py) con throttle -- no en cada
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


class AuthorizedUser(TimestampMixin, Base):
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
    revocar_autorizacion en app/api/users.py).
    """

    __tablename__ = "usuarios_autorizados"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre_usuario: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False)  # "admin" | "lectura"


class LoginAttempt(Base):
    """
    Logins fallidos seguidos de cada cuenta y hasta cuándo está bloqueada
    (ver app/login_attempts.py): el freno contra fuerza bruta POR CUENTA, que
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


class RevokedRefreshToken(Base):
    """
    Refresh tokens dados de baja con /auth/logout, por su claim "jti" (ver
    auth/oauth2.py). Sin esto, cerrar sesión solo borraba la cookie del
    browser: una copia robada del token seguía sirviendo hasta vencer (7 días).

    Lista negra y no lista blanca de sesiones: solo crece con los logouts, y
    las filas vencidas se limpian solas en el próximo logout (expira_en =
    el "exp" del token; pasado eso el token ya no sirve de todos modos).
    """

    __tablename__ = "refresh_tokens_revocados"

    jti: Mapped[str] = mapped_column(String(64), primary_key=True)
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
