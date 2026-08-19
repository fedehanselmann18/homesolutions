"""
Tests del resto del mantenimiento de cuentas que hace la cuenta "Manager":
cambiar rol, cerrar la sesión de alguien y desactivar/reactivar cuentas.
(El reseteo de contraseña vive en test_reseteo_password.py y la whitelist de
autoregistro en test_equipo_autorizado.py.)

Los tres comparten la misma forma: gateados por requiere_manager (ni siquiera
un admin del equipo puede usarlos) y con guard de auto-acción, para que quien
robe la sesión de Manager no pueda usarla contra la propia cuenta.
"""

import uuid
from datetime import datetime, timedelta, timezone

import jwt
import pytest
from sqlalchemy import text

from app.auth.oAuth2 import ALGORITHM, NOMBRE_USUARIO_MANAGER, SECRET_KEY, create_access_token
from app.auth.verification import hash_password
from app.db import models
from app.routes import login as ruta_login


def _token_con_iat_viejo(usuario, segundos: int) -> str:
    """
    Access token firmado con un iat de hace N segundos. create_access_token
    siempre usa "ahora", y TOLERANCIA_REVOCACION (5s) hace que un token
    recién emitido nunca se considere revocado -- para probar la revocación
    hace falta uno un poco más viejo que esa tolerancia.
    """
    ahora = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "user_id": str(usuario.id),
            "iat": ahora - timedelta(seconds=segundos),
            "exp": ahora + timedelta(minutes=30),
            "type": "access",
        },
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


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
# PATCH /usuarios/{id}/rol
# ---------------------------------------------------------------------------


def test_manager_cambia_el_rol_y_aplica_sin_desloguear_a_la_persona(
    client, headers_manager, headers_lectura, usuario_lectura
):
    # Antes del cambio, el usuario de lectura no puede generar el reporte PDF
    # (requiere_admin). Se usa como sonda de "qué rol ve el servidor".
    antes = client.get(f"/proyectos/{uuid.uuid4()}/reporte-pdf", headers=headers_lectura)
    assert antes.status_code == 403

    respuesta = client.patch(
        f"/usuarios/{usuario_lectura.id}/rol",
        json={"rol": "admin"},
        headers=headers_manager,
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["rol"] == "admin"

    # Mismo token de antes (no hizo falta volver a loguearse): el rol se lee
    # de la fila fresca en cada request, así que el cambio ya aplica -- 404
    # es "pasé el chequeo de rol, el proyecto no existe".
    despues = client.get(f"/proyectos/{uuid.uuid4()}/reporte-pdf", headers=headers_lectura)
    assert despues.status_code == 404


def test_manager_no_puede_cambiar_su_propio_rol(client, headers_manager, usuario_manager, db_session):
    respuesta = client.patch(
        f"/usuarios/{usuario_manager.id}/rol",
        json={"rol": "admin"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 400
    db_session.refresh(usuario_manager)
    assert usuario_manager.rol == "lectura"


def test_rol_invalido_es_rechazado(client, headers_manager, usuario_lectura):
    respuesta = client.patch(
        f"/usuarios/{usuario_lectura.id}/rol",
        json={"rol": "superadmin"},
        headers=headers_manager,
    )

    assert respuesta.status_code == 422


def test_cambiar_rol_de_usuario_inexistente_da_404(client, headers_manager):
    respuesta = client.patch(f"/usuarios/{uuid.uuid4()}/rol", json={"rol": "admin"}, headers=headers_manager)

    assert respuesta.status_code == 404


def test_un_admin_que_no_es_manager_no_puede_cambiar_roles(client, headers_admin, usuario_lectura):
    respuesta = client.patch(
        f"/usuarios/{usuario_lectura.id}/rol",
        json={"rol": "admin"},
        headers=headers_admin,
    )

    assert respuesta.status_code == 403


# ---------------------------------------------------------------------------
# POST /usuarios/{id}/cerrar-sesion
# ---------------------------------------------------------------------------


def test_cerrar_sesion_invalida_el_token_pero_deja_entrar_con_la_misma_password(
    client, headers_manager, usuario_admin, db_session
):
    """
    Prueba de verdad la revocación, esquivando dos límites del harness:

    - Cada test corre en UNA transacción y Postgres devuelve siempre el
      now() del inicio de esa transacción, así que el UPDATE del endpoint no
      puede "adelantar" fecha_actualizacion respecto del momento del test.
      Se compensa dejándola primero 1 hora en el pasado (mismo truco que
      test_refresh_token.py), para que el UPDATE la traiga al presente.
    - TOLERANCIA_REVOCACION (5s) perdona los tokens recién emitidos, así que
      el token se firma con un iat 8 segundos viejo: sigue siendo válido
      contra la fecha vieja, y queda revocado contra la nueva.

    Si el endpoint no emitiera un UPDATE real (el riesgo de "tocar" el objeto
    ORM sin cambiar ningún campo), fecha_actualizacion se quedaría 1 hora en
    el pasado y el token seguiría sirviendo -> este test lo detectaría.
    """
    db_session.execute(
        text("UPDATE usuarios SET fecha_actualizacion = now() - interval '1 hour' WHERE id = :id"),
        {"id": str(usuario_admin.id)},
    )
    db_session.commit()

    token_viejo = _token_con_iat_viejo(usuario_admin, segundos=8)
    headers_usuario = {"Authorization": f"Bearer {token_viejo}"}
    assert client.get("/usuarios/me", headers=headers_usuario).status_code == 200

    respuesta = client.post(f"/usuarios/{usuario_admin.id}/cerrar-sesion", headers=headers_manager)
    assert respuesta.status_code == 200

    # El token de antes ya no sirve...
    assert client.get("/usuarios/me", headers=headers_usuario).status_code == 401

    # ...pero la contraseña no se tocó: puede loguearse de nuevo.
    login = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )
    assert login.status_code == 200


def test_manager_no_puede_cerrar_su_propia_sesion(client, headers_manager, usuario_manager):
    respuesta = client.post(f"/usuarios/{usuario_manager.id}/cerrar-sesion", headers=headers_manager)

    assert respuesta.status_code == 400
    # Y su sesión sigue viva.
    assert client.get("/usuarios/me", headers=headers_manager).status_code == 200


def test_cerrar_sesion_de_usuario_inexistente_da_404(client, headers_manager):
    respuesta = client.post(f"/usuarios/{uuid.uuid4()}/cerrar-sesion", headers=headers_manager)

    assert respuesta.status_code == 404


def test_un_admin_que_no_es_manager_no_puede_cerrar_sesiones_ajenas(client, headers_admin, usuario_lectura):
    respuesta = client.post(f"/usuarios/{usuario_lectura.id}/cerrar-sesion", headers=headers_admin)

    assert respuesta.status_code == 403


# ---------------------------------------------------------------------------
# POST /usuarios/{id}/desactivar y /reactivar
# ---------------------------------------------------------------------------


def test_desactivar_corta_la_sesion_abierta_y_bloquea_el_login(
    client, headers_manager, headers_admin, usuario_admin
):
    assert client.get("/usuarios/me", headers=headers_admin).status_code == 200

    respuesta = client.post(f"/usuarios/{usuario_admin.id}/desactivar", headers=headers_manager)
    assert respuesta.status_code == 200
    assert respuesta.json()["activo"] is False

    # La sesión que ya estaba abierta se corta en el próximo request, sin
    # esperar a que venza el token (ver resolver_usuario_vigente).
    assert client.get("/usuarios/me", headers=headers_admin).status_code == 401

    # Y tampoco puede loguearse de nuevo, con la contraseña correcta.
    login = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )
    assert login.status_code == 401


def test_reactivar_devuelve_el_acceso(client, headers_manager, usuario_admin):
    client.post(f"/usuarios/{usuario_admin.id}/desactivar", headers=headers_manager)

    respuesta = client.post(f"/usuarios/{usuario_admin.id}/reactivar", headers=headers_manager)
    assert respuesta.status_code == 200
    assert respuesta.json()["activo"] is True

    login = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )
    assert login.status_code == 200


