from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import intentos_login
from app.audit import log_auditoria
from app.auth.oAuth2 import NOMBRE_USUARIO_MANAGER, get_current_user, requiere_manager
from app.auth.verification import hash_password
from app.db import models
from app.db.db import get_db
from app.limiter import limiter
from app.schemas import (
    UsuarioAutorizadoCreate,
    UsuarioAutorizadoOut,
    UsuarioCambioRol,
    UsuarioCreate,
    UsuarioOut,
    UsuarioResetPassword,
)

router = APIRouter(prefix="/usuarios", tags=["usuarios"])

# Equipo cerrado y conocido de antemano: solo las personas listadas en la
# tabla usuarios_autorizados (ver models.UsuarioAutorizado) pueden crear
# cuenta, y el rol de cada una es fijo (no lo elige el usuario). Antes el
# rol venía tal cual del body del request, así que cualquiera que llegara
# al endpoint podía autoasignarse "admin". Sumar/sacar gente del equipo lo
# hace la cuenta "Manager" desde la app (POST/DELETE /usuarios/autorizados);
# hasta esta versión era una env var (ROLES_PERMITIDOS_JSON) que obligaba a
# tocar el .env y redeployar.
#
# "Manager" también está en esa whitelist (la sembró la migración
# e7b2f4c19a83): se registra desde /registro como cualquier otro, en vez de
# por consola. Ver el comentario de autorizar_usuario para qué implica eso
# y por qué la fila está protegida contra revocación.


def _log_accion_manager(
    db: Session,
    ejecutor: models.Usuario,
    accion: str,
    usuario_nombre: str,
    usuario_id,
    tipo_recurso: str = "Usuario",
) -> None:
    """
    Auditoría de las acciones de mantenimiento: van a la tabla `auditoria`
    (consultable desde la app) y al log del servidor, igual que el resto de
    la app -- ver app/audit.py, que hace las dos escrituras.

    El ejecutor es siempre la cuenta "Manager" (todos estos endpoints pasan
    por requiere_manager), pero se recibe como parámetro en vez de darlo por
    sentado: la fila de auditoría tiene que decir QUIÉN, no confiar en que
    el gate de arriba no cambie nunca.

    El nombre del usuario objetivo va en `detalle` y no solo en recurso_id
    porque el id no le dice nada a nadie leyendo el listado, y porque en las
    acciones de borrado la fila objetivo ya no existe para ir a buscarlo.

    OJO con el orden: llamar SIEMPRE después del commit de la acción (ver el
    docstring de app/audit.py).
    """
    log_auditoria(
        db,
        ejecutor.id,
        accion,
        tipo_recurso,
        usuario_id,
        detalle={"usuario": usuario_nombre},
    )


