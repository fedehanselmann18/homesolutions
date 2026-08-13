"""Tests de integración de routes/cobros.py: creación, edición y notas de
cuenta corriente (más simples que las de Compra: sin líneas de producto)."""

from datetime import date

from app.db import models
from app.routes import cobros as ruta_cobros


def _crear_proyecto(db_session):
    proyecto = models.Proyecto(
        nombre="Proyecto Test", direccion="Calle Falsa 123", fecha_inicio=date(2026, 1, 1),
        estado="en_curso", precio_acordado=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)
    return proyecto


def test_crear_cobro(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/cobros/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto": 200000,
            "descripcion": "Primer pago",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_a",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["monto"] == 200000.0
    assert cuerpo["monto_neto"] == 200000.0  # sin notas todavía


def test_crear_cobro_sin_ser_admin_es_rechazado(client, db_session, headers_lectura):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/cobros/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto": 1000,
            "descripcion": "Pago",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_a",
        },
        headers=headers_lectura,
    )
    assert respuesta.status_code == 403


def test_actualizar_cobro(client, db_session, headers_admin, usuario_admin):
    proyecto = _crear_proyecto(db_session)
    cobro = models.Cobro(
        proyecto=proyecto, usuario_id=usuario_admin.id, monto=100000, descripcion="Pago inicial",
        fecha=date(2026, 1, 1), tipo_factura="factura_a",
    )
    db_session.add(cobro)
    db_session.commit()
    db_session.refresh(cobro)

    respuesta = client.put(
        f"/cobros/{cobro.id}",
        json={"monto": 150000},
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["monto"] == 150000.0
    assert cuerpo["descripcion"] == "Pago inicial"  # no pisado


def test_crear_nota_cobro_actualiza_monto_neto(client, db_session, headers_admin, usuario_admin, monkeypatch):
    monkeypatch.setattr(ruta_cobros, "subir_comprobante", lambda *a, **k: "notas_cobro/fake/nota.pdf")

    proyecto = _crear_proyecto(db_session)
    cobro = models.Cobro(
        proyecto=proyecto, usuario_id=usuario_admin.id, monto=100000, descripcion="Pago inicial",
        fecha=date(2026, 1, 1), tipo_factura="factura_a",
    )
    db_session.add(cobro)
    db_session.commit()
    db_session.refresh(cobro)

    respuesta = client.post(
        f"/cobros/{cobro.id}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "nota_credito_a",
            "monto": 20000,
            "descripcion": "Ajuste por descuento acordado",
            "fecha": "2026-01-20",
            "origen": "ajuste_precio",
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 201

    cobro_actualizado = client.get(f"/cobros/{cobro.id}", headers=headers_admin).json()
    assert cobro_actualizado["monto_neto"] == 80000.0  # 100000 - 20000
