"""
Tests de la auditoría persistida (tabla `auditoria`, ver models.Auditoria).

Dos mitades:

1. Que las acciones auditadas DEJEN la fila -- tanto el CRUD de negocio
   (log_auditoria en routes/proyectos.py y compañía) como el mantenimiento
   de cuentas (_log_accion_manager en routes/usuarios.py).
2. Que GET /auditoria la devuelva bien: gateado por requiere_manager,
   ordenado del más nuevo al más viejo, con filtros y paginado.

El caso que más importa del primer grupo es el de borrado: la fila de
auditoría tiene que sobrevivir al DELETE del recurso (por eso recurso_id no
es una foreign key).
"""

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.auth.oAuth2 import NOMBRE_USUARIO_MANAGER, create_access_token
from app.auth.verification import hash_password
from app.db import models
from app.routes import proyectos as ruta_proyectos


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


def _crear_auditoria(db_session, usuario, **overrides):
    datos = {
        "usuario_id": usuario.id,
        "accion": "create",
        "tipo_recurso": "Proyecto",
        "recurso_id": str(uuid.uuid4()),
    }
    datos.update(overrides)
    fila = models.Auditoria(**datos)
    db_session.add(fila)
    db_session.commit()
    db_session.refresh(fila)
    return fila


def _proyecto_payload(**overrides):
    payload = {
        "nombre": "Casa Rivadavia",
        "direccion": "Rivadavia 1234",
        "fecha_inicio": "2026-01-01",
        "estado": "en_curso",
        "precio_acordado": 5000000,
    }
    payload.update(overrides)
    return payload


# ---------------------------------------------------------------------------
# Escritura: las acciones auditadas dejan la fila
# ---------------------------------------------------------------------------


def test_crear_un_proyecto_deja_fila_de_auditoria(client, db_session, headers_admin, usuario_admin):
    respuesta = client.post("/proyectos/crear", json=_proyecto_payload(), headers=headers_admin)
    assert respuesta.status_code == 201

    fila = db_session.query(models.Auditoria).one()
    assert fila.accion == "create"
    assert fila.tipo_recurso == "Proyecto"
    assert fila.recurso_id == respuesta.json()["id"]
    assert fila.usuario_id == usuario_admin.id
    assert fila.creado_en is not None


def test_la_auditoria_del_borrado_sobrevive_al_recurso_borrado(
    client, db_session, headers_admin, monkeypatch
):
    """
    El caso que justifica que recurso_id sea String y no una FK: cuando se
    borra un proyecto, la fila de auditoría tiene que quedar apuntando a un
    id que ya no existe en la tabla proyectos.
    """
    monkeypatch.setattr(ruta_proyectos, "eliminar_comprobante", lambda *args, **kwargs: None)

    creado = client.post("/proyectos/crear", json=_proyecto_payload(), headers=headers_admin)
    proyecto_id = creado.json()["id"]

    borrado = client.delete(f"/proyectos/{proyecto_id}", headers=headers_admin)
    assert borrado.status_code == 200

    assert db_session.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first() is None

    acciones = [
        fila.accion
        for fila in db_session.query(models.Auditoria)
        .filter(models.Auditoria.recurso_id == proyecto_id)
        .order_by(models.Auditoria.creado_en)
        .all()
    ]
    assert acciones == ["create", "delete"]


def test_una_accion_de_manager_deja_fila_con_el_usuario_objetivo_en_detalle(
    client, db_session, headers_manager, usuario_manager, usuario_lectura
):
    respuesta = client.post(f"/usuarios/{usuario_lectura.id}/desactivar", headers=headers_manager)
    assert respuesta.status_code == 200

    fila = db_session.query(models.Auditoria).one()
    assert fila.accion == "desactivar"
    assert fila.tipo_recurso == "Usuario"
    assert fila.recurso_id == str(usuario_lectura.id)
    # Quién la ejecutó es Manager, no la persona afectada.
    assert fila.usuario_id == usuario_manager.id
    assert fila.detalle == {"usuario": usuario_lectura.nombre_usuario}


def test_revocar_autorizacion_se_audita_aunque_la_fila_ya_no_exista(
    client, db_session, headers_manager, equipo_autorizado
):
    autorizado = next(a for a in equipo_autorizado if a.nombre_usuario == "Alejandro")
    autorizado_id = autorizado.id

    respuesta = client.delete(f"/usuarios/autorizados/{autorizado_id}", headers=headers_manager)
    assert respuesta.status_code == 204

    fila = db_session.query(models.Auditoria).one()
    assert fila.accion == "revocar autorización"
    assert fila.tipo_recurso == "Autorizacion"
    assert fila.recurso_id == str(autorizado_id)
    assert fila.detalle == {"usuario": "Alejandro"}


def test_una_accion_fallida_no_deja_rastro_de_auditoria(client, db_session, headers_manager):
    """
    La auditoría se escribe DESPUÉS del commit de la acción, así que un
    intento rechazado no puede quedar registrado como si hubiera pasado.
    """
    respuesta = client.post(f"/usuarios/{uuid.uuid4()}/desactivar", headers=headers_manager)
    assert respuesta.status_code == 404
    assert db_session.query(models.Auditoria).count() == 0


# ---------------------------------------------------------------------------
# GET /auditoria
# ---------------------------------------------------------------------------


