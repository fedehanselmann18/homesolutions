"""
Tests de la reconciliación de archivos en R2 (ver PLAN_MANAGER.md #3):
GET /storage/reconciliacion (huérfanos y rotos) y POST
/storage/reconciliacion/purgar.

No pega contra R2 de verdad: se mockea `listar_objetos_r2` y
`eliminar_comprobante` en el namespace de app.routes.storage (mismo patrón
que test_ia.py con extraer_comprobante), y se fuerza r2_configurado=True
pisando las 4 variables de las que depende esa property -- no se puede
monkeypatchear la property en sí porque Settings no le define setter.
"""

from datetime import date, datetime, timezone

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


@pytest.fixture()
def r2_configurado(monkeypatch):
    monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "cuenta-test")
    monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "key-test")
    monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "secret-test")
    monkeypatch.setattr(settings, "R2_BUCKET_NAME", "bucket-test")
    assert settings.r2_configurado is True


def _comprobante_gasto(db_session, archivo_path, usuario):
    proyecto = models.Proyecto(
        nombre="Proyecto Test",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado=1000000,
    )
    db_session.add(proyecto)
    db_session.flush()

    gasto = models.Gasto(
        proyecto=proyecto,
        usuario_id=usuario.id,
        monto=1000,
        descripcion="Gasto de prueba",
        fecha=date(2026, 1, 1),
        tipo_factura="factura_b",
    )
    db_session.add(gasto)
    db_session.flush()

    comprobante = models.ComprobanteGasto(gasto=gasto, archivo_path=archivo_path)
    db_session.add(comprobante)
    db_session.commit()
    db_session.refresh(comprobante)
    return comprobante


def _objeto_r2(key, tamanio=1024):
    return {"key": key, "tamanio_bytes": tamanio, "modificado_en": datetime.now(timezone.utc)}


# ---------------------------------------------------------------------------
# GET /storage/reconciliacion
# ---------------------------------------------------------------------------


def test_sin_r2_configurado_da_400(client, headers_manager):
    respuesta = client.get("/storage/reconciliacion", headers=headers_manager)
    assert respuesta.status_code == 400


def test_un_admin_que_no_es_manager_no_puede_ver_la_reconciliacion(client, headers_admin, r2_configurado):
    assert client.get("/storage/reconciliacion", headers=headers_admin).status_code == 403


def test_objeto_sin_fila_en_db_es_huerfano(client, db_session, headers_manager, r2_configurado, monkeypatch):
    import app.routes.storage as ruta_storage

    monkeypatch.setattr(ruta_storage, "listar_objetos_r2", lambda: [_objeto_r2("comprobantes_gasto/x/1.pdf")])

    cuerpo = client.get("/storage/reconciliacion", headers=headers_manager).json()

    assert cuerpo["huerfanos"] == [
        {
            "key": "comprobantes_gasto/x/1.pdf",
            "tamanio_bytes": 1024,
            "modificado_en": cuerpo["huerfanos"][0]["modificado_en"],
        }
    ]
    assert cuerpo["rotos"] == []


def test_objeto_con_fila_en_db_no_es_huerfano(
    client, db_session, headers_manager, usuario_admin, r2_configurado, monkeypatch
):
    import app.routes.storage as ruta_storage

    comprobante = _comprobante_gasto(db_session, "comprobantes_gasto/g1/real.pdf", usuario_admin)
    monkeypatch.setattr(ruta_storage, "listar_objetos_r2", lambda: [_objeto_r2(comprobante.archivo_path)])

    cuerpo = client.get("/storage/reconciliacion", headers=headers_manager).json()

    assert cuerpo["huerfanos"] == []
    assert cuerpo["rotos"] == []


def test_fila_en_db_sin_objeto_en_r2_es_rota(
    client, db_session, headers_manager, usuario_admin, r2_configurado, monkeypatch
):
    import app.routes.storage as ruta_storage

    comprobante = _comprobante_gasto(db_session, "comprobantes_gasto/g1/roto.pdf", usuario_admin)
    monkeypatch.setattr(ruta_storage, "listar_objetos_r2", lambda: [])

    cuerpo = client.get("/storage/reconciliacion", headers=headers_manager).json()

    assert cuerpo["huerfanos"] == []
    assert cuerpo["rotos"] == [
        {
            "tipo_recurso": "ComprobanteGasto",
            "recurso_id": str(comprobante.id),
            "archivo_path": "comprobantes_gasto/g1/roto.pdf",
        }
    ]


