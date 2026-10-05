"""
Tests de integración del CRUD de productos: la parte con más lógica de este
router es la relación M2M con categorías (se reemplaza entera en el PUT, no
se acumula) y la regla de que solo un admin puede escribir.
"""

import uuid
from datetime import date

from app.db import models


def _crear_proveedor(db_session):
    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-9")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)
    return proveedor


def _crear_categoria(db_session, nombre="Aires", tipo="equipo"):
    categoria = models.Categoria(nombre=nombre, tipo=tipo)
    db_session.add(categoria)
    db_session.commit()
    db_session.refresh(categoria)
    return categoria


def test_crear_producto_como_admin(client, db_session, headers_admin):
    proveedor = _crear_proveedor(db_session)
    categoria = _crear_categoria(db_session)

    respuesta = client.post(
        "/productos/crear",
        json={
            "proveedor_id": str(proveedor.id),
            "marca": "Surrey",
            "modelo": "3000F",
            "tipo": "equipo",
            "precio": 150000,
            "categoria_ids": [str(categoria.id)],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["marca"] == "Surrey"
    assert [c["nombre"] for c in cuerpo["categorias"]] == ["Aires"]


def test_crear_producto_con_categoria_inexistente_falla(client, db_session, headers_admin):
    proveedor = _crear_proveedor(db_session)

    respuesta = client.post(
        "/productos/crear",
        json={
            "proveedor_id": str(proveedor.id),
            "marca": "Surrey",
            "modelo": "3000F",
            "tipo": "equipo",
            "precio": 150000,
            "categoria_ids": [str(uuid.uuid4())],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 404


def test_crear_producto_sin_ser_admin_es_rechazado(client, db_session, headers_lectura):
    proveedor = _crear_proveedor(db_session)

    respuesta = client.post(
        "/productos/crear",
        json={
            "proveedor_id": str(proveedor.id),
            "marca": "Surrey",
            "modelo": "3000F",
            "tipo": "equipo",
            "precio": 150000,
        },
        headers=headers_lectura,
    )

    assert respuesta.status_code == 403


def test_actualizar_producto_reemplaza_categorias_no_las_suma(client, db_session, headers_admin):
    proveedor = _crear_proveedor(db_session)
    aires = _crear_categoria(db_session, "Aires", "equipo")
    cafeteras = _crear_categoria(db_session, "Cafeteras", "equipo")

    producto = models.Producto(
        proveedor_id=proveedor.id, marca="Surrey", modelo="3000F", tipo="equipo", precio=150000
    )
    producto.categorias = [aires]
    db_session.add(producto)
    db_session.commit()
    db_session.refresh(producto)

    respuesta = client.put(
        f"/productos/{producto.id}",
        json={"categoria_ids": [str(cafeteras.id)]},
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    nombres = {c["nombre"] for c in respuesta.json()["categorias"]}
    assert nombres == {"Cafeteras"}  # "Aires" quedó afuera, no se acumuló con Cafeteras


def test_eliminar_producto_usado_en_una_compra_es_rechazado(client, db_session, headers_admin):
    """
    Cubre la regla RESTRICT de DetalleCompra.producto_id (ver comentario en
    models.py): no se puede borrar un producto que ya fue comprado, porque se
    perdería la trazabilidad de esa compra.
    """
    proveedor = _crear_proveedor(db_session)
    producto = models.Producto(
        proveedor_id=proveedor.id, marca="Surrey", modelo="3000F", tipo="equipo", precio=150000
    )
    db_session.add(producto)

    usuario = models.Usuario(nombre_usuario="autor_compra_test", hashed_password="x", rol="admin")
    proyecto = models.Proyecto(
        nombre="Proyecto Test",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    fase = models.Fase(nombre="Fase Test", estado="en_curso", proyecto=proyecto)
    db_session.add_all([usuario, proyecto, fase])
    db_session.commit()
    db_session.refresh(producto)
    db_session.refresh(fase)
    db_session.refresh(usuario)

    compra = models.Compra(
        fase_id=fase.id,
        proveedor_id=proveedor.id,
        usuario_id=usuario.id,
        descripcion="Compra test",
        precio_neto=150000,
        tipo_factura="A",
        fecha=date(2026, 1, 1),
        condicion_pago="contado",
        estado_pago="pagado",
        estado_envio="entregado",
    )
    db_session.add(compra)
    db_session.commit()
    db_session.refresh(compra)

    detalle = models.DetalleCompra(
        compra_id=compra.id, producto_id=producto.id, cantidad=1, precio_unitario=150000
    )
    db_session.add(detalle)
    db_session.commit()

    respuesta = client.delete(f"/productos/{producto.id}", headers=headers_admin)
    assert respuesta.status_code == 400