def test_un_admin_que_no_es_manager_no_ve_la_auditoria(client, headers_admin):
    assert client.get("/auditoria/", headers=headers_admin).status_code == 403


def test_sin_sesion_no_se_ve_la_auditoria(client):
    assert client.get("/auditoria/").status_code == 401


def test_listado_ordenado_del_mas_nuevo_al_mas_viejo_con_nombre_de_usuario(
    client, db_session, headers_manager, usuario_admin
):
    ahora = datetime.now(timezone.utc)
    _crear_auditoria(db_session, usuario_admin, accion="create", creado_en=ahora - timedelta(days=2))
    _crear_auditoria(db_session, usuario_admin, accion="update", creado_en=ahora - timedelta(days=1))
    _crear_auditoria(db_session, usuario_admin, accion="delete", creado_en=ahora)

    cuerpo = client.get("/auditoria/", headers=headers_manager).json()

    assert cuerpo["total"] == 3
    assert [item["accion"] for item in cuerpo["items"]] == ["delete", "update", "create"]
    assert all(item["usuario_nombre"] == usuario_admin.nombre_usuario for item in cuerpo["items"])


def test_filtro_por_tipo_de_recurso(client, db_session, headers_manager, usuario_admin):
    _crear_auditoria(db_session, usuario_admin, tipo_recurso="Proyecto")
    _crear_auditoria(db_session, usuario_admin, tipo_recurso="Compra")
    _crear_auditoria(db_session, usuario_admin, tipo_recurso="Compra")

    cuerpo = client.get("/auditoria/?tipo_recurso=Compra", headers=headers_manager).json()

    assert cuerpo["total"] == 2
    assert {item["tipo_recurso"] for item in cuerpo["items"]} == {"Compra"}


def test_filtro_por_usuario(client, db_session, headers_manager, usuario_admin, usuario_lectura):
    _crear_auditoria(db_session, usuario_admin)
    _crear_auditoria(db_session, usuario_lectura)

    cuerpo = client.get(f"/auditoria/?usuario_id={usuario_lectura.id}", headers=headers_manager).json()

    assert cuerpo["total"] == 1
    assert cuerpo["items"][0]["usuario_nombre"] == usuario_lectura.nombre_usuario


def test_filtro_hasta_incluye_todo_el_dia_indicado(client, db_session, headers_manager, usuario_admin):
    """
    `hasta` es una fecha suelta y creado_en un timestamp: filtrar por
    <= hasta dejaría afuera todo lo que pasó ese día después de las 00:00.
    """
    hoy = datetime.now(timezone.utc)
    _crear_auditoria(db_session, usuario_admin, accion="hoy_tarde", creado_en=hoy.replace(hour=23, minute=45))
    _crear_auditoria(db_session, usuario_admin, accion="manana", creado_en=hoy + timedelta(days=1))

    cuerpo = client.get(f"/auditoria/?hasta={hoy.date().isoformat()}", headers=headers_manager).json()

    assert [item["accion"] for item in cuerpo["items"]] == ["hoy_tarde"]


def test_filtro_desde(client, db_session, headers_manager, usuario_admin):
    ahora = datetime.now(timezone.utc)
    _crear_auditoria(db_session, usuario_admin, accion="vieja", creado_en=ahora - timedelta(days=10))
    _crear_auditoria(db_session, usuario_admin, accion="reciente", creado_en=ahora)

    desde = (ahora - timedelta(days=1)).date().isoformat()
    cuerpo = client.get(f"/auditoria/?desde={desde}", headers=headers_manager).json()

    assert [item["accion"] for item in cuerpo["items"]] == ["reciente"]


def test_paginado_devuelve_el_total_completo_y_la_pagina_pedida(
    client, db_session, headers_manager, usuario_admin
):
    ahora = datetime.now(timezone.utc)
    for i in range(5):
        _crear_auditoria(
            db_session, usuario_admin, accion=f"accion_{i}", creado_en=ahora - timedelta(hours=i)
        )

    cuerpo = client.get("/auditoria/?limit=2&offset=2", headers=headers_manager).json()

    # total es el del filtro entero, no el de la página: es lo que necesita
    # el front para dibujar "mostrando 3-4 de 5".
    assert cuerpo["total"] == 5
    assert [item["accion"] for item in cuerpo["items"]] == ["accion_2", "accion_3"]


def test_tipos_devuelve_solo_los_que_existen(client, db_session, headers_manager, usuario_admin):
    _crear_auditoria(db_session, usuario_admin, tipo_recurso="Proyecto")
    _crear_auditoria(db_session, usuario_admin, tipo_recurso="Compra")
    _crear_auditoria(db_session, usuario_admin, tipo_recurso="Compra")

    assert client.get("/auditoria/tipos", headers=headers_manager).json() == ["Compra", "Proyecto"]


def test_no_hay_forma_de_borrar_auditoria_desde_la_api(client, db_session, headers_manager, usuario_admin):
    fila = _crear_auditoria(db_session, usuario_admin)

    respuesta = client.delete(f"/auditoria/{fila.id}", headers=headers_manager)

    # 404 y no 405: la ruta directamente no existe, ni siquiera para otro
    # verbo. El historial no se borra desde la app, a propósito.
    assert respuesta.status_code == 404
    assert db_session.query(models.Auditoria).count() == 1
