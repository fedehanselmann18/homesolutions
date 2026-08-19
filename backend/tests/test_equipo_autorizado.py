"""
Tests de la whitelist de autoregistro en la base (usuarios_autorizados) y de
los endpoints con los que la cuenta "Manager" da de alta y de baja gente del
equipo. Antes esto era la env var ROLES_PERMITIDOS_JSON (ver config.py).

Los fixtures usuario_manager/headers_manager viven en test_reseteo_password.py;
acá se redefinen porque pytest no los comparte entre módulos (no están en
conftest.py a propósito: solo los usan los tests de la cuenta Manager).
"""

import uuid

import pytest

from app.auth.oAuth2 import NOMBRE_USUARIO_MANAGER, create_access_token
from app.auth.verification import hash_password
from app.db import models


@pytest.fixture()
def usuario_manager(db_session):
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


# ---------------------------------------------------------------------------
# POST /usuarios/autorizados
# ---------------------------------------------------------------------------


def test_manager_autoriza_a_alguien_nuevo_y_esa_persona_puede_registrarse(client, headers_manager):
    respuesta = client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": "Sofia", "rol": "lectura"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["nombre_usuario"] == "Sofia"
    assert respuesta.json()["rol"] == "lectura"
    assert respuesta.json()["ya_registrado"] is False

    # Cierra el circuito: la autorización habilita el autoregistro público.
    alta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Sofia", "rol": "lectura", "password": "clave-segura-123"},
    )
    assert alta.status_code == 201
    assert alta.json()["rol"] == "lectura"


def test_el_alta_sin_rol_toma_el_de_la_whitelist(client, headers_manager):
    """
    El front ya no manda "rol": no puede saberlo, porque el combo público de
    /registro (opciones-registro) devuelve solo nombres para no filtrar
    quién es admin. El servidor lo resuelve con la whitelist.
    """
    client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": "Sofia", "rol": "admin"},
        headers=headers_manager,
    )

    alta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Sofia", "password": "clave-segura-123"},
    )

    assert alta.status_code == 201
    assert alta.json()["rol"] == "admin"


def test_el_rol_lo_decide_la_whitelist_y_no_el_body_del_alta(client, headers_manager):
    client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": "Sofia", "rol": "lectura"},
        headers=headers_manager,
    )

    alta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Sofia", "rol": "admin", "password": "clave-segura-123"},
    )
    assert alta.status_code == 400


def test_no_se_puede_autorizar_dos_veces_el_mismo_nombre(client, headers_manager):
    client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": "Sofia", "rol": "lectura"},
        headers=headers_manager,
    )
    repetido = client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": "Sofia", "rol": "admin"},
        headers=headers_manager,
    )

    assert repetido.status_code == 400


def test_no_se_puede_autorizar_a_alguien_que_ya_tiene_cuenta(client, headers_manager, usuario_admin):
    respuesta = client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": usuario_admin.nombre_usuario, "rol": "admin"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 400


def test_autorizar_a_manager_de_nuevo_es_rechazado(client, headers_manager, equipo_autorizado):
    """
    La fila de "Manager" la siembra la migración e7b2f4c19a83, así que este
    endpoint la ve como duplicada. Importa que se rechace: si se pudiera
    re-autorizar, se podría cambiarle el rol de "lectura" a "admin" por la
    puerta de atrás.
    """
    respuesta = client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": NOMBRE_USUARIO_MANAGER, "rol": "admin"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 400


def test_no_se_puede_revocar_la_autorizacion_de_manager(
    client, headers_manager, equipo_autorizado, db_session
):
    """
    Esa fila es el failsafe de la cuenta de mantenimiento: si se pierde la
    contraseña, la recuperación es borrar la cuenta de la tabla "usuarios" y
    volver a registrarse desde /registro, y eso solo funciona mientras la
    autorización siga existiendo.
    """
    autorizacion = (
        db_session.query(models.UsuarioAutorizado)
        .filter(models.UsuarioAutorizado.nombre_usuario == NOMBRE_USUARIO_MANAGER)
        .first()
    )

    respuesta = client.delete(f"/usuarios/autorizados/{autorizacion.id}", headers=headers_manager)

    assert respuesta.status_code == 400
    assert (
        db_session.query(models.UsuarioAutorizado)
        .filter(models.UsuarioAutorizado.nombre_usuario == NOMBRE_USUARIO_MANAGER)
        .first()
        is not None
    )


def test_rol_invalido_al_autorizar_es_rechazado(client, headers_manager):
    # rol es Literal["admin", "lectura"] en el schema: Pydantic corta antes
    # de llegar a la ruta.
    respuesta = client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": "Sofia", "rol": "superadmin"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 422


