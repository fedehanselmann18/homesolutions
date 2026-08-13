"""
Tests de integración de routes/compras.py: creación completa (detalle +
impuestos), edición, y el sub-recurso de notas (cuenta corriente), que es la
parte con más lógica de negocio del router (ver crear_nota_compra).
"""

from datetime import date

from app.db import models
from app.routes import compras as ruta_compras


def _crear_proveedor(db_session):
    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-9")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)
    return proveedor


def _crear_producto(db_session, proveedor, precio=100000):
    producto = models.Producto(
        proveedor_id=proveedor.id, marca="Surrey", modelo="3000F", tipo="equipo", precio=precio,
    )
    db_session.add(producto)
    db_session.commit()
    db_session.refresh(producto)
    return producto


def _crear_impuesto(db_session, nombre="IVA"):
    impuesto = models.Impuesto(nombre=nombre)
    db_session.add(impuesto)
    db_session.commit()
    db_session.refresh(impuesto)
    return impuesto


def _crear_fase(db_session):
    proyecto = models.Proyecto(
        nombre="Proyecto Test", direccion="Calle Falsa 123", fecha_inicio=date(2026, 1, 1),
        estado="en_curso", precio_acordado=1000000,
    )
    fase = models.Fase(nombre="Fase Test", estado="en_curso", proyecto=proyecto)
    db_session.add_all([proyecto, fase])
    db_session.commit()
    db_session.refresh(fase)
    return fase


