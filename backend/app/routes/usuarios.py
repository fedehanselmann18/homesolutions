from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oAuth2 import get_current_user
from app.auth.verification import hash_password
from app.config import settings
from app.db import models
from app.db.db import get_db
from app.limiter import limiter
from app.schemas import UsuarioCreate, UsuarioOut

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

# Equipo cerrado y conocido de antemano: solo las personas listadas en
# ROLES_PERMITIDOS_JSON (ver config.py, B-11) pueden crear cuenta, y el rol
# de cada una es fijo (no lo elige el usuario). Antes el rol venía tal cual
# del body del request, así que cualquiera que llegara al endpoint podía
# autoasignarse "admin". Sumar/sacar gente del equipo es cambiar el .env,
# no tocar código.

# GET : all users, get user by id, get current user info (user logged in)


@router.get("/", response_model=list[UsuarioOut], status_code=status.HTTP_200_OK)
def get_users(db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)):
    return db.query(models.Usuario).all()


@router.get("/login-options", status_code=status.HTTP_200_OK)
@limiter.limit("30/hour")
def get_login_options(request: Request, db: Session = Depends(get_db)):
    """
    Endpoint público (sin login, a propósito: alimenta el combo de usuario
    de la pantalla de login, antes de que exista sesión). Devuelve
    ÚNICAMENTE los nombres de usuario -- nada de id, rol ni timestamps --
    para no exponer quién es admin ni ids reales a cualquiera que llegue acá
    sin autenticarse.

    Rate limit: 30/hour por IP. Es un uso legítimo súper esporádico (una vez
    por visita a /login), así que un límite bajo no molesta a nadie real y
    frena el scraping masivo de usernames válidos.
    """
    nombres = db.query(models.Usuario.nombre_usuario).all()
    return [nombre for (nombre,) in nombres]


@router.get("/me", response_model=UsuarioOut, status_code=status.HTTP_200_OK)
def get_current_user_info(request: Request, current_user: models.Usuario = Depends(get_current_user)):
    """
    Además de los datos del usuario, devuelve el csrf_token vigente (leído
    de la cookie, que el servidor SÍ puede leer aunque JS del front no
    pueda si front y back están en dominios distintos -- ver comentario en
    schemas.UsuarioOut.csrf_token). El front llama a este endpoint al
    arrancar y después de loguear, así que es el punto natural para
    entregarlo sin agregar un endpoint aparte.
    """
    datos = UsuarioOut.model_validate(current_user)
    datos.csrf_token = request.cookies.get("csrf_token")
    return datos


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


# POST : Create user (autoregistro único, restringido al equipo conocido)


@router.post("/crear", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/hour")
def create_user(request: Request, usuario: UsuarioCreate, db: Session = Depends(get_db)):
    rol_esperado = settings.roles_permitidos.get(usuario.nombre_usuario)

    if rol_esperado is None:
        raise HTTPException(
            status_code=403,
            detail="Ese nombre de usuario no está autorizado para registrarse",
        )

    # Validación explícita: si el cliente mandó un rol que no coincide con
    # el que le corresponde, se rechaza en vez de simplemente ignorarlo --
    # así queda claro que el front está mal armado (o alguien manipuló el
    # request) en vez de fallar en silencio con un rol distinto al pedido.
    if usuario.rol != rol_esperado:
        raise HTTPException(
            status_code=400,
            detail=f"Rol inválido para {usuario.nombre_usuario}: debe ser '{rol_esperado}'",
        )

    existente = (
        db.query(models.Usuario).filter(models.Usuario.nombre_usuario == usuario.nombre_usuario).first()
    )
    if existente:
        raise HTTPException(status_code=400, detail="Ese usuario ya tiene cuenta creada")

    nuevo_usuario = models.Usuario(
        nombre_usuario=usuario.nombre_usuario,
        rol=rol_esperado,  # nunca el que mandó el cliente, aunque ya haya pasado la validación de arriba
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