def test_un_admin_que_no_es_manager_no_puede_autorizar(client, headers_admin):
    respuesta = client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": "Sofia", "rol": "lectura"},
        headers=headers_admin,
    )

    assert respuesta.status_code == 403


def test_autorizar_sin_sesion_es_rechazado(client):
    respuesta = client.post("/usuarios/autorizados", json={"nombre_usuario": "Sofia", "rol": "lectura"})

    assert respuesta.status_code == 401


# ---------------------------------------------------------------------------
# GET /usuarios/autorizados
# ---------------------------------------------------------------------------


def test_lista_de_autorizados_marca_quien_ya_se_registro(
    client, headers_manager, equipo_autorizado, usuario_admin
):
    # Alejandro está autorizado pero no se registró; se registra ahora.
    client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Alejandro", "rol": "lectura", "password": "clave-segura-123"},
    )

    respuesta = client.get("/usuarios/autorizados", headers=headers_manager)

    assert respuesta.status_code == 200
    por_nombre = {fila["nombre_usuario"]: fila for fila in respuesta.json()}
    assert por_nombre["Alejandro"]["ya_registrado"] is True
    assert por_nombre["Agustin"]["ya_registrado"] is False


def test_un_admin_que_no_es_manager_no_puede_ver_la_lista_de_autorizados(client, headers_admin):
    respuesta = client.get("/usuarios/autorizados", headers=headers_admin)

    assert respuesta.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /usuarios/autorizados/{id}
# ---------------------------------------------------------------------------


def test_manager_revoca_una_autorizacion_pendiente(client, headers_manager, db_session):
    creada = client.post(
        "/usuarios/autorizados",
        json={"nombre_usuario": "Sofia", "rol": "lectura"},
        headers=headers_manager,
    ).json()

    respuesta = client.delete(f"/usuarios/autorizados/{creada['id']}", headers=headers_manager)

    assert respuesta.status_code == 204
    # Y ya no puede registrarse.
    alta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Sofia", "rol": "lectura", "password": "clave-segura-123"},
    )
    assert alta.status_code == 403


def test_no_se_revoca_la_autorizacion_de_alguien_que_ya_se_registro(
    client, headers_manager, equipo_autorizado
):
    """
    Borrar la fila no le sacaría el acceso a quien ya tiene cuenta (sería
    una falsa sensación de seguridad): para eso está /desactivar.
    """
    client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Alejandro", "rol": "lectura", "password": "clave-segura-123"},
    )
    autorizacion = next(a for a in equipo_autorizado if a.nombre_usuario == "Alejandro")

    respuesta = client.delete(f"/usuarios/autorizados/{autorizacion.id}", headers=headers_manager)

    assert respuesta.status_code == 400


def test_revocar_una_autorizacion_inexistente_da_404(client, headers_manager):
    respuesta = client.delete(f"/usuarios/autorizados/{uuid.uuid4()}", headers=headers_manager)

    assert respuesta.status_code == 404


def test_un_admin_que_no_es_manager_no_puede_revocar(client, headers_admin, equipo_autorizado):
    autorizacion = equipo_autorizado[0]

    respuesta = client.delete(f"/usuarios/autorizados/{autorizacion.id}", headers=headers_admin)

    assert respuesta.status_code == 403


# ---------------------------------------------------------------------------
# GET /usuarios/opciones-registro (público)
# ---------------------------------------------------------------------------


def test_opciones_registro_es_publico_y_solo_trae_nombres(client, equipo_autorizado):
    respuesta = client.get("/usuarios/opciones-registro")

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert all(isinstance(item, str) for item in datos)
    assert "Agustin" in datos


def test_opciones_registro_no_incluye_a_quien_ya_se_registro(client, equipo_autorizado):
    client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Alejandro", "rol": "lectura", "password": "clave-segura-123"},
    )

    respuesta = client.get("/usuarios/opciones-registro")

    assert "Alejandro" not in respuesta.json()
    assert "Agustin" in respuesta.json()


def test_opciones_registro_incluye_a_manager_mientras_no_tenga_cuenta(client, equipo_autorizado):
    # Es la ventana conocida de este diseño (ver get_opciones_registro): el
    # combo público muestra "Manager" hasta que la cuenta se crea. El test
    # de que se cierra sola está en test_reseteo_password.py
    # (test_manager_desaparece_de_opciones_registro_al_crearse).
    respuesta = client.get("/usuarios/opciones-registro")

    assert NOMBRE_USUARIO_MANAGER in respuesta.json()
