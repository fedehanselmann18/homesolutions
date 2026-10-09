"""
Tests de los tipos de factura configurables: el router /tipos-factura
(Ajustes), la generación del código, y que los movimientos (compras, gastos,
cobros y sus notas) sólo acepten un código que esté en la tabla.

Los 7 tipos de fábrica los siembra conftest.py una vez por sesión (lo mismo
que la migración b7e3c5a1d9f2).
"""

from datetime import date
from decimal import Decimal

import pytest

from app.db import models
from app.routes import cobros as ruta_cobros
from app.routes import compras as ruta_compras
from app.tipos_factura import TIPO_INVALIDO, generar_codigo

COTIZACION = {"cotizacion_dolar": 1000, "tipo_cambio": "blue"}


def _tipo(db_session, codigo):
    return db_session.query(models.TipoFactura).filter(models.TipoFactura.codigo == codigo).one()


def _crear_proyecto(db_session):
    proyecto = models.Proyecto(
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


def _crear_cobro(db_session, usuario, tipo_factura="factura_a"):
    cobro = models.Cobro(
        proyecto=_crear_proyecto(db_session),
        usuario_id=usuario.id,
        monto_usd=100,
        monto_ars=100000,
        **COTIZACION,
        descripcion="Anticipo",
        fecha=date(2026, 1, 1),
        tipo_factura=tipo_factura,
    )
    db_session.add(cobro)
    db_session.commit()
    db_session.refresh(cobro)
    return cobro


def _crear_compra(db_session, usuario):
    proyecto = _crear_proyecto(db_session)
    fase = models.Fase(nombre="Fase Test", estado="en_curso", proyecto=proyecto)
    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-9")
    db_session.add_all([fase, proveedor])
    db_session.commit()
    compra = models.Compra(
        fase_id=fase.id,
        proveedor_id=proveedor.id,
        usuario_id=usuario.id,
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
    return compra


# ---------------------------------------------------------------------------
# Código generado del nombre
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "nombre, codigo",
    [
        ("Factura interna", "factura_interna"),
        ("  Nota de Crédito  ", "nota_de_credito"),
        ("Ticket / Comprobante X", "ticket_comprobante_x"),
        ("¡¡!!", ""),
        ("A" * 40, "a" * 30),
    ],
)
def test_generar_codigo(nombre, codigo):
    assert generar_codigo(nombre) == codigo


# ---------------------------------------------------------------------------
# Router /tipos-factura
# ---------------------------------------------------------------------------


def test_lista_de_fabrica_en_orden_con_otros_al_final(client, headers_lectura):
    respuesta = client.get("/tipos-factura/", headers=headers_lectura)

    assert respuesta.status_code == 200
    assert [t["nombre"] for t in respuesta.json()] == [
        "Factura A",
        "Factura B",
        "Factura C",
        "Remito",
        "Recibo",
        "Factura interna",
        "Otros",
    ]
    protegidos = [t["codigo"] for t in respuesta.json() if t["protegido"]]
    assert protegidos == ["otros"]


def test_crear_genera_codigo_y_queda_antes_de_otros(client, headers_admin):
    respuesta = client.post("/tipos-factura/crear", json={"nombre": "Ticket"}, headers=headers_admin)

    assert respuesta.status_code == 201
    assert respuesta.json()["codigo"] == "ticket"
    assert respuesta.json()["protegido"] is False

    nombres = [t["nombre"] for t in client.get("/tipos-factura/", headers=headers_admin).json()]
    assert nombres[-2:] == ["Ticket", "Otros"]


def test_crear_con_nombre_repetido_da_400(client, headers_admin):
    respuesta = client.post("/tipos-factura/crear", json={"nombre": "Remito"}, headers=headers_admin)

    assert respuesta.status_code == 400
    assert "nombre" in respuesta.json()["detail"]


def test_crear_con_codigo_que_choca_da_400(client, headers_admin):
    # Otro nombre, mismo código que "Factura A".
    respuesta = client.post("/tipos-factura/crear", json={"nombre": "Factura-A"}, headers=headers_admin)

    assert respuesta.status_code == 400
    assert "parecido" in respuesta.json()["detail"]


def test_crear_sin_letras_da_400(client, headers_admin):
    respuesta = client.post("/tipos-factura/crear", json={"nombre": "¡¡!!"}, headers=headers_admin)

    assert respuesta.status_code == 400


def test_renombrar_no_cambia_el_codigo(client, db_session, headers_admin):
    remito = _tipo(db_session, "remito")

    respuesta = client.put(
        f"/tipos-factura/{remito.id}", json={"nombre": "Remito de entrega"}, headers=headers_admin
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["nombre"] == "Remito de entrega"
    assert respuesta.json()["codigo"] == "remito"


def test_no_se_puede_mandar_el_codigo_al_editar(client, db_session, headers_admin):
    remito = _tipo(db_session, "remito")

    respuesta = client.put(f"/tipos-factura/{remito.id}", json={"codigo": "otro"}, headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.json()["codigo"] == "remito"


def test_borrar_tipo_sin_uso(client, db_session, headers_admin):
    tipo = _tipo(db_session, "factura_c")

    respuesta = client.delete(f"/tipos-factura/{tipo.id}", headers=headers_admin)

    assert respuesta.status_code == 200
    assert db_session.query(models.TipoFactura).filter_by(codigo="factura_c").first() is None


def test_borrar_tipo_en_uso_da_400(client, db_session, headers_admin, usuario_admin):
    _crear_cobro(db_session, usuario_admin, tipo_factura="recibo")
    tipo = _tipo(db_session, "recibo")

    respuesta = client.delete(f"/tipos-factura/{tipo.id}", headers=headers_admin)

    assert respuesta.status_code == 400
    assert "movimientos asociados" in respuesta.json()["detail"]
    assert db_session.query(models.TipoFactura).filter_by(codigo="recibo").first() is not None


def test_otros_no_se_borra_pero_se_renombra(client, db_session, headers_admin):
    otros = _tipo(db_session, "otros")

    borrar = client.delete(f"/tipos-factura/{otros.id}", headers=headers_admin)
    assert borrar.status_code == 400
    assert "Otros" in borrar.json()["detail"]

    renombrar = client.put(
        f"/tipos-factura/{otros.id}", json={"nombre": "Otro comprobante"}, headers=headers_admin
    )
    assert renombrar.status_code == 200
    assert renombrar.json()["protegido"] is True


def test_lectura_no_puede_escribir(client, db_session, headers_lectura):
    tipo = _tipo(db_session, "remito")

    assert (
        client.post("/tipos-factura/crear", json={"nombre": "X"}, headers=headers_lectura).status_code == 403
    )
    assert (
        client.put(f"/tipos-factura/{tipo.id}", json={"nombre": "X"}, headers=headers_lectura).status_code
        == 403
    )
    assert client.delete(f"/tipos-factura/{tipo.id}", headers=headers_lectura).status_code == 403


# ---------------------------------------------------------------------------
# Movimientos: sólo códigos de la tabla
# ---------------------------------------------------------------------------


def test_gasto_con_tipo_inexistente_da_400(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_ars": 1000,
            **COTIZACION,
            "descripcion": "Flete",
            "fecha": "2026-01-15",
            "tipo_factura": "cualquiera",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == TIPO_INVALIDO


def test_gasto_con_tipo_nuevo_se_guarda(client, db_session, headers_admin):
    client.post("/tipos-factura/crear", json={"nombre": "Ticket"}, headers=headers_admin)
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_ars": 1000,
            **COTIZACION,
            "descripcion": "Almuerzo",
            "fecha": "2026-01-15",
            "tipo_factura": "ticket",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["tipo_factura"] == "ticket"


def test_editar_gasto_con_tipo_inexistente_da_400(client, db_session, headers_admin, usuario_admin):
    proyecto = _crear_proyecto(db_session)
    gasto = models.Gasto(
        proyecto_id=proyecto.id,
        usuario_id=usuario_admin.id,
        monto_ars=1000,
        monto_usd=1,
        **COTIZACION,
        descripcion="Flete",
        fecha=date(2026, 1, 1),
        tipo_factura="otros",
    )
    db_session.add(gasto)
    db_session.commit()

    respuesta = client.put(f"/gastos/{gasto.id}", json={"tipo_factura": "cualquiera"}, headers=headers_admin)

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == TIPO_INVALIDO


def test_cobro_con_tipo_inexistente_da_400(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/cobros/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_usd": 100,
            **COTIZACION,
            "descripcion": "Anticipo",
            "fecha": "2026-01-15",
            "tipo_factura": "cualquiera",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 400


def test_editar_cobro_con_tipo_inexistente_da_400(client, db_session, headers_admin, usuario_admin):
    cobro = _crear_cobro(db_session, usuario_admin)

    respuesta = client.put(f"/cobros/{cobro.id}", json={"tipo_factura": "cualquiera"}, headers=headers_admin)

    assert respuesta.status_code == 400


def test_compra_con_tipo_inexistente_da_400(client, db_session, headers_admin, usuario_admin):
    compra = _crear_compra(db_session, usuario_admin)

    respuesta = client.post(
        "/compras/crear",
        json={
            "fase_id": str(compra.fase_id),
            "proveedor_id": str(compra.proveedor_id),
            "descripcion": "Compra",
            "precio_neto_ars": 1000,
            **COTIZACION,
            "tipo_factura": "cualquiera",
            "fecha": "2026-01-15",
            "medio_pago": "efectivo",
            "estado_pago": "pendiente",
            "estado_envio": "pedido",
            "detalle": [],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == TIPO_INVALIDO


def test_editar_compra_con_tipo_inexistente_da_400(client, db_session, headers_admin, usuario_admin):
    compra = _crear_compra(db_session, usuario_admin)

    respuesta = client.put(
        f"/compras/{compra.id}", json={"tipo_factura": "cualquiera"}, headers=headers_admin
    )

    assert respuesta.status_code == 400


def _no_subir(*args, **kwargs):
    raise AssertionError("no tendría que subir el comprobante con un tipo inválido")


def test_nota_compra_con_tipo_inexistente_da_400_sin_subir_archivo(
    client, db_session, headers_admin, usuario_admin, monkeypatch
):
    compra = _crear_compra(db_session, usuario_admin)
    monkeypatch.setattr(ruta_compras, "subir_comprobante", _no_subir)

    respuesta = client.post(
        f"/compras/{compra.id}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "cualquiera",
            "monto_ars": 1000,
            **COTIZACION,
            "descripcion": "Descuento",
            "fecha": "2026-01-20",
            "origen": "acuerdo_comercial",
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == TIPO_INVALIDO


def test_nota_cobro_con_tipo_inexistente_da_400_sin_subir_archivo(
    client, db_session, headers_admin, usuario_admin, monkeypatch
):
    cobro = _crear_cobro(db_session, usuario_admin)
    monkeypatch.setattr(ruta_cobros, "subir_comprobante", _no_subir)

    respuesta = client.post(
        f"/cobros/{cobro.id}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "cualquiera",
            "monto_usd": 10,
            **COTIZACION,
            "descripcion": "Ajuste",
            "fecha": "2026-01-20",
            "origen": "ajuste_precio",
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == TIPO_INVALIDO
