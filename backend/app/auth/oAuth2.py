from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from jwt import PyJWTError
from sqlalchemy.orm import Session

from app.auth.exceptions import invalid_token_exception
from app.config import settings
from app.db import models
from app.db.db import get_db
from app.schemas import DatosToken

# auto_error=False: si no viene Authorization header no explota acá, sigue
# a get_token que prueba con la cookie antes de rendirse.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES
REFRESH_TOKEN_EXPIRE_DAYS = settings.REFRESH_TOKEN_EXPIRE_DAYS

# Margen contra desfasaje de reloj entre el proceso de la app y el server de
# Postgres (fecha_actualizacion usa server_default now() de la DB, no el
# reloj de Python) -- sin esto, un token recién emitido podría leerse como
# "emitido antes del corte" por unos milisegundos de diferencia entre
# relojes, y quedar revocado apenas se crea.
TOLERANCIA_REVOCACION = timedelta(seconds=5)


def get_token(request: Request, token_header: str = Depends(oauth2_scheme)) -> str:
    """
    Acepta el JWT de dos lugares, en este orden:
    1. Header "Authorization: Bearer ..." (clientes API/tests, no depende del browser).
    2. Cookie httpOnly "access_token" (el frontend web, desde la migración a cookies).
    """
    if token_header:
        return token_header

    token_cookie = request.cookies.get("access_token")
    if token_cookie:
        return token_cookie

    raise invalid_token_exception


def get_refresh_token(request: Request) -> str:
    """
    El refresh token SOLO viaja por cookie httpOnly, nunca por header: a
    diferencia del access token, no hay razón legítima para que un cliente
    lo mande a mano en cada request -- solo lo necesita el propio browser,
    una vez, contra POST /auth/refresh (ver login.py, cookie con
    path="/auth" para acotar a qué rutas se la manda).
    """
    token_cookie = request.cookies.get("refresh_token")
    if token_cookie:
        return token_cookie

    raise invalid_token_exception


def _crear_token(data: dict, expira_en: timedelta, tipo: str) -> str:
    ahora = datetime.now(timezone.utc)
    to_encode = data.copy()
    to_encode.update({"iat": ahora, "exp": ahora + expira_en, "type": tipo})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_access_token(data: dict) -> str:
    return _crear_token(data, timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES), "access")


def create_refresh_token(data: dict) -> str:
    """
    Token de larga duración (ver REFRESH_TOKEN_EXPIRE_DAYS), separado del
    access token -- ver POST /auth/refresh. El claim "type" evita que este
    token se pueda usar como si fuera un access token en una ruta protegida
    (y viceversa): verify_access_token/verify_refresh_token chequean cada
    uno el tipo que esperan.
    """
    return _crear_token(data, timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS), "refresh")


def _verificar_token(token: str, tipo_esperado: str, credentials_exception) -> DatosToken:
    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

        if decoded_token.get("type") != tipo_esperado:
            raise credentials_exception

        id: str = decoded_token.get("user_id")
        iat = decoded_token.get("iat")

        if id is None or iat is None:
            raise credentials_exception

        token_data = DatosToken(user_id=id, iat=datetime.fromtimestamp(iat, tz=timezone.utc))

    except PyJWTError:
        raise credentials_exception

    return token_data


def verify_access_token(token: str, credentials_exception) -> DatosToken:
    return _verificar_token(token, "access", credentials_exception)


def verify_refresh_token(token: str, credentials_exception) -> DatosToken:
    return _verificar_token(token, "refresh", credentials_exception)


def resolver_usuario_vigente(token_data: DatosToken, db: Session, credentials_exception) -> models.Usuario:
    """
    Busca el Usuario del token y chequea revocación (B-06): si el token se
    emitió antes de user.fecha_actualizacion (con TOLERANCIA_REVOCACION de
    margen), se lo trata como inválido -- "tocar" la fila del usuario
    (cualquier UPDATE) invalida de una todas sus sesiones activas, access y
    refresh tokens por igual, sin necesitar una blacklist aparte. Usado
    tanto por get_current_user como por POST /auth/refresh.
    """
    user = db.query(models.Usuario).filter(models.Usuario.id == token_data.user_id).first()
    if user is None:
        raise credentials_exception

    if token_data.iat < user.fecha_actualizacion - TOLERANCIA_REVOCACION:
        raise credentials_exception

    # Cuenta desactivada por "Manager" (ver POST /usuarios/{id}/desactivar):
    # se chequea acá, en cada request, y no solo en el login, para que una
    # sesión YA abierta se corte al toque en vez de sobrevivir hasta que
    # venza el token.
    if not user.activo:
        raise credentials_exception

    return user


def get_current_user(token: str = Depends(get_token), db: Session = Depends(get_db)) -> models.Usuario:
    token_data = verify_access_token(token, invalid_token_exception)
    return resolver_usuario_vigente(token_data, db, invalid_token_exception)


def requiere_admin(current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción")
    return current_user


# El único poder especial de la cuenta "Manager" (resetear contraseñas
# ajenas, ver routes/usuarios.py) va gateado por nombre de usuario y NO por
# rol: es a propósito que los admins del equipo (rol == "admin") no puedan
# resetearle la contraseña a nadie. La cuenta se registra una sola vez
# desde /registro (está en la whitelist, ver migración e7b2f4c19a83) o por
# consola con scripts/crear_usuario_manager.py, y tiene rol "lectura",
# justamente para no arrastrar permisos de admin en el resto de los
# endpoints.
NOMBRE_USUARIO_MANAGER = "Manager"


def requiere_manager(current_user: models.Usuario = Depends(get_current_user)):
    if current_user.nombre_usuario != NOMBRE_USUARIO_MANAGER:
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción")
    return current_user