def test_manager_no_puede_desactivarse_a_si_misma(client, headers_manager, usuario_manager, db_session):
    respuesta = client.post(f"/usuarios/{usuario_manager.id}/desactivar", headers=headers_manager)

    assert respuesta.status_code == 400
    db_session.refresh(usuario_manager)
    assert usuario_manager.activo is True


def test_manager_no_puede_reactivarse_a_si_misma(client, headers_manager, usuario_manager):
    respuesta = client.post(f"/usuarios/{usuario_manager.id}/reactivar", headers=headers_manager)

    assert respuesta.status_code == 400


def test_desactivar_usuario_inexistente_da_404(client, headers_manager):
    respuesta = client.post(f"/usuarios/{uuid.uuid4()}/desactivar", headers=headers_manager)

    assert respuesta.status_code == 404


def test_un_admin_que_no_es_manager_no_puede_desactivar(client, headers_admin, usuario_lectura):
    respuesta = client.post(f"/usuarios/{usuario_lectura.id}/desactivar", headers=headers_admin)

    assert respuesta.status_code == 403


def test_un_admin_que_no_es_manager_no_puede_reactivar(client, headers_admin, usuario_lectura):
    respuesta = client.post(f"/usuarios/{usuario_lectura.id}/reactivar", headers=headers_admin)

    assert respuesta.status_code == 403


# ---------------------------------------------------------------------------
# Login de cuenta desactivada: mismo costo en tiempo que una contraseña mala
# ---------------------------------------------------------------------------


def test_login_de_cuenta_inactiva_igual_verifica_la_password(client, usuario_admin, db_session, monkeypatch):
    """
    El chequeo de `activo` va DESPUÉS de verify_password, nunca en su lugar:
    si se cortara antes, la respuesta de una cuenta desactivada volvería
    mucho más rápido que la de una cuenta activa con contraseña incorrecta
    (bcrypt tarda ~100ms a propósito), y esa diferencia de tiempo sola
    alcanza para averiguar qué cuentas están desactivadas.
    """
    usuario_admin.activo = False
    db_session.commit()

    llamadas = []
    verify_password_real = ruta_login.verify_password

    def espiar_verify_password(*args, **kwargs):
        llamadas.append(args)
        return verify_password_real(*args, **kwargs)

    monkeypatch.setattr(ruta_login, "verify_password", espiar_verify_password)

    respuesta = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )

    assert respuesta.status_code == 401
    assert len(llamadas) == 1


def test_login_de_cuenta_inactiva_no_revela_el_motivo(client, usuario_admin, db_session):
    usuario_admin.activo = False
    db_session.commit()

    inactiva = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )
    password_mala = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "no-es-esta"},
    )

    assert inactiva.status_code == password_mala.status_code == 401
    assert inactiva.json() == password_mala.json()