# ---------------------------------------------------------------------------
# POST /storage/reconciliacion/purgar
# ---------------------------------------------------------------------------


def test_sin_r2_configurado_purgar_da_400(client, headers_manager):
    respuesta = client.post("/storage/reconciliacion/purgar", json={"claves": ["x"]}, headers=headers_manager)
    assert respuesta.status_code == 400


def test_lista_de_claves_vacia_es_rechazada(client, headers_manager, r2_configurado):
    respuesta = client.post("/storage/reconciliacion/purgar", json={"claves": []}, headers=headers_manager)
    assert respuesta.status_code == 422


def test_purga_una_clave_huerfana(
    client, db_session, headers_manager, usuario_manager, r2_configurado, monkeypatch
):
    import app.routes.storage as ruta_storage

    borradas = []
    monkeypatch.setattr(ruta_storage, "eliminar_comprobante", lambda clave: borradas.append(clave))

    respuesta = client.post(
        "/storage/reconciliacion/purgar",
        json={"claves": ["comprobantes_gasto/x/huerfano.pdf"]},
        headers=headers_manager,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["purgadas"] == ["comprobantes_gasto/x/huerfano.pdf"]
    assert cuerpo["omitidas"] == []
    assert borradas == ["comprobantes_gasto/x/huerfano.pdf"]


def test_no_purga_una_clave_que_en_realidad_tiene_fila_en_db(
    client, db_session, headers_manager, usuario_admin, r2_configurado, monkeypatch
):
    import app.routes.storage as ruta_storage

    comprobante = _comprobante_gasto(db_session, "comprobantes_gasto/g1/real.pdf", usuario_admin)
    monkeypatch.setattr(
        ruta_storage, "eliminar_comprobante", lambda clave: pytest.fail("no debería llamarse")
    )

    respuesta = client.post(
        "/storage/reconciliacion/purgar",
        json={"claves": [comprobante.archivo_path]},
        headers=headers_manager,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["purgadas"] == []
    assert cuerpo["omitidas"] == [comprobante.archivo_path]


def test_una_purga_fallida_queda_omitida_sin_romper_el_resto(
    client, db_session, headers_manager, r2_configurado, monkeypatch
):
    from fastapi import HTTPException

    import app.routes.storage as ruta_storage

    def _eliminar(clave):
        if clave == "falla.pdf":
            raise HTTPException(status_code=502, detail="No se pudo borrar")

    monkeypatch.setattr(ruta_storage, "eliminar_comprobante", _eliminar)

    respuesta = client.post(
        "/storage/reconciliacion/purgar",
        json={"claves": ["ok.pdf", "falla.pdf"]},
        headers=headers_manager,
    )

    cuerpo = respuesta.json()
    assert cuerpo["purgadas"] == ["ok.pdf"]
    assert cuerpo["omitidas"] == ["falla.pdf"]


def test_purgar_deja_fila_de_auditoria_con_las_claves_purgadas(
    client, db_session, headers_manager, usuario_manager, r2_configurado, monkeypatch
):
    import app.routes.storage as ruta_storage

    monkeypatch.setattr(ruta_storage, "eliminar_comprobante", lambda clave: None)

    client.post(
        "/storage/reconciliacion/purgar",
        json={"claves": ["a.pdf", "b.pdf"]},
        headers=headers_manager,
    )

    fila = db_session.query(models.Auditoria).one()
    assert fila.accion == "purgar huérfanos R2"
    assert fila.tipo_recurso == "ArchivoR2"
    assert fila.usuario_id == usuario_manager.id
    assert fila.detalle == {"claves": ["a.pdf", "b.pdf"]}


def test_purgar_sin_nada_purgado_no_deja_fila_de_auditoria(
    client, db_session, headers_manager, usuario_admin, r2_configurado, monkeypatch
):
    import app.routes.storage as ruta_storage

    comprobante = _comprobante_gasto(db_session, "comprobantes_gasto/g1/real.pdf", usuario_admin)
    monkeypatch.setattr(
        ruta_storage, "eliminar_comprobante", lambda clave: pytest.fail("no debería llamarse")
    )

    client.post(
        "/storage/reconciliacion/purgar",
        json={"claves": [comprobante.archivo_path]},
        headers=headers_manager,
    )

    assert db_session.query(models.Auditoria).count() == 0
