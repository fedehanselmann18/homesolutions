"""
Tests de los medios de pago configurables: el router /medios-pago (Ajustes),
y que compras y gastos sólo acepten un medio que exista y esté activo.

Los 4 medios de fábrica los siembra conftest.py una vez por sesión (lo mismo
que la migración c3f8a2d6e1b7).
"""

from datetime import date
from decimal import Decimal

from app.db import models
from app.medios_pago import MEDIO_INVALIDO

COTIZACION = {"cotizacion_dolar": 1000, "tipo_cambio": "blue"}


def _medio(db_session, codigo):
    return db_session.query(models.MedioPago).filter(models.MedioPago.codigo == codigo).one()


def _crear_fase_y_proveedor(db_session):
    proyecto = models.Proyecto(
        nombre="Proyecto Test",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    fase = models.Fase(nombre="Fase Test", estado="en_curso", proyecto=proyecto)
    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-9")
    db_session.add_all([proyecto, fase, proveedor])
    db_session.commit()
    return proyecto, fase, proveedor


def _crear_compra(db_session, usuario, medio_pago="efectivo"):
    _, fase, proveedor = _crear_fase_y_proveedor(db_session)
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
        medio_pago=medio_pago,
        estado_pago="pagado",
        estado_envio="entregado",
    )
    db_session.add(compra)
    db_session.commit()
    db_session.refresh(compra)
    return compra


def _body_compra(compra, **extra):
    return {
        "fase_id": str(compra.fase_id),
        "proveedor_id": str(compra.proveedor_id),
        "descripcion": "Compra",
        "precio_neto_ars": 1000,
        **COTIZACION,
        "tipo_factura": "factura_a",
        "fecha": "2026-01-15",
        "estado_pago": "pendiente",
        "estado_envio": "pedido",
        "detalle": [],
        **extra,
    }


def _body_gasto(proyecto_id, **extra):
    return {
        "proyecto_id": str(proyecto_id),
        "monto_ars": 5000,
        **COTIZACION,
        "descripcion": "Flete",
        "fecha": "2026-01-15",
        "tipo_factura": "factura_a",
        **extra,
    }


# ---------------------------------------------------------------------------
# Router /medios-pago
# ---------------------------------------------------------------------------


def test_lista_de_fabrica_en_orden_y_activos(client, headers_lectura):
    respuesta = client.get("/medios-pago/", headers=headers_lectura)

    assert respuesta.status_code == 200
    assert [m["codigo"] for m in respuesta.json()] == ["efectivo", "transferencia", "cheque", "tarjeta"]
    assert all(m["activo"] for m in respuesta.json())


def test_crear_genera_codigo_y_va_al_final(client, headers_admin):
    respuesta = client.post("/medios-pago/crear", json={"nombre": "Mercado Pago"}, headers=headers_admin)

    assert respuesta.status_code == 201
    assert respuesta.json()["codigo"] == "mercado_pago"
    assert respuesta.json()["activo"] is True
    codigos = [m["codigo"] for m in client.get("/medios-pago/", headers=headers_admin).json()]
    assert codigos[-1] == "mercado_pago"


def test_crear_con_nombre_repetido_o_parecido_da_400(client, headers_admin):
    assert (
        client.post("/medios-pago/crear", json={"nombre": "Cheque"}, headers=headers_admin).status_code == 400
    )
    # Otro nombre pero mismo código ("cheque").
    assert (
        client.post("/medios-pago/crear", json={"nombre": "CHEQUE!"}, headers=headers_admin).status_code
        == 400
    )
    assert (
        client.post("/medios-pago/crear", json={"nombre": "¡¡!!"}, headers=headers_admin).status_code == 400
    )


def test_lectura_no_puede_crear_editar_ni_borrar(client, db_session, headers_lectura):
    medio = _medio(db_session, "cheque")

    assert client.post("/medios-pago/crear", json={"nombre": "X"}, headers=headers_lectura).status_code == 403
    assert (
        client.put(f"/medios-pago/{medio.id}", json={"nombre": "X"}, headers=headers_lectura).status_code
        == 403
    )
    assert client.delete(f"/medios-pago/{medio.id}", headers=headers_lectura).status_code == 403