def test_crear_compra_con_detalle_e_impuestos(client, db_session, headers_admin):
    proveedor = _crear_proveedor(db_session)
    producto = _crear_producto(db_session, proveedor, precio=100000)
    impuesto = _crear_impuesto(db_session)
    fase = _crear_fase(db_session)

    respuesta = client.post(
        "/compras/crear",
        json={
            "fase_id": str(fase.id),
            "proveedor_id": str(proveedor.id),
            "descripcion": "Compra de aires",
            "precio_neto": 100000,
            "tipo_factura": "factura_a",
            "fecha": "2026-01-15",
            "condicion_pago": "contado",
            "estado_pago": "pendiente",
            "estado_envio": "pedido",
            "detalle": [{"producto_id": str(producto.id), "cantidad": 1, "precio_unitario": 100000}],
            "impuestos": [{"impuesto_id": str(impuesto.id), "monto": 21000}],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["precio_total"] == 121000.0  # 100000 neto + 21000 IVA
    assert len(cuerpo["detalle"]) == 1
    assert len(cuerpo["impuestos_aplicados"]) == 1
    assert cuerpo["tipos_compra"] == ["equipo"]  # derivado del producto


def _crear_compra_con_detalle(client, db_session, headers_admin, precio_unitario=100000, cantidad=2):
    proveedor = _crear_proveedor(db_session)
    producto = _crear_producto(db_session, proveedor, precio=precio_unitario)
    fase = _crear_fase(db_session)

    respuesta = client.post(
        "/compras/crear",
        json={
            "fase_id": str(fase.id),
            "proveedor_id": str(proveedor.id),
            "descripcion": "Compra de materiales",
            "precio_neto": precio_unitario * cantidad,
            "tipo_factura": "factura_a",
            "fecha": "2026-01-15",
            "condicion_pago": "contado",
            "estado_pago": "pagado",
            "estado_envio": "entregado",
            "detalle": [{"producto_id": str(producto.id), "cantidad": cantidad, "precio_unitario": precio_unitario}],
            "impuestos": [],
        },
        headers=headers_admin,
    )
    assert respuesta.status_code == 201
    return respuesta.json(), proveedor, fase


def test_actualizar_compra_solo_pisa_los_campos_enviados(client, db_session, headers_admin):
    compra, _, _ = _crear_compra_con_detalle(client, db_session, headers_admin)

    respuesta = client.put(
        f"/compras/{compra['id']}",
        json={"estado_pago": "pagado"},
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado_pago"] == "pagado"
    assert cuerpo["descripcion"] == "Compra de materiales"  # no pisado


def test_crear_compra_sin_ser_admin_es_rechazado(client, db_session, headers_lectura):
    proveedor = _crear_proveedor(db_session)
    fase = _crear_fase(db_session)

    respuesta = client.post(
        "/compras/crear",
        json={
            "fase_id": str(fase.id),
            "proveedor_id": str(proveedor.id),
            "descripcion": "Compra",
            "precio_neto": 1000,
            "tipo_factura": "factura_a",
            "fecha": "2026-01-15",
            "condicion_pago": "contado",
            "estado_pago": "pendiente",
            "estado_envio": "pedido",
            "detalle": [],
            "impuestos": [],
        },
        headers=headers_lectura,
    )
    assert respuesta.status_code == 403


def test_crear_nota_compra_devolucion_producto_actualiza_precio_total(
    client, db_session, headers_admin, monkeypatch
):
    """Devolver 1 de las 2 unidades compradas: la nota se calcula sola
    (cantidad * precio_unitario frozen de la línea, ver crear_nota_compra) y
    precio_total de la compra la resta. Se mockea subir_comprobante (mismo
    patrón que test_ia.py) para no escribir en disco durante el test."""
    monkeypatch.setattr(ruta_compras, "subir_comprobante", lambda *a, **k: "notas_compra/fake/nota.pdf")

    compra, _, _ = _crear_compra_con_detalle(client, db_session, headers_admin, precio_unitario=100000, cantidad=2)
    detalle_compra_id = compra["detalle"][0]["id"]

    respuesta = client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "nota_credito_a",
            "descripcion": "Devolución de 1 unidad fallada",
            "fecha": "2026-01-20",
            "origen": "devolucion_producto",
            "detalles_json": f'[{{"detalle_compra_id": "{detalle_compra_id}", "cantidad": 1}}]',
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    nota = respuesta.json()
    assert nota["monto"] == 100000.0  # 1 unidad * 100000 frozen

    compra_actualizada = client.get(f"/compras/{compra['id']}", headers=headers_admin).json()
    assert compra_actualizada["precio_total"] == 100000.0  # 200000 neto - 100000 nota_credito


def test_crear_nota_compra_devolucion_supera_cantidad_comprada_es_rechazado(
    client, db_session, headers_admin, monkeypatch
):
    monkeypatch.setattr(ruta_compras, "subir_comprobante", lambda *a, **k: "notas_compra/fake/nota.pdf")

    compra, _, _ = _crear_compra_con_detalle(client, db_session, headers_admin, precio_unitario=100000, cantidad=2)
    detalle_compra_id = compra["detalle"][0]["id"]

    respuesta = client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "nota_credito_a",
            "descripcion": "Devolución de más de lo comprado",
            "fecha": "2026-01-20",
            "origen": "devolucion_producto",
            "detalles_json": f'[{{"detalle_compra_id": "{detalle_compra_id}", "cantidad": 5}}]',
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 400


def test_crear_nota_compra_con_integridad_de_proveedor_rota_es_rechazada(
    client, db_session, headers_admin, monkeypatch
):
    """No se puede forzar un mismatch real por la API (proveedor_id siempre
    se copia de la compra en crear_nota_compra) -- este test verifica que la
    ruta de verdad usa validar_integridad_nota_compra (ver test_compra_
    calculos.py para el chequeo en sí, sin mock): si esa validación explota,
    el request tiene que fallar con 400 y NO crear la nota."""
    monkeypatch.setattr(ruta_compras, "subir_comprobante", lambda *a, **k: "notas_compra/fake/nota.pdf")

    def _simular_mismatch(nota, compra):
        raise ValueError("mismatch simulado de proveedor")

    monkeypatch.setattr(ruta_compras.models, "validar_integridad_nota_compra", _simular_mismatch)

    compra, _, _ = _crear_compra_con_detalle(client, db_session, headers_admin)

    respuesta = client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_debito",
            "tipo_factura": "nota_debito_a",
            "descripcion": "Ajuste",
            "fecha": "2026-01-20",
            "monto": 1000,
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 400
    assert "mismatch simulado" in respuesta.json()["detail"]

    compra_actualizada = client.get(f"/compras/{compra['id']}", headers=headers_admin).json()
    assert compra_actualizada["notas"] == []  # no se creó nada
