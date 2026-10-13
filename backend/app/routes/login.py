import logging
import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app import intentos_login
from app.audit import log_auditoria
from app.auth.exceptions import invalid_login_exception, invalid_token_exception
from app.auth.oAuth2 import (
    create_access_token,
    create_refresh_token,
    get_refresh_token,
    refresh_token_revocado,
    resolver_usuario_vigente,
    verify_refresh_token,
)
from app.auth.verification import verify_password
from app.config import settings
from app.db import models
from app.db.db import get_db
from app.limiter import ip_del_cliente, limiter
from app.schemas import RespuestaLogin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["auth"])

# En producción (HTTPS) las cookies van marcadas "secure": el browser no las
# manda por http://. En local (dev) se corre sin HTTPS, así que se desactiva
# o el login nunca dejaría cookie puesta.
COOKIE_SECURE = settings.ENVIRONMENT == "production"
ACCESS_TOKEN_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
REFRESH_TOKEN_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60

# Mientras front y back vivan en dominios de distinto "site" (ej. Vercel +
# Railway) son "cross-site": con SameSite=Lax el browser guarda la cookie en
# el login pero no la reenvía en pedidos posteriores desde otro sitio (ej.
# GET /usuarios/me), así que la sesión se pierde al toque. SameSite=None sí
# viaja cross-site, pero los browsers exigen que además sea Secure (HTTPS)
# -- por eso en local (sin HTTPS, mismo "sitio" localhost en distintos
# puertos) se mantiene "lax", que ahí sí alcanza. Una vez que front
# (homesolutions.company) y back (api.homesolutions.company) compartan
# dominio raíz dejan de ser cross-site, y conviene setear COOKIE_SAMESITE=lax
# explícito en el .env de Railway (ver Settings.COOKIE_SAMESITE en
# config.py) en vez de depender de este default automático.
COOKIE_SAMESITE = settings.COOKIE_SAMESITE or ("none" if settings.ENVIRONMENT == "production" else "lax")

# Domain explícito de las cookies (ver Settings.COOKIE_DOMAIN en config.py).
# None por default -> cookie "host-only", que ya alcanza acá porque el
# front nunca lee su valor, solo necesita que el browser se la adjunte en
# los pedidos a la API.
COOKIE_DOMAIN = settings.COOKIE_DOMAIN


def _setear_cookies_sesion(response: Response, access_token: str) -> None:
    """
    Cookie httpOnly del access token + cookie (NO httponly, la lee el
    frontend) de csrf_token, mismo max_age que el access token -- ver
    security_middleware.py y axiosClient.js. Compartido entre login y
    refresh: los dos emiten un access token nuevo y los dos necesitan
    renovar el csrf_token junto con él (si no, el csrf_token quedaría
    vencido en el browser aunque la sesión siga viva vía refresh token).
    """
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
    )

    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
    )


def _cuenta_bloqueada(minutos: int) -> HTTPException:
    """
    429 con un detail en castellano que el front muestra tal cual (ver
    Login.jsx). El 429 del límite por IP de slowapi no trae "detail", así
    que ahí el front cae a su mensaje genérico de "demasiados intentos".
    """
    espera = "1 minuto" if minutos == 1 else f"{minutos} minutos"
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail=f"Demasiados intentos fallidos con esta cuenta. Probá de nuevo en {espera}.",
    )


