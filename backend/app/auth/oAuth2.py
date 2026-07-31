from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from app.schemas import DatosToken
from fastapi import Depends, HTTPException, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db import models
from app.db.db import get_db
from app.config import settings
from app.auth.exceptions import invalid_token_exception

# auto_error=False: si no viene Authorization header no explota acá, sigue
# a get_token que prueba con la cookie antes de rendirse.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login", auto_error=False)

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES


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


def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_access_token(token: str, credentials_exception):
    try:
        decoded_token = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        id: str = decoded_token.get("user_id")

        if id is None:
            raise credentials_exception

        token_data = DatosToken(user_id=id)

    except JWTError:
        raise credentials_exception

    return token_data


def get_current_user(token: str = Depends(get_token),
                      db: Session = Depends(get_db)):

    token_data = verify_access_token(token, invalid_token_exception)

    user = db.query(models.Usuario).filter(models.Usuario.id == token_data.user_id).first()

    if user is None:
        raise invalid_token_exception

    return user


def requiere_admin(current_user: models.Usuario = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(status_code=403, detail="No tienes permisos para realizar esta acción")
    return current_user