def _buscar_usuario_ajeno(
    db: Session, user_id: str, current_user: models.Usuario, mensaje_auto: str
) -> models.Usuario:
    """
    Busca el usuario objetivo de una acción de mantenimiento y frena si es
    la propia cuenta "Manager".

    El guard de auto-acción está en todos los endpoints de Manager por la
    misma razón: si alguien roba esa sesión, no tiene que poder usarla
    contra la cuenta en sí (cambiarle el rol, desactivarla, resetearle la
    contraseña) y dejar al dueño del proyecto afuera -- la única
    recuperación sería tocar la base a mano y correr
    scripts/crear_usuario_manager.py de nuevo.
    """
    usuario = db.query(models.Usuario).filter(models.Usuario.id == user_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    if usuario.id == current_user.id:
        raise HTTPException(status_code=400, detail=mensaje_auto)

    return usuario


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

    "Manager" SÍ aparece en esta lista, igual que el resto: es la cuenta de
    mantenimiento del dueño del proyecto y se loguea eligiéndola del combo
    como cualquier otra. Esconderla acá no agregaba seguridad real -- el
    nombre es adivinable y lo único que la protege es la contraseña -- y
    obligaba a tipearlo a mano en cada login.
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


# Whitelist de autoregistro (usuarios_autorizados). OJO con el orden: estas
# rutas tienen que quedar ANTES de GET /{user_id}, porque si no "autorizados"
# y "opciones-registro" se comen como si fueran un user_id.


@router.get("/autorizados", response_model=list[UsuarioAutorizadoOut], status_code=status.HTTP_200_OK)
@limiter.limit("120/hour")
def get_usuarios_autorizados(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """
    Lista completa de nombres autorizados a registrarse, marcando cuáles ya
    tienen cuenta creada (ya_registrado) y cuáles siguen pendientes. Solo la
    ve "Manager": es la pantalla desde donde gestiona el equipo.
    """
    autorizados = db.query(models.UsuarioAutorizado).order_by(models.UsuarioAutorizado.nombre_usuario).all()
    nombres_registrados = {nombre for (nombre,) in db.query(models.Usuario.nombre_usuario).all()}

    salida = []
    for autorizado in autorizados:
        datos = UsuarioAutorizadoOut.model_validate(autorizado)
        datos.ya_registrado = autorizado.nombre_usuario in nombres_registrados
        salida.append(datos)
    return salida


@router.post("/autorizados", response_model=UsuarioAutorizadoOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("30/hour")
def autorizar_usuario(
    request: Request,
    datos: UsuarioAutorizadoCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """
    Suma un nombre a la whitelist de autoregistro: a partir de acá, esa
    persona aparece en el combo de /registro y puede crearse la cuenta con
    el rol que se le fijó acá (el rol lo decide esta tabla, nunca el body
    del alta -- ver create_user).
    """
    # "Manager" no necesita un guard propio acá: su fila la siembra la
    # migración e7b2f4c19a83 y revocar_autorizacion no deja borrarla, así
    # que siempre existe y este endpoint la rechaza por duplicada unas
    # líneas más abajo. Tampoco se le puede cambiar el rol por acá: para eso
    # está PATCH /usuarios/{id}/rol, y solo sobre cuentas ya creadas.
    existente = (
        db.query(models.UsuarioAutorizado)
        .filter(models.UsuarioAutorizado.nombre_usuario == datos.nombre_usuario)
        .first()
    )
    if existente:
        raise HTTPException(status_code=400, detail="Ese nombre ya está autorizado")

    ya_tiene_cuenta = (
        db.query(models.Usuario).filter(models.Usuario.nombre_usuario == datos.nombre_usuario).first()
    )
    if ya_tiene_cuenta:
        # No tiene sentido "autorizar" a alguien que ya se registró: para
        # cambiarle el rol está PATCH /usuarios/{id}/rol.
        raise HTTPException(status_code=400, detail="Esa persona ya tiene cuenta creada")

    autorizado = models.UsuarioAutorizado(nombre_usuario=datos.nombre_usuario, rol=datos.rol)
    try:
        db.add(autorizado)
        db.commit()
        db.refresh(autorizado)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al autorizar el usuario")

    _log_accion_manager(
        db,
        current_user,
        f"autorizar (rol={datos.rol})",
        autorizado.nombre_usuario,
        autorizado.id,
        tipo_recurso="Autorizacion",
    )
    return autorizado


@router.delete("/autorizados/{autorizado_id}", status_code=status.HTTP_204_NO_CONTENT)
@limiter.shared_limit("30/hour", scope="revocar_autorizacion")
def revocar_autorizacion(
    request: Request,
    autorizado_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """
    Saca un nombre de la whitelist. Solo sirve para autorizaciones que
    todavía nadie usó: si la persona ya se registró, borrar la fila no
    borraría su cuenta ni le sacaría el acceso (create_user ya no se vuelve
    a ejecutar para ella), así que sería una falsa sensación de seguridad.
    Para sacarle el acceso a alguien que ya tiene cuenta está
    POST /usuarios/{id}/desactivar.
    """
    autorizado = (
        db.query(models.UsuarioAutorizado).filter(models.UsuarioAutorizado.id == autorizado_id).first()
    )
    if not autorizado:
        raise HTTPException(status_code=404, detail="Autorización no encontrada")

    if autorizado.nombre_usuario == NOMBRE_USUARIO_MANAGER:
        # Esta fila es el failsafe de la cuenta de mantenimiento: si se
        # pierde la contraseña de "Manager" (nadie se la puede resetear --
        # requiere_manager es la propia cuenta, y _buscar_usuario_ajeno
        # bloquea las acciones sobre uno mismo), la recuperación es borrar
        # la fila de "usuarios" en la base y volver a registrarse desde
        # /registro, cosa que solo funciona si la autorización sigue acá.
        raise HTTPException(
            status_code=400,
            detail=(
                f'La autorización de "{NOMBRE_USUARIO_MANAGER}" no se puede revocar: '
                "es lo que permite recuperar la cuenta"
            ),
        )

    ya_tiene_cuenta = (
        db.query(models.Usuario).filter(models.Usuario.nombre_usuario == autorizado.nombre_usuario).first()
    )
    if ya_tiene_cuenta:
        raise HTTPException(
            status_code=400,
            detail="Esa persona ya tiene cuenta creada: desactivá la cuenta en vez de revocar la autorización",
        )

    # Nombre e id se copian ANTES del delete: una vez commiteado el borrado,
    # el objeto queda sin fila detrás y leerle los atributos falla.
    nombre_revocado = autorizado.nombre_usuario
    id_revocado = autorizado.id

    db.delete(autorizado)
    db.commit()

    _log_accion_manager(
        db,
        current_user,
        "revocar autorización",
        nombre_revocado,
        id_revocado,
        tipo_recurso="Autorizacion",
    )


@router.get("/opciones-registro", status_code=status.HTTP_200_OK)
@limiter.limit("30/hour")
def get_opciones_registro(request: Request, db: Session = Depends(get_db)):
    """
    Endpoint público (sin login, a propósito: alimenta el combo de nombres
    de la pantalla de registro, antes de que exista sesión). Mismas
    restricciones que /login-options: devuelve ÚNICAMENTE nombres de
    usuario -- nada de id, rol ni timestamps -- y con el mismo rate limit
    bajo (30/hour por IP) para frenar el scraping.

    Devuelve solo los autorizados que TODAVÍA no tienen cuenta: alguien que
    ya se registró no tiene nada que hacer en /registro, y así el combo no
    filtra de más sobre quién ya está adentro.

    "Manager" aparece acá como uno más MIENTRAS no tenga cuenta, y es la
    única ventana de riesgo de todo este diseño: este endpoint es público y
    POST /usuarios/crear también, así que en ese lapso cualquiera puede
    quedarse con la cuenta de mantenimiento poniéndole su propia
    contraseña. El filtro de "todavía sin cuenta" es lo que cierra la
    ventana sola, sin deploy ni limpieza a mano: apenas la cuenta existe,
    "Manager" deja de listarse y create_user la rechaza por duplicada. Hay
    que registrarla apenas termina el deploy, no dejarlo para después.
    """
    nombres_registrados = db.query(models.Usuario.nombre_usuario)
    nombres = (
        db.query(models.UsuarioAutorizado.nombre_usuario)
        .filter(models.UsuarioAutorizado.nombre_usuario.notin_(nombres_registrados))
        .order_by(models.UsuarioAutorizado.nombre_usuario)
        .all()
    )
    return [nombre for (nombre,) in nombres]


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
    # La whitelist vive en la base (usuarios_autorizados), no en el .env:
    # la gestiona la cuenta "Manager" desde la app. "Manager" nunca está en
    # esa tabla, así que este endpoint público no puede crearla.
    autorizado = (
        db.query(models.UsuarioAutorizado)
        .filter(models.UsuarioAutorizado.nombre_usuario == usuario.nombre_usuario)
        .first()
    )
    rol_esperado = autorizado.rol if autorizado else None

    if rol_esperado is None:
        raise HTTPException(
            status_code=403,
            detail="Ese nombre de usuario no está autorizado para registrarse",
        )

    # Validación explícita: si el cliente mandó un rol que no coincide con
    # el que le corresponde, se rechaza en vez de simplemente ignorarlo --
    # así queda claro que el front está mal armado (o alguien manipuló el
    # request) en vez de fallar en silencio con un rol distinto al pedido.
    # Mandarlo es opcional: el front ya no lo hace (no puede saberlo, ver
    # UsuarioCreate.rol), y en ese caso manda el de la whitelist.
    if usuario.rol is not None and usuario.rol != rol_esperado:
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


# POST : resetear la contraseña de un usuario (solo la cuenta "Manager")


@router.post("/{user_id}/resetear-password", response_model=UsuarioOut, status_code=status.HTTP_200_OK)
# shared_limit (no limit) a propósito: slowapi usa la URL completa como
# parte de la clave del límite por default (key_style="url", ver
# app/limiter.py), y esta ruta tiene un {user_id} dinámico -- con @limit
# normal cada usuario objetivo distinto arma su propio balde de 20/hour, así
# que Manager (o quien le robe la sesión) podría resetear contraseñas sin
# límite real con solo variar el user_id. El scope fijo agrupa todos los
# user_id bajo una sola cuenta por IP, igual que /crear y /auth/login (rutas
# estáticas, donde este problema no existe).
@limiter.shared_limit("20/hour", scope="resetear_password")
def resetear_password(
    request: Request,
    user_id: str,
    datos: UsuarioResetPassword,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """
    Reseteo manual de contraseña para cuando alguien del equipo se la
    olvida. No hay mail ni token de recuperación: la contraseña nueva la
    escribe a mano el dueño del proyecto desde la cuenta "Manager" (ver
    requiere_manager, gateado por nombre de usuario y no por rol).

    No hace falta revocar sesiones a mano: el UPDATE toca
    fecha_actualizacion (TimestampMixin) y resolver_usuario_vigente (B-06,
    ver auth/oAuth2.py) invalida cualquier token emitido antes de ese
    cambio, así que la persona queda deslogueada de una.

    Rate limit: 20/hour por IP, sumando todos los user_id (ver comentario
    del decorador). No es una acción frecuente, pero un día puede tocar
    resetear varias contraseñas seguidas -- mismo criterio que /crear
    (10/hour) y /auth/login (5/minute), ver app/limiter.py.
    """
    usuario = _buscar_usuario_ajeno(
        db, user_id, current_user, "No podés resetear tu propia contraseña con este endpoint"
    )

    usuario.hashed_password = hash_password(datos.password)
    db.commit()
    db.refresh(usuario)
    # Con la contraseña nueva, los fallos viejos ya no dicen nada: se
    # destraba la cuenta si estaba bloqueada (ver app/intentos_login.py).
    # Es la forma de sacar a alguien de un bloqueo sin esperar.
    intentos_login.limpiar(db, usuario.id)

    _log_accion_manager(db, current_user, "resetear contraseña", usuario.nombre_usuario, usuario.id)
    return usuario


# PATCH / POST : resto del mantenimiento de cuentas (solo "Manager")


@router.patch("/{user_id}/rol", response_model=UsuarioOut, status_code=status.HTTP_200_OK)
@limiter.shared_limit("30/hour", scope="cambiar_rol")
def cambiar_rol(
    request: Request,
    user_id: str,
    datos: UsuarioCambioRol,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """
    Pasa a alguien de "lectura" a "admin" o al revés.

    No hace falta invalidar la sesión de esa persona: el rol se lee de la
    fila fresca de la base en cada request (get_current_user ->
    resolver_usuario_vigente), así que el cambio ya aplica en su próximo
    request, sin desloguearla.
    """
    usuario = _buscar_usuario_ajeno(db, user_id, current_user, "No podés cambiar tu propio rol")

    usuario.rol = datos.rol
    db.commit()
    db.refresh(usuario)

    _log_accion_manager(db, current_user, f"cambiar rol a {datos.rol}", usuario.nombre_usuario, usuario.id)
    return usuario


@router.post("/{user_id}/cerrar-sesion", response_model=UsuarioOut, status_code=status.HTTP_200_OK)
@limiter.shared_limit("30/hour", scope="cerrar_sesion")
def cerrar_sesion_de_usuario(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """
    Corta la sesión de alguien sin tocarle la contraseña (por ejemplo si se
    dejó la sesión abierta en una compu ajena): sigue entrando con la misma
    clave, pero tiene que loguearse de nuevo.

    Se apoya en el mismo mecanismo de revocación que el reseteo (B-06, ver
    resolver_usuario_vigente): cualquier token emitido antes de
    fecha_actualizacion queda inválido. La diferencia es que acá no cambia
    ningún otro campo, así que hay que forzar el UPDATE con un query
    explícito -- si solo se "tocara" el objeto ORM sin modificar nada,
    SQLAlchemy no emitiría UPDATE y no se revocaría nada.
    """
    usuario = _buscar_usuario_ajeno(
        db, user_id, current_user, "No podés cerrar tu propia sesión con esto (usá /auth/logout)"
    )

    db.query(models.Usuario).filter(models.Usuario.id == usuario.id).update(
        {"fecha_actualizacion": func.now()}, synchronize_session=False
    )
    db.commit()
    db.refresh(usuario)

    _log_accion_manager(db, current_user, "cerrar sesión", usuario.nombre_usuario, usuario.id)
    return usuario


@router.post("/{user_id}/desactivar", response_model=UsuarioOut, status_code=status.HTTP_200_OK)
@limiter.shared_limit("30/hour", scope="desactivar_usuario")
def desactivar_usuario(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """
    Baja temporal: la persona no puede loguearse ni sostener la sesión que
    tenga abierta (ver login() y resolver_usuario_vigente), pero la cuenta
    y todo su historial quedan intactos. Se revierte con /reactivar.
    """
    usuario = _buscar_usuario_ajeno(db, user_id, current_user, "No podés desactivar tu propia cuenta")

    usuario.activo = False
    db.commit()
    db.refresh(usuario)

    _log_accion_manager(db, current_user, "desactivar", usuario.nombre_usuario, usuario.id)
    return usuario


@router.post("/{user_id}/reactivar", response_model=UsuarioOut, status_code=status.HTTP_200_OK)
@limiter.shared_limit("30/hour", scope="reactivar_usuario")
def reactivar_usuario(
    request: Request,
    user_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """Deshace un /desactivar: la persona vuelve a poder loguearse."""
    usuario = _buscar_usuario_ajeno(db, user_id, current_user, "No podés reactivar tu propia cuenta")

    usuario.activo = True
    db.commit()
    db.refresh(usuario)

    _log_accion_manager(db, current_user, "reactivar", usuario.nombre_usuario, usuario.id)
    return usuario
