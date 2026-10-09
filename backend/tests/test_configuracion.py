"""
Tests del panel de configuración de Manager:
GET/PATCH/DELETE /configuracion (valores editables, con fallback a
Settings/.env) y GET /configuracion/estado-integraciones (solo lectura de
bucket/Gemini).
"""

import pytest

from app.auth.oAuth2 import NOMBRE_USUARIO_MANAGER, create_access_token
from app.auth.verification import hash_password
from app.config import settings
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
# GET /configuracion
# ---------------------------------------------------------------------------


def test_un_admin_que_no_es_manager_no_ve_la_configuracion(client, headers_admin):
    assert client.get("/configuracion/", headers=headers_admin).status_code == 403


def test_sin_fila_el_valor_efectivo_es_el_del_env(client, headers_manager):
    cuerpo = client.get("/configuracion/", headers=headers_manager).json()

    fila = next(c for c in cuerpo if c["clave"] == "GEMINI_MODEL")
    assert fila["valor"] == settings.GEMINI_MODEL
    assert fila["personalizado"] is False


def test_con_fila_el_valor_efectivo_es_el_de_la_tabla(client, db_session, headers_manager):
    db_session.add(models.Configuracion(clave="GEMINI_MODEL", valor="gemini-piloto"))
    db_session.commit()

    cuerpo = client.get("/configuracion/", headers=headers_manager).json()

    fila = next(c for c in cuerpo if c["clave"] == "GEMINI_MODEL")
    assert fila["valor"] == "gemini-piloto"
    assert fila["personalizado"] is True


# ---------------------------------------------------------------------------
# PATCH /configuracion/{clave}
# ---------------------------------------------------------------------------


def test_un_admin_que_no_es_manager_no_puede_editar(client, headers_admin):
    respuesta = client.patch(
        "/configuracion/GEMINI_MODEL", json={"valor": "otro-modelo"}, headers=headers_admin
    )
    assert respuesta.status_code == 403


def test_editar_una_clave_inexistente_da_404(client, headers_manager):
    respuesta = client.patch(
        "/configuracion/SECRET_KEY", json={"valor": "lo-que-sea"}, headers=headers_manager
    )
    assert respuesta.status_code == 404


def test_editar_con_valor_vacio_es_rechazado(client, headers_manager):
    respuesta = client.patch("/configuracion/GEMINI_MODEL", json={"valor": "   "}, headers=headers_manager)
    assert respuesta.status_code == 422


def test_edita_crea_la_fila_si_no_existia(client, db_session, headers_manager):
    respuesta = client.patch(
        "/configuracion/GEMINI_MODEL", json={"valor": "gemini-nuevo"}, headers=headers_manager
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["valor"] == "gemini-nuevo"
    assert cuerpo["personalizado"] is True

    fila = db_session.query(models.Configuracion).filter(models.Configuracion.clave == "GEMINI_MODEL").one()
    assert fila.valor == "gemini-nuevo"


def test_editar_pisa_la_fila_existente_en_vez_de_duplicarla(client, db_session, headers_manager):
    db_session.add(models.Configuracion(clave="GEMINI_MODEL", valor="viejo"))
    db_session.commit()

    respuesta = client.patch("/configuracion/GEMINI_MODEL", json={"valor": "nuevo"}, headers=headers_manager)

    assert respuesta.status_code == 200
    assert respuesta.json()["valor"] == "nuevo"
    assert db_session.query(models.Configuracion).count() == 1


def test_editar_deja_fila_de_auditoria_con_el_valor_nuevo(
    client, db_session, headers_manager, usuario_manager
):
    client.patch("/configuracion/GEMINI_MODEL", json={"valor": "gemini-piloto"}, headers=headers_manager)

    fila = db_session.query(models.Auditoria).one()
    assert fila.accion == "editar"
    assert fila.tipo_recurso == "Configuracion"
    assert fila.recurso_id == "GEMINI_MODEL"
    assert fila.usuario_id == usuario_manager.id
    assert fila.detalle == {"valor": "gemini-piloto"}


# ---------------------------------------------------------------------------
# DELETE /configuracion/{clave} (restaurar al default del .env)
# ---------------------------------------------------------------------------


def test_restaurar_borra_la_fila_y_vuelve_al_valor_del_env(client, db_session, headers_manager):
    db_session.add(models.Configuracion(clave="GEMINI_MODEL", valor="gemini-piloto"))
    db_session.commit()

    respuesta = client.delete("/configuracion/GEMINI_MODEL", headers=headers_manager)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["valor"] == settings.GEMINI_MODEL
    assert cuerpo["personalizado"] is False
    assert db_session.query(models.Configuracion).count() == 0


def test_restaurar_una_clave_ya_en_default_no_falla_ni_audita(client, db_session, headers_manager):
    respuesta = client.delete("/configuracion/GEMINI_MODEL", headers=headers_manager)

    assert respuesta.status_code == 200
    assert db_session.query(models.Auditoria).count() == 0


def test_restaurar_una_clave_inexistente_da_404(client, headers_manager):
    respuesta = client.delete("/configuracion/SECRET_KEY", headers=headers_manager)
    assert respuesta.status_code == 404


# ---------------------------------------------------------------------------
# GET /configuracion/estado-integraciones
# ---------------------------------------------------------------------------


def test_estado_integraciones_refleja_settings(client, headers_manager):
    respuesta = client.get("/configuracion/estado-integraciones", headers=headers_manager)

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["gemini_configurado"] == bool(settings.GEMINI_API_KEY)
    assert cuerpo["bucket_configurado"] == settings.bucket_configurado


def test_estado_integraciones_es_exclusivo_de_manager(client, headers_admin):
    assert client.get("/configuracion/estado-integraciones", headers=headers_admin).status_code == 403
