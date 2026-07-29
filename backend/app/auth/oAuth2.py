from jose import JWTError, jwt
from datetime import datetime, timedelta, timezone
from app.schemas import DatosToken
from fastapi import Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from app.db import models
from app.db.db import get_db
from app.config import settings
from app.auth.exceptions import invalid_token_exception

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

SECRET_KEY = settings.SECRET_KEY
ALGORITHM = settings.ALGORITHM
ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES


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


def get_current_user(token: str = Depends(oauth2_scheme),
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