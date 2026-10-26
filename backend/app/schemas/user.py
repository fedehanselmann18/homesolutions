import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.auth import MIN_PASSWORD_LENGTH
from app.schemas.common import TimestampOut


class UserBase(BaseModel):
    nombre_usuario: str
    rol: str  # "admin" | "lectura"


class UserCreate(UserBase):
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
        if len(valor) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"La contraseña tiene que tener al menos {MIN_PASSWORD_LENGTH} caracteres")
        return valor


class UserResetPassword(BaseModel):
    """
    Body de POST /usuarios/{user_id}/resetear-password: solo la contraseña
    nueva, que escribe a mano la cuenta "Manager" (ver requiere_manager en
    auth/oauth2.py). Mismo mínimo (MIN_PASSWORD_LENGTH) que al crear la cuenta.
    """

    password: str

    @field_validator("password")
    @classmethod
    def password_minima(cls, valor: str) -> str:
        if len(valor) < MIN_PASSWORD_LENGTH:
            raise ValueError(f"La contraseña tiene que tener al menos {MIN_PASSWORD_LENGTH} caracteres")
        return valor


class UserRoleChange(BaseModel):
    """
    Body de PATCH /usuarios/{user_id}/rol (solo la cuenta "Manager").

    Literal en vez de str: Pydantic rechaza cualquier otro valor con un 422
    sin que haga falta un validator a mano, y de paso el rol inválido nunca
    llega a la capa de ruta.
    """

    rol: Literal["admin", "lectura"]


class AuthorizedUserCreate(BaseModel):
    """
    Body de POST /usuarios/autorizados: sumar a alguien a la whitelist de
    autoregistro (ver models.AuthorizedUser).
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


class AuthorizedUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    nombre_usuario: str
    rol: str
    # No es una columna: lo calcula el endpoint cruzando contra la tabla
    # usuarios, para que Manager vea de un vistazo quién ya se registró y
    # quién sigue pendiente (ver GET /usuarios/autorizados).
    ya_registrado: bool = False


class UserOut(UserBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    # Cuenta dada de baja temporalmente por "Manager" (ver models.User).
    # El front lo usa para mostrar el estado en la lista de usuarios.
    activo: bool = True
    # "Visto por última vez". None si la cuenta
    # nunca hizo un request autenticado desde que existe esta columna -- el
    # front lo muestra como "Nunca" en ese caso, no como una fecha vacía.
    ultima_actividad: Optional[datetime] = None
    # Solo se completa en GET /usuarios/me (ver app/api/users.py). En el
    # resto de los endpoints que devuelven UsuarioOut queda None. Existe
    # porque en producción front (Vercel) y back (Railway) son dominios
    # distintos: el JS del front no puede leer la cookie csrf_token de otro
    # dominio, así que viaja acá una vez por sesión y el front la guarda en
    # memoria para reenviarla como header X-CSRF-Token.
    csrf_token: Optional[str] = None
