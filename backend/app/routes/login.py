import secrets

from fastapi import APIRouter, status, Depends, Request, Response
from app.db import models
from app.db.db import get_db
from sqlalchemy.orm import Session
from app.auth.oAuth2 import create_access_token
from app.auth.verification import verify_password
from app.auth.exceptions import invalid_login_exception
from app.schemas import RespuestaLogin
from fastapi.security import OAuth2PasswordRequestForm
from app.config import settings
from app.limiter import limiter

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

# En producción (HTTPS) las cookies van marcadas "secure": el browser no las
# manda por http://. En local (dev) se corre sin HTTPS, así que se desactiva
# o el login nunca dejaría cookie puesta.
COOKIE_SECURE = settings.ENVIRONMENT == "production"
ACCESS_TOKEN_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60

# Frontend (Vercel) y backend (Railway) viven en dominios distintos en
# producción -> son "cross-site". Con SameSite=Lax el browser guarda la
# cookie en el login pero no la reenvía en pedidos posteriores desde otro
# sitio (ej. GET /usuarios/me), así que la sesión se pierde al toque.
# SameSite=None sí viaja cross-site, pero los browsers exigen que además sea
# Secure (HTTPS) -- por eso en local (sin HTTPS, mismo "sitio" localhost en
# distintos puertos) se mantiene "lax", que ahí sí alcanza.
COOKIE_SAMESITE = "none" if settings.ENVIRONMENT == "production" else "lax"


@router.post("/login", response_model=RespuestaLogin, status_code=status.HTTP_200_OK)
@limiter.limit("5/minute")
def login(request: Request, response: Response,
          user_credentials: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):

    user = db.query(models.Usuario).filter(
        models.Usuario.nombre_usuario == user_credentials.username
    ).first()

    if not user:
        raise invalid_login_exception

    if not verify_password(user_credentials.password, user.hashed_password):
        raise invalid_login_exception

    access_token = create_access_token(data={"user_id": str(user.id)})

    # Cookie httpOnly: no la puede leer JS (mitiga robo por XSS). El
    # frontend web ya no la maneja a mano, el browser la adjunta solo.
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
    )

    # Cookie CSRF: a propósito NO httponly, el frontend la lee y la reenvía
    # como header X-CSRF-Token en cada request que modifica datos (ver
    # security_middleware.py y axiosClient.js).
    csrf_token = secrets.token_urlsafe(32)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
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


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response):
    # secure/samesite tienen que coincidir con los que se usaron al crearlas
    # -- si no, en algunos browsers el Set-Cookie de borrado no pisa la
    # cookie original y queda viva hasta que expire sola.
    response.delete_cookie("access_token", path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)
    response.delete_cookie("csrf_token", path="/", secure=COOKIE_SECURE, samesite=COOKIE_SAMESITE)
    return {"message": "Sesión cerrada"}
