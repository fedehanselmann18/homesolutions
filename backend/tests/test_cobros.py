"""Tests de integración de app/api/client_payments.py: creación, edición y notas de
cuenta corriente (más simples que las de Compra: sin líneas de producto)."""

from datetime import date

from app.api import client_payments as ruta_cobros
from app.db import models


def _crear_proyecto(db_session):
    proyecto = models.Project(
        nombre="Proyecto Test",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)
    return proyecto


def test_crear_cobro(client, db_session, headers_admin, cotizacion):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/cobros/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_usd": 200,
            **cotizacion,
            "descripcion": "Primer pago",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_a",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["monto_usd"] == 200.0
    assert cuerpo["monto_ars"] == 200000.0  # 200 * 1000, congelado por el backend
    assert cuerpo["monto_neto_usd"] == 200.0  # sin notas todavía
    assert cuerpo["monto_neto_ars"] == 200000.0


def test_crear_cobro_sin_ser_admin_es_rechazado(client, db_session, headers_lectura, cotizacion):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/cobros/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_usd": 1000,
            **cotizacion,
            "descripcion": "Pago",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_a",
        },
        headers=headers_lectura,
    )
    assert respuesta.status_code == 403


def test_actualizar_cobro(client, db_session, headers_admin, usuario_admin, cotizacion):
    proyecto = _crear_proyecto(db_session)
    cobro = models.ClientPayment(
        proyecto=proyecto,
        usuario_id=usuario_admin.id,
        monto_usd=100,
        monto_ars=100000,
        **cotizacion,
        descripcion="Pago inicial",
        fecha=date(2026, 1, 1),
        tipo_factura="factura_a",
    )
    db_session.add(cobro)
    db_session.commit()
    db_session.refresh(cobro)

    respuesta = client.put(
        f"/cobros/{cobro.id}",
        json={"monto_usd": 150},
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["monto_usd"] == 150.0
    assert cuerpo["monto_ars"] == 150000.0  # recongelado con la cotización que ya tenía
    assert cuerpo["descripcion"] == "Pago inicial"  # no pisado


def test_crear_nota_cobro_actualiza_monto_neto(
    client, db_session, headers_admin, usuario_admin, cotizacion, monkeypatch
):
    monkeypatch.setattr(ruta_cobros, "subir_comprobante", lambda *a, **k: "notas_cobro/fake/nota.pdf")

    proyecto = _crear_proyecto(db_session)
    cobro = models.ClientPayment(
        proyecto=proyecto,
        usuario_id=usuario_admin.id,
        monto_usd=100,
        monto_ars=100000,
        **cotizacion,
        descripcion="Pago inicial",
        fecha=date(2026, 1, 1),
        tipo_factura="factura_a",
    )
    db_session.add(cobro)
    db_session.commit()
    db_session.refresh(cobro)

    respuesta = client.post(
        f"/cobros/{cobro.id}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "factura_a",
            "monto_usd": 20,
            # Otra fecha, otro dólar: la nota NO usa la cotización del cobro.
            "cotizacion_dolar": 1200,
            "tipo_cambio": "blue",
            "descripcion": "Ajuste por descuento acordado",
            "fecha": "2026-01-20",
            "origen": "ajuste_precio",
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["monto_ars"] == 24000.0  # 20 * 1200

    cobro_actualizado = client.get(f"/cobros/{cobro.id}", headers=headers_admin).json()
    assert cobro_actualizado["monto_neto_usd"] == 80.0  # 100 - 20
    # Cada uno con su cotización: 100.000 - 24.000, no (100 - 20) * 1000.
    assert cobro_actualizado["monto_neto_ars"] == 76000.0


def test_el_ars_que_manda_el_front_se_ignora(client, db_session, headers_admin, cotizacion):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/cobros/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_usd": 65000,
            "monto_ars": 1,
            **cotizacion,
            "descripcion": "Anticipo",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_a",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["monto_ars"] == 65000000.0  # 65000 * 1000


def test_nota_de_cobro_sin_cotizacion_valida_se_rechaza(
    client, db_session, headers_admin, usuario_admin, cotizacion, monkeypatch
):
    monkeypatch.setattr(ruta_cobros, "subir_comprobante", lambda *a, **k: "notas_cobro/fake/nota.pdf")
    proyecto = _crear_proyecto(db_session)
    cobro = models.ClientPayment(
        proyecto=proyecto,
        usuario_id=usuario_admin.id,
        monto_usd=100,
        monto_ars=100000,
        **cotizacion,
        descripcion="Pago",
        fecha=date(2026, 1, 1),
        tipo_factura="factura_a",
    )
    db_session.add(cobro)
    db_session.commit()

    respuesta = client.post(
        f"/cobros/{cobro.id}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "factura_a",
            "monto_usd": 20,
            "cotizacion_dolar": 0,
            "tipo_cambio": "blue",
            "descripcion": "Ajuste",
            "fecha": "2026-01-20",
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 422