def test_editar_cambia_el_nombre_y_no_el_codigo(client, db_session, headers_admin):
    medio = _medio(db_session, "tarjeta")

    respuesta = client.put(
        f"/medios-pago/{medio.id}", json={"nombre": "Tarjeta de crédito"}, headers=headers_admin
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["nombre"] == "Tarjeta de crédito"
    assert respuesta.json()["codigo"] == "tarjeta"


def test_editar_a_un_nombre_existente_da_400(client, db_session, headers_admin):
    medio = _medio(db_session, "tarjeta")

    respuesta = client.put(f"/medios-pago/{medio.id}", json={"nombre": "Cheque"}, headers=headers_admin)

    assert respuesta.status_code == 400


def test_desactivar_y_reactivar(client, db_session, headers_admin):
    medio = _medio(db_session, "tarjeta")

    r = client.put(f"/medios-pago/{medio.id}", json={"activo": False}, headers=headers_admin)
    assert r.status_code == 200
    assert r.json()["activo"] is False
    assert r.json()["nombre"] == "Tarjeta"  # no tocó el nombre
    # Sigue en la lista (Ajustes y movimientos viejos lo necesitan).
    assert "tarjeta" in [m["codigo"] for m in client.get("/medios-pago/", headers=headers_admin).json()]

    r = client.put(f"/medios-pago/{medio.id}", json={"activo": True}, headers=headers_admin)
    assert r.json()["activo"] is True


def test_borrar_uno_sin_movimientos_funciona(client, headers_admin):
    creado = client.post("/medios-pago/crear", json={"nombre": "Cripto"}, headers=headers_admin).json()

    respuesta = client.delete(f"/medios-pago/{creado['id']}", headers=headers_admin)

    assert respuesta.status_code == 200
    assert client.get(f"/medios-pago/{creado['id']}", headers=headers_admin).status_code == 404


def test_borrar_uno_con_movimientos_da_400_y_sigue_existiendo(
    client, db_session, headers_admin, usuario_admin
):
    _crear_compra(db_session, usuario_admin, medio_pago="efectivo")
    medio = _medio(db_session, "efectivo")

    respuesta = client.delete(f"/medios-pago/{medio.id}", headers=headers_admin)

    assert respuesta.status_code == 400
    assert "desactivalo" in respuesta.json()["detail"]
    assert client.get(f"/medios-pago/{medio.id}", headers=headers_admin).status_code == 200


# ---------------------------------------------------------------------------
# Compras y gastos validan el medio
# ---------------------------------------------------------------------------


def test_compra_con_medio_inexistente_da_400(client, db_session, headers_admin, usuario_admin):
    compra = _crear_compra(db_session, usuario_admin)

    respuesta = client.post(
        "/compras/crear", json=_body_compra(compra, medio_pago="bitcoin"), headers=headers_admin
    )

    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == MEDIO_INVALIDO


def test_compra_sin_medio_es_valida(client, db_session, headers_admin, usuario_admin):
    compra = _crear_compra(db_session, usuario_admin)

    sin_campo = client.post("/compras/crear", json=_body_compra(compra), headers=headers_admin)
    vacio = client.post("/compras/crear", json=_body_compra(compra, medio_pago=None), headers=headers_admin)

    assert sin_campo.status_code == 201
    assert vacio.status_code == 201


def test_compra_con_medio_desactivado_da_400_pero_con_uno_activo_funciona(
    client, db_session, headers_admin, usuario_admin
):
    compra = _crear_compra(db_session, usuario_admin)
    client.put(
        f"/medios-pago/{_medio(db_session, 'cheque').id}", json={"activo": False}, headers=headers_admin
    )

    desactivado = client.post(
        "/compras/crear", json=_body_compra(compra, medio_pago="cheque"), headers=headers_admin
    )
    activo = client.post(
        "/compras/crear", json=_body_compra(compra, medio_pago="transferencia"), headers=headers_admin
    )

    assert desactivado.status_code == 400
    assert desactivado.json()["detail"] == MEDIO_INVALIDO
    assert activo.status_code == 201


def test_editar_compra_con_medio_desactivado_lo_conserva_pero_no_deja_elegirlo_de_nuevo(
    client, db_session, headers_admin, usuario_admin
):
    compra = _crear_compra(db_session, usuario_admin, medio_pago="cheque")
    client.put(
        f"/medios-pago/{_medio(db_session, 'cheque').id}", json={"activo": False}, headers=headers_admin
    )

    # Reenviar el mismo medio (el front manda el form entero) no se rechaza.
    conserva = client.put(
        f"/compras/{compra.id}",
        json={"medio_pago": "cheque", "descripcion": "Editada"},
        headers=headers_admin,
    )
    # Pasar a otro desactivado desde uno distinto, sí.
    otro = client.put(f"/compras/{compra.id}", json={"medio_pago": "bitcoin"}, headers=headers_admin)

    assert conserva.status_code == 200
    assert conserva.json()["medio_pago"] == "cheque"
    assert otro.status_code == 400


def test_gasto_valida_el_medio_al_crear_y_al_editar(client, db_session, headers_admin):
    proyecto, _, _ = _crear_fase_y_proveedor(db_session)
    client.put(
        f"/medios-pago/{_medio(db_session, 'tarjeta').id}", json={"activo": False}, headers=headers_admin
    )

    inexistente = client.post(
        "/gastos/crear", json=_body_gasto(proyecto.id, medio_pago="bitcoin"), headers=headers_admin
    )
    desactivado = client.post(
        "/gastos/crear", json=_body_gasto(proyecto.id, medio_pago="tarjeta"), headers=headers_admin
    )
    ok = client.post(
        "/gastos/crear", json=_body_gasto(proyecto.id, medio_pago="efectivo"), headers=headers_admin
    )

    assert inexistente.status_code == 400
    assert desactivado.status_code == 400
    assert ok.status_code == 201

    editar_mal = client.put(
        f"/gastos/{ok.json()['id']}", json={"medio_pago": "tarjeta"}, headers=headers_admin
    )
    editar_bien = client.put(
        f"/gastos/{ok.json()['id']}", json={"medio_pago": "transferencia"}, headers=headers_admin
    )
    assert editar_mal.status_code == 400
    assert editar_bien.status_code == 200
