"""
Tests de integración de routes/compras.py: creación completa (detalle +
impuestos), edición, y el sub-recurso de notas (cuenta corriente), que es la
parte con más lógica de negocio del router (ver crear_nota_compra).
"""

from datetime import date
from decimal import Decimal

from sqlalchemy.orm import joinedload

from app.db import models
from app.routes import compras as ruta_compras

# Mismo valor que el fixture `cotizacion` de conftest.py; acá va como
# constante porque lo usan helpers que no reciben fixtures.
COTIZACION = {"cotizacion_dolar": 1000, "tipo_cambio": "blue"}


def _crear_proveedor(db_session):
    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-9")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)
    return proveedor


def _crear_producto(db_session, proveedor, precio=100000):
    producto = models.Producto(
        proveedor_id=proveedor.id,
        marca="Surrey",
        modelo="3000F",
        tipo="equipo",
        precio=precio,
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
        nombre="Proyecto Test",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
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
            "precio_neto_ars": 100000,
            **COTIZACION,
            "tipo_factura": "factura_a",
            "fecha": "2026-01-15",
            "medio_pago": "efectivo",
            "estado_pago": "pendiente",
            "estado_envio": "pedido",
            "detalle": [{"producto_id": str(producto.id), "cantidad": 1, "precio_unitario": 100000}],
            "impuestos": [{"impuesto_id": str(impuesto.id), "monto": 21000}],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["precio_total_ars"] == 121000.0  # 100000 neto + 21000 IVA
    assert cuerpo["precio_neto_usd"] == 100.0  # congelado por el backend
    assert cuerpo["precio_total_usd"] == 121.0  # el IVA hereda la cotización de la compra
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
            "precio_neto_ars": precio_unitario * cantidad,
            **COTIZACION,
            "tipo_factura": "factura_a",
            "fecha": "2026-01-15",
            "medio_pago": "efectivo",
            "estado_pago": "pagado",
            "estado_envio": "entregado",
            "detalle": [
                {"producto_id": str(producto.id), "cantidad": cantidad, "precio_unitario": precio_unitario}
            ],
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
            "precio_neto_ars": 1000,
            **COTIZACION,
            "tipo_factura": "factura_a",
            "fecha": "2026-01-15",
            "medio_pago": "efectivo",
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

    compra, _, _ = _crear_compra_con_detalle(
        client, db_session, headers_admin, precio_unitario=100000, cantidad=2
    )
    detalle_compra_id = compra["detalle"][0]["id"]

    respuesta = client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "factura_a",
            "descripcion": "Devolución de 1 unidad fallada",
            "fecha": "2026-01-20",
            "origen": "devolucion_producto",
            # La nota es de otro día: otro dólar que el de su compra (1000).
            "cotizacion_dolar": 1250,
            "tipo_cambio": "blue",
            "detalles_json": f'[{{"detalle_compra_id": "{detalle_compra_id}", "cantidad": 1}}]',
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    nota = respuesta.json()
    assert nota["monto_ars"] == 100000.0  # 1 unidad * 100000 frozen
    assert nota["monto_usd"] == 80.0  # 100000 / 1250: con la cotización de la NOTA

    compra_actualizada = client.get(f"/compras/{compra['id']}", headers=headers_admin).json()
    assert compra_actualizada["precio_total_ars"] == 100000.0  # 200000 neto - 100000 nota_credito
    # 200 USD del neto (a 1000) - 80 USD de la nota (a 1250). NO es 100000 / 1000:
    # por eso se persisten las dos cifras.
    assert compra_actualizada["precio_total_usd"] == 120.0


def test_crear_nota_compra_devolucion_supera_cantidad_comprada_es_rechazado(
    client, db_session, headers_admin, monkeypatch
):
    monkeypatch.setattr(ruta_compras, "subir_comprobante", lambda *a, **k: "notas_compra/fake/nota.pdf")

    compra, _, _ = _crear_compra_con_detalle(
        client, db_session, headers_admin, precio_unitario=100000, cantidad=2
    )
    detalle_compra_id = compra["detalle"][0]["id"]

    respuesta = client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "factura_a",
            "descripcion": "Devolución de más de lo comprado",
            "fecha": "2026-01-20",
            "origen": "devolucion_producto",
            **COTIZACION,
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
            "tipo_factura": "factura_a",
            "descripcion": "Ajuste",
            "fecha": "2026-01-20",
            "monto_ars": 1000,
            **COTIZACION,
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 400
    assert "mismatch simulado" in respuesta.json()["detail"]

    compra_actualizada = client.get(f"/compras/{compra['id']}", headers=headers_admin).json()
    assert compra_actualizada["notas"] == []  # no se creó nada


# ---------------------------------------------------------------------------
# precio_total con eager loading real (B-04): a diferencia de
# test_compra_calculos.py (objetos en memoria, sin DB, ver su docstring),
# esto arma los datos en Postgres y vuelve a traer la Compra con el MISMO
# patrón de joinedload que usa get_compra_by_id en routes/compras.py --
# confirma que la property funciona contra relaciones eager-loaded de
# verdad, no solo contra relaciones asignadas a mano en memoria.
# ---------------------------------------------------------------------------


def test_precio_total_con_impuestos_y_notas_eager_loaded_desde_la_db(
    client, db_session, headers_admin, usuario_admin
):
    proveedor = _crear_proveedor(db_session)
    impuesto = _crear_impuesto(db_session)
    fase = _crear_fase(db_session)

    compra = models.Compra(
        fase_id=fase.id,
        proveedor_id=proveedor.id,
        usuario_id=usuario_admin.id,
        descripcion="Compra test",
        precio_neto_ars=Decimal("100000"),
        precio_neto_usd=Decimal("100"),
        **COTIZACION,
        tipo_factura="factura_a",
        fecha=date(2026, 1, 1),
        medio_pago="efectivo",
        estado_pago="pagado",
        estado_envio="entregado",
    )
    db_session.add(compra)
    db_session.commit()
    db_session.refresh(compra)

    db_session.add(
        models.CompraImpuesto(compra_id=compra.id, impuesto_id=impuesto.id, monto=Decimal("21000"))
    )
    db_session.add(
        models.NotaCompra(
            compra_id=compra.id,
            proveedor_id=proveedor.id,
            usuario_id=usuario_admin.id,
            tipo="nota_credito",
            tipo_factura="factura_a",
            monto_ars=Decimal("10000"),
            monto_usd=Decimal("8"),
            cotizacion_dolar=1250,
            tipo_cambio="blue",
            descripcion="Devolución",
            fecha=date(2026, 1, 15),
            archivo_path="x.pdf",
        )
    )
    db_session.commit()

    # Sesión nueva sería más estricto todavía (fuerza a pegarle a la DB de
    # verdad y no al identity map), pero db_session ya alcanza para probar
    # que las relaciones vienen eager-loaded y no lazy: sin el joinedload,
    # este mismo test pasaría igual (lazy load silencioso), lo que importa
    # acá es que el patrón de la ruta real (ver get_compra_by_id) funciona.
    compra_recargada = (
        db_session.query(models.Compra)
        .options(
            joinedload(models.Compra.impuestos_aplicados),
            joinedload(models.Compra.notas),
        )
        .filter(models.Compra.id == compra.id)
        .one()
    )

    assert compra_recargada.precio_total_ars == 111000.0  # 100000 + 21000 - 10000
    assert compra_recargada.precio_total_usd == 113.0  # 100 + 21 - 8 (la nota con su dólar)


# ---------------------------------------------------------------------------
# Editar detalle e impuestos desde el PUT. El modal de edición manda la compra
# entera (es un formulario: lo que se ve es lo que queda), así que el PUT tiene
# que reconciliar esas dos listas y no sólo las columnas propias.
# ---------------------------------------------------------------------------


def test_actualizar_compra_agrega_un_impuesto(client, db_session, headers_admin):
    compra, _, _ = _crear_compra_con_detalle(client, db_session, headers_admin)
    impuesto = _crear_impuesto(db_session)

    respuesta = client.put(
        f"/compras/{compra['id']}",
        json={"impuestos": [{"impuesto_id": str(impuesto.id), "monto": 42000}]},
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo["impuestos_aplicados"]) == 1
    assert cuerpo["impuestos_aplicados"][0]["monto"] == 42000
    # precio_total = neto + impuestos
    assert cuerpo["precio_total_ars"] == compra["precio_neto_ars"] + 42000
    assert cuerpo["precio_total_usd"] == compra["precio_neto_usd"] + 42


def test_actualizar_compra_quita_un_impuesto(client, db_session, headers_admin):
    compra, _, _ = _crear_compra_con_detalle(client, db_session, headers_admin)
    impuesto = _crear_impuesto(db_session)
    client.put(
        f"/compras/{compra['id']}",
        json={"impuestos": [{"impuesto_id": str(impuesto.id), "monto": 42000}]},
        headers=headers_admin,
    )

    respuesta = client.put(f"/compras/{compra['id']}", json={"impuestos": []}, headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.json()["impuestos_aplicados"] == []


def test_actualizar_compra_cambia_la_cantidad_del_detalle(client, db_session, headers_admin):
    compra, _, _ = _crear_compra_con_detalle(
        client, db_session, headers_admin, precio_unitario=100000, cantidad=2
    )
    linea = compra["detalle"][0]

    respuesta = client.put(
        f"/compras/{compra['id']}",
        json={
            "precio_neto_ars": 500000,
            "detalle": [
                {
                    "producto_id": linea["producto_id"],
                    "cantidad": 5,
                    "precio_unitario": 100000,
                }
            ],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert len(cuerpo["detalle"]) == 1
    assert cuerpo["detalle"][0]["cantidad"] == 5
    assert cuerpo["precio_neto_ars"] == 500000
    assert cuerpo["precio_neto_usd"] == 500.0  # recongelado al cambiar el neto


def test_editar_una_compra_no_desvincula_los_productos_de_sus_notas(client, db_session, headers_admin):
    """
    El vínculo nota -> línea de compra es SET NULL (ver NotaCompraDetalle): si
    el PUT borrara y recreara el detalle en cada guardado, editar cualquier
    campo dejaría a las notas sin saber qué producto se devolvió. La línea que
    no cambia de producto tiene que conservar su id.
    """
    compra, _, _ = _crear_compra_con_detalle(client, db_session, headers_admin)
    linea = compra["detalle"][0]

    respuesta = client.put(
        f"/compras/{compra['id']}",
        json={
            "descripcion": "Descripción nueva",
            "detalle": [
                {
                    "producto_id": linea["producto_id"],
                    "cantidad": linea["cantidad"],
                    "precio_unitario": linea["precio_unitario"],
                }
            ],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["detalle"][0]["id"] == linea["id"]


def test_actualizar_compra_sin_mandar_detalle_lo_deja_intacto(client, db_session, headers_admin):
    """Togglear pago/envío manda sólo ese campo -- no puede vaciar el detalle."""
    compra, _, _ = _crear_compra_con_detalle(client, db_session, headers_admin)

    respuesta = client.put(
        f"/compras/{compra['id']}", json={"estado_pago": "pendiente"}, headers=headers_admin
    )

    assert respuesta.status_code == 200
    assert len(respuesta.json()["detalle"]) == 1
