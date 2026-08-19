"""
Tests del reseteo manual de contraseñas (POST /usuarios/{id}/resetear-password),
la única cosa que puede hacer la cuenta "Manager" (ver requiere_manager en
app/auth/oAuth2.py). Mismo estilo de fixtures que test_login.py.

La revocación de la sesión de la persona a la que le resetean la contraseña
(el UPDATE toca fecha_actualizacion y resolver_usuario_vigente invalida los
tokens emitidos antes, B-06) no se testea acá: cada test corre dentro de una
única transacción (ver conftest.py) y Postgres devuelve siempre el now() del
inicio de esa transacción, así que fecha_actualizacion no se puede mover
desde adentro del test. El mecanismo en sí está cubierto en
test_refresh_token.py.
"""

import uuid

import pytest

from app.auth.oAuth2 import NOMBRE_USUARIO_MANAGER, create_access_token
from app.auth.verification import hash_password
from app.db import models


@pytest.fixture()
def usuario_manager(db_session):
    """
    La cuenta "Manager" tal como la crea scripts/crear_usuario_manager.py:
    rol "lectura" a propósito, su permiso especial NO viene del rol.
    """
    manager = models.Usuario(
        nombre_usuario=NOMBRE_USUARIO_MANAGER,
        hashed_password=hash_password("clave-de-test-123"),
        rol="lectura",
    )
    db_session.add(manager)
    db_session.commit()
    db_session.refresh(manager)
    return manager


@pytest.fixture()
def headers_manager(usuario_manager):
    token = create_access_token(data={"user_id": str(usuario_manager.id)})
    return {"Authorization": f"Bearer {token}"}


def test_manager_resetea_la_password_y_el_usuario_puede_loguearse_con_la_nueva(
    client, headers_manager, usuario_admin
):
    respuesta = client.post(
        f"/usuarios/{usuario_admin.id}/resetear-password",
        json={"password": "clave-nueva-456"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["nombre_usuario"] == usuario_admin.nombre_usuario

    login_nuevo = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-nueva-456"},
    )
    assert login_nuevo.status_code == 200

    login_viejo = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )
    assert login_viejo.status_code == 401


def test_un_admin_que_no_es_manager_no_puede_resetear_passwords(client, headers_admin, usuario_lectura):
    respuesta = client.post(
        f"/usuarios/{usuario_lectura.id}/resetear-password",
        json={"password": "clave-nueva-456"},
        headers=headers_admin,
    )

    assert respuesta.status_code == 403


def test_resetear_password_sin_sesion_es_rechazado(client, usuario_admin):
    respuesta = client.post(
        f"/usuarios/{usuario_admin.id}/resetear-password",
        json={"password": "clave-nueva-456"},
    )

    assert respuesta.status_code == 401


def test_resetear_password_de_un_usuario_inexistente_da_404(client, headers_manager):
    respuesta = client.post(
        f"/usuarios/{uuid.uuid4()}/resetear-password",
        json={"password": "clave-nueva-456"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 404


def test_password_de_menos_de_8_caracteres_es_rechazada(client, headers_manager, usuario_admin):
    respuesta = client.post(
        f"/usuarios/{usuario_admin.id}/resetear-password",
        json={"password": "corta"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 422


def test_manager_se_crea_desde_el_registro_publico(client, equipo_autorizado):
    """
    "Manager" está en la whitelist (migración e7b2f4c19a83): se registra
    desde /registro como cualquier otro, y le toca el rol "lectura" que fija
    la whitelist -- su poder especial no viene del rol sino del nombre (ver
    requiere_manager).
    """
    respuesta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": NOMBRE_USUARIO_MANAGER, "password": "clave-del-manager"},
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["rol"] == "lectura"


def test_manager_no_se_puede_crear_dos_veces(client, equipo_autorizado):
    """
    Lo que cierra la ventana de riesgo del autoregistro público: una vez que
    la cuenta existe, nadie puede volver a reclamarla con otra contraseña.
    """
    primera = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": NOMBRE_USUARIO_MANAGER, "password": "clave-del-duenio"},
    )
    assert primera.status_code == 201

    segunda = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": NOMBRE_USUARIO_MANAGER, "password": "clave-del-atacante"},
    )

    assert segunda.status_code == 400

    # La contraseña original sigue siendo la que vale.
    login = client.post(
        "/auth/login",
        data={"username": NOMBRE_USUARIO_MANAGER, "password": "clave-del-duenio"},
    )
    assert login.status_code == 200


def test_manager_desaparece_de_opciones_registro_al_crearse(client, equipo_autorizado):
    """
    La ventana se cierra sola, sin deploy ni limpieza a mano: el combo
    público de /registro solo lista autorizados que todavía no tienen
    cuenta.
    """
    assert NOMBRE_USUARIO_MANAGER in client.get("/usuarios/opciones-registro").json()

    client.post(
        "/usuarios/crear",
        json={"nombre_usuario": NOMBRE_USUARIO_MANAGER, "password": "clave-del-duenio"},
    )

    assert NOMBRE_USUARIO_MANAGER not in client.get("/usuarios/opciones-registro").json()


def test_manager_no_puede_resetearse_su_propia_password(client, headers_manager, usuario_manager):
    """
    Si alguien roba la sesión de Manager, no tiene que poder cambiarle la
    contraseña a la propia cuenta -- eso dejaría al dueño del proyecto sin
    acceso, con la única recuperación siendo borrar la cuenta de la base y
    correr el script de nuevo.
    """
    respuesta = client.post(
        f"/usuarios/{usuario_manager.id}/resetear-password",
        json={"password": "clave-nueva-456"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 400

    login = client.post(
        "/auth/login",
        data={"username": NOMBRE_USUARIO_MANAGER, "password": "clave-de-test-123"},
    )
    assert login.status_code == 200


def test_manager_aparece_en_las_opciones_de_login(client, usuario_manager, usuario_admin):
    """
    Se elige del combo como cualquier otra cuenta. Esconderla acá no sumaba
    seguridad real (el nombre es adivinable; lo único que la protege es la
    contraseña) y obligaba a tipearlo a mano en cada login.
    """
    respuesta = client.get("/usuarios/login-options")

    assert respuesta.status_code == 200
    nombres = respuesta.json()
    assert NOMBRE_USUARIO_MANAGER in nombres
    assert usuario_admin.nombre_usuario in nombres


def test_rate_limit_de_resetear_password_bloquea_despues_de_20_por_hora(client, headers_manager):
    # Mismo patrón que test_rate_limit_de_login_bloquea_despues_de_5_intentos_por_minuto
    # (test_seguridad.py). Apunta a un id distinto (inexistente, 404) en
    # cada request a propósito: slowapi usa la URL como parte de la clave
    # del límite por default, y esta ruta tiene un {user_id} dinámico -- si
    # el endpoint usara @limiter.limit en vez de shared_limit(scope=...),
    # este test pasaría de largo sin ver nunca un 429, porque cada uuid
    # distinto armaría su propio balde. Este test existe para probar que
    # el scope fijo agrupa todos los user_id bajo un solo límite por IP.
    for _ in range(20):
        respuesta = client.post(
            f"/usuarios/{uuid.uuid4()}/resetear-password",
            json={"password": "clave-nueva-456"},
            headers=headers_manager,
        )
        assert respuesta.status_code == 404

    respuesta = client.post(
        f"/usuarios/{uuid.uuid4()}/resetear-password",
        json={"password": "clave-nueva-456"},
        headers=headers_manager,
    )
    assert respuesta.status_code == 429
