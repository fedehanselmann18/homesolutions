import secrets

from fastapi import APIRouter, status, Depends, Request, Response
from app.db import models
from app.db.db import get_db
from sqlalchemy.orm import Session
from app.auth.oAuth2 import create_access_token
from app.auth.verification import verify_password
from app.auth.exceptions import invalid_login_exception
from app.schemas import RespuestaToken
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


@router.post("/login", response_model=RespuestaToken, status_code=status.HTTP_200_OK)
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
        samesite="lax",
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
        samesite="lax",
        max_age=ACCESS_TOKEN_MAX_AGE,
        path="/",
    )

    # Se sigue devolviendo el token en el body por compatibilidad: tests y
    # posibles clientes API (Postman, un futuro mobile) que prefieran manejar
    # el Authorization header en vez de cookies. El frontend web ignora este
    # campo del body y confía solo en la cookie.
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_200_OK)
def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("csrf_token", path="/")
    return {"message": "Sesión cerrada"}
