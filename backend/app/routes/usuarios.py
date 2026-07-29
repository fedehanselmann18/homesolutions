from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import models
from app.auth.oAuth2 import get_current_user
from app.auth.verification import hash_password
from app.db.db import get_db
from app.schemas import UsuarioCreate, UsuarioOut

router = APIRouter(
    prefix="/usuarios",
    tags=["usuarios"]
)

# GET : all users, get user by id, get current user info (user logged in)

@router.get("/", response_model=list[UsuarioOut], status_code=status.HTTP_200_OK)
def get_users(db: Session = Depends(get_db)):
    # sin auth a propósito: alimenta el select del login antes de que exista sesión
    return db.query(models.Usuario).all()


@router.get("/me", response_model=UsuarioOut,status_code=status.HTTP_200_OK)
def get_current_user_info(current_user: models.Usuario = Depends(get_current_user)):
    return current_user


@router.get("/{user_id}", response_model=UsuarioOut, status_code=status.HTTP_200_OK)
def get_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    usuario = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    return usuario


# POST : Create user (registro único mientras dure el onboarding)

@router.post("/crear", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def create_user(usuario: UsuarioCreate, db: Session = Depends(get_db)):
    existente = db.query(models.Usuario).filter(
        models.Usuario.nombre_usuario == usuario.nombre_usuario
    ).first()
    if existente:
        raise HTTPException(status_code=400, detail="Ese usuario ya tiene cuenta creada")

    nuevo_usuario = models.Usuario(
        nombre_usuario=usuario.nombre_usuario,
        rol=usuario.rol,
        hashed_password=hash_password(usuario.password),
    )
    try:
        db.add(nuevo_usuario)
        db.commit()
        db.refresh(nuevo_usuario)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el usuario")
    return nuevo_usuario