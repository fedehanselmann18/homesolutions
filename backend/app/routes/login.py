from fastapi import APIRouter, status, Depends
from app.db import models
from app.db.db import get_db
from sqlalchemy.orm import Session
from app.auth.oAuth2 import create_access_token
from app.auth.verification import verify_password
from app.auth.exceptions import invalid_login_exception
from app.schemas import RespuestaToken
from fastapi.security import OAuth2PasswordRequestForm

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)


@router.post("/login", response_model=RespuestaToken, status_code=status.HTTP_200_OK)
def login(user_credentials: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):

    user = db.query(models.Usuario).filter(
        models.Usuario.nombre_usuario == user_credentials.username
    ).first()

    if not user:
        raise invalid_login_exception

    if not verify_password(user_credentials.password, user.hashed_password):
        raise invalid_login_exception

    access_token = create_access_token(data={"user_id": str(user.id)})

    return {"access_token": access_token, "token_type": "bearer"}