@router.post("/login", response_model=RespuestaLogin, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def login(
    request: Request,
    response: Response,
    user_credentials: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):

    user = db.query(models.Usuario).filter(models.Usuario.nombre_usuario == user_credentials.username).first()
    ip = ip_del_cliente(request)

    if not user:
        # Solo al log del servidor: intentos_login/auditoria cuelgan de una
        # cuenta real, y anotar nombres inventados le dejaría a cualquiera
        # llenar esas tablas. Acá alcanza el límite por IP del decorador.
        logger.warning("Login fallido con usuario inexistente desde %s", ip)
        raise invalid_login_exception

    # Bloqueo por cuenta (ver app/intentos_login.py): se corta ANTES de
    # verify_password. Si se chequeara la contraseña durante el bloqueo, el
    # atacante seguiría probando igual y el bloqueo no frenaría nada.
    minutos_bloqueo = intentos_login.minutos_de_bloqueo(db, user.id)
    if minutos_bloqueo is not None:
        logger.warning("Login rechazado por bloqueo: cuenta %s, ip %s", user.nombre_usuario, ip)
        raise _cuenta_bloqueada(minutos_bloqueo)

    # OJO con el orden: verify_password se llama SIEMPRE, incluso si la
    # cuenta está desactivada, y recién después se combinan los dos
    # resultados. Cortar antes para una cuenta inactiva haría que su
    # respuesta sea notoriamente más rápida que la de una cuenta activa con
    # contraseña incorrecta (bcrypt tarda ~100ms a propósito), y esa
    # diferencia de tiempo sola alcanza para averiguar qué cuentas están
    # desactivadas sin conocer ninguna contraseña.
    password_ok = verify_password(user_credentials.password, user.hashed_password)

    if not password_ok:
        fallidos, minutos_bloqueo = intentos_login.registrar_fallo(db, user.id)
        # A la auditoría (la ve Manager): usuario_id es la cuenta ATACADA, no
        # quien probó -- de ese solo se sabe la IP.
        log_auditoria(
            db,
            user.id,
            "login fallido",
            "Sesion",
            user.id,
            detalle={"ip": ip, "fallidos": fallidos, "bloqueo_minutos": minutos_bloqueo},
        )

    if not password_ok or not user.activo:
        # Mismo error genérico de siempre: no se revela si falló por la
        # contraseña o porque la cuenta está desactivada.
        raise invalid_login_exception

    intentos_login.limpiar(db, user.id)

    access_token = create_access_token(data={"user_id": str(user.id)})
    _setear_cookies_sesion(response, access_token)

    # Refresh token (B-06): cookie separada, de larga duración, acotada a
    # path="/auth" -- no tiene sentido que viaje en CADA request como el
    # access token, solo la necesitan POST /auth/refresh y /auth/logout.
    refresh_token = create_refresh_token(data={"user_id": str(user.id)})
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        domain=COOKIE_DOMAIN,
        max_age=REFRESH_TOKEN_MAX_AGE,
        path="/auth",
    )

    # B-05: el JWT ya NO viaja en el body (antes sí, "por compatibilidad").
    # Confirmado en frontend/src/services/authService.js que el front ignora
    # el body y confía solo en la cookie -- devolverlo acá además solo suma
    # otro lugar (logs de proxy, browser history de herramientas tipo
    # Postman, etc.) donde el token puede quedar expuesto. Clientes tipo API
    # que necesiten el token para mandarlo como header "Authorization:
    # Bearer <token>" (en vez de depender de la cookie httpOnly, que igual
    # les sirve si su cliente HTTP maneja cookies) tienen que leerlo de la
    # cookie "access_token" de la respuesta, no del body.
    return {"message": "Sesión iniciada"}


@router.post("/refresh", response_model=RespuestaLogin, status_code=status.HTTP_200_OK)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    """
    Renueva el access token (y el csrf_token que viaja junto) usando el
    refresh token de larga duración, sin pedir credenciales de nuevo. El
    refresh token en sí NO se rota acá -- sigue siendo el mismo hasta que
    venza (REFRESH_TOKEN_EXPIRE_DAYS) o se revoque (ver
    resolver_usuario_vigente, B-06).
    """
    refresh_token = get_refresh_token(request)
    token_data = verify_refresh_token(refresh_token, invalid_token_exception)
    if refresh_token_revocado(db, token_data.jti):
        raise invalid_token_exception
    user = resolver_usuario_vigente(token_data, db, invalid_token_exception)

    access_token = create_access_token(data={"user_id": str(user.id)})
    _setear_cookies_sesion(response, access_token)

    return {"message": "Token renovado"}


def _revocar_refresh_token(request: Request, db: Session) -> None:
    """
    Da de baja el refresh token de la cookie (si hay uno válido): sin esto,
    cerrar sesión solo borraba la cookie del browser y una copia robada del
    token seguía sirviendo hasta vencer. Solo ESTE token -- las sesiones de
    la persona en otros dispositivos siguen abiertas.

    De paso limpia las filas ya vencidas: pasado su "exp" el token no sirve
    de todos modos, así que la tabla no crece sin techo.
    """
    token = request.cookies.get("refresh_token")
    if not token:
        return
    try:
        token_data = verify_refresh_token(token, invalid_token_exception)
    except Exception:
        # Token vencido, adulterado o con un formato que PyJWT no esperaba:
        # no hay nada que revocar, y el logout tiene que borrar las cookies
        # igual -- nunca puede fallar por una cookie rota.
        return

    tabla = models.RefreshTokenRevocado.__table__
    db.execute(insert(tabla).values(jti=token_data.jti, expira_en=token_data.exp).on_conflict_do_nothing())
    db.query(models.RefreshTokenRevocado).filter(
        models.RefreshTokenRevocado.expira_en < datetime.now(timezone.utc)
    ).delete(synchronize_session=False)
    db.commit()


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    _revocar_refresh_token(request, db)

    # secure/samesite/domain/path tienen que coincidir con los que se
    # usaron al crearlas -- si no, en algunos browsers el Set-Cookie de
    # borrado no pisa la cookie original y queda viva hasta que expire sola.
    response.delete_cookie(
        "access_token", path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, domain=COOKIE_DOMAIN
    )
    response.delete_cookie(
        "csrf_token", path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, domain=COOKIE_DOMAIN
    )
    response.delete_cookie(
        "refresh_token", path="/auth", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE, domain=COOKIE_DOMAIN
    )
    return {"message": "Sesión cerrada"}
