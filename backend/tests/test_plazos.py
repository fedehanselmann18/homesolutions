"""
Condiciones y plazos de pago (ver app/payment_terms.py): cómo se arman los plazos,
cómo se reparte lo que falta cuando cambia el total, y que el estado de la
compra o el gasto sea derivado (pagado sólo con todos los plazos pagados).
"""

from datetime import date
from decimal import Decimal

import pytest

from app.api import purchases as ruta_compras
from app.db import models
from app.domain import payment_terms

COTIZACION = {"cotizacion_dolar": 1000, "tipo_cambio": "blue"}


def _condicion(db_session, nombre):
    return db_session.query(models.PaymentCondition).filter_by(nombre=nombre).one()


def _escenario(db_session):
    proyecto = models.Project(
        nombre="Obra",
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=100000,
    )
    fase = models.Phase(nombre="Fase", estado="en_curso", proyecto=proyecto)
    proveedor = models.Supplier(nombre="Frío Sur", cuit="20-12345678-9")
    producto = models.Product(proveedor=proveedor, marca="LG", modelo="VRF", tipo="equipo", precio=1000000)
    db_session.add_all([proyecto, fase, proveedor, producto])
    db_session.commit()
    return proyecto, fase, proveedor, producto


def _crear_compra(client, db_session, headers, condicion=None, estado="pendiente", neto=1000000):
    proyecto, fase, proveedor, producto = _escenario(db_session)
    cuerpo = {
        "fase_id": str(fase.id),
        "proveedor_id": str(proveedor.id),
        "descripcion": "Equipos",
        "precio_neto_ars": neto,
        **COTIZACION,
        "tipo_factura": "factura_a",
        "fecha": "2026-03-01",
        "estado_pago": estado,
        "estado_envio": "pedido",
        "detalle": [{"producto_id": str(producto.id), "cantidad": 1, "precio_unitario": neto}],
    }
    if condicion:
        cuerpo["condicion_pago_id"] = str(_condicion(db_session, condicion).id)
    respuesta = client.post("/compras/crear", json=cuerpo, headers=headers)
    assert respuesta.status_code == 201, respuesta.json()
    return respuesta.json()


def _marcar(client, headers, plazo, pagado=True, fecha=None):
    cuerpo = {"pagado": pagado}
    if fecha:
        cuerpo["fecha_pago"] = fecha
    return client.put(f"/plazos-pago/{plazo['id']}", json=cuerpo, headers=headers)


def _compra(client, headers, compra_id):
    return client.get(f"/compras/{compra_id}", headers=headers).json()


# ---------------------------------------------------------------------------
# Reparto en partes iguales
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "total, partes, esperado",
    [
        (1000000, 2, ["500000.00", "500000.00"]),
        (100, 3, ["33.33", "33.33", "33.34"]),
        (Decimal("0.05"), 2, ["0.02", "0.03"]),
        (0, 2, ["0.00", "0.00"]),
    ],
)
def test_dividir_en_partes_iguales_el_ultimo_absorbe(total, partes, esperado):
    assert [str(m) for m in payment_terms.dividir(total, partes)] == esperado


# ---------------------------------------------------------------------------
# Compras
# ---------------------------------------------------------------------------


def test_compra_sin_condicion_es_contado_un_solo_plazo(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin)

    assert compra["condicion_pago"]["nombre"] == "Contado"
    assert len(compra["plazos"]) == 1
    plazo = compra["plazos"][0]
    assert plazo["dias"] == 0
    assert plazo["fecha_vencimiento"] == "2026-03-01"
    assert plazo["monto"] == 1000000.0
    assert compra["estado_pago"] == "pendiente"


def test_compra_a_30_60_arma_dos_plazos_iguales(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días")

    assert [(p["dias"], p["fecha_vencimiento"], p["monto"]) for p in compra["plazos"]] == [
        (30, "2026-03-31", 500000.0),
        (60, "2026-04-30", 500000.0),
    ]


def test_los_plazos_van_sobre_el_total_con_impuestos(client, db_session, headers_admin):
    proyecto, fase, proveedor, producto = _escenario(db_session)
    iva = models.Tax(nombre="IVA 21", alicuota=21, grupo="IVA")
    db_session.add(iva)
    db_session.commit()

    respuesta = client.post(
        "/compras/crear",
        json={
            "fase_id": str(fase.id),
            "proveedor_id": str(proveedor.id),
            "descripcion": "Equipos",
            "precio_neto_ars": 100000,
            **COTIZACION,
            "tipo_factura": "factura_a",
            "fecha": "2026-03-01",
            "estado_pago": "pendiente",
            "estado_envio": "pedido",
            "condicion_pago_id": str(_condicion(db_session, "30/60/90 días").id),
            "detalle": [{"producto_id": str(producto.id), "cantidad": 1, "precio_unitario": 100000}],
            "impuestos": [{"impuesto_id": str(iva.id), "monto": 21000}],
        },
        headers=headers_admin,
    )

    assert [p["monto"] for p in respuesta.json()["plazos"]] == [40333.33, 40333.33, 40333.34]


def test_cargada_ya_pagada_cada_plazo_queda_pagado_en_su_vencimiento(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días", estado="pagado")

    assert compra["estado_pago"] == "pagado"
    assert [(p["pagado"], p["fecha_pago"]) for p in compra["plazos"]] == [
        (True, "2026-03-31"),
        (True, "2026-04-30"),
    ]


def test_estado_derivado_marcando_plazo_por_plazo(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días")
    primero, segundo = compra["plazos"]

    respuesta = _marcar(client, headers_admin, primero, fecha="2026-03-30")
    assert respuesta.status_code == 200
    assert respuesta.json()["fecha_pago"] == "2026-03-30"
    assert _compra(client, headers_admin, compra["id"])["estado_pago"] == "pendiente"

    _marcar(client, headers_admin, segundo)
    assert _compra(client, headers_admin, compra["id"])["estado_pago"] == "pagado"

    _marcar(client, headers_admin, segundo, pagado=False)
    actualizada = _compra(client, headers_admin, compra["id"])
    assert actualizada["estado_pago"] == "pendiente"
    assert actualizada["plazos"][1]["fecha_pago"] is None


def test_lectura_no_puede_marcar_plazos(client, db_session, headers_admin, headers_lectura):
    compra = _crear_compra(client, db_session, headers_admin)

    assert _marcar(client, headers_lectura, compra["plazos"][0]).status_code == 403


def test_nota_de_credito_reparte_lo_que_falta_entre_los_pendientes(
    client, db_session, headers_admin, monkeypatch
):
    monkeypatch.setattr(ruta_compras, "subir_comprobante", lambda *a, **k: "notas_compra/x/nota.pdf")
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60/90 días", neto=900000)
    _marcar(client, headers_admin, compra["plazos"][0])

    respuesta = client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "factura_a",
            "descripcion": "Descuento",
            "fecha": "2026-04-05",
            "origen": "acuerdo_comercial",
            "monto_ars": 100000,
            **COTIZACION,
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )
    assert respuesta.status_code == 201

    # 900.000 − 100.000 = 800.000; ya pagados 300.000 -> faltan 500.000 en dos.
    actualizada = _compra(client, headers_admin, compra["id"])
    assert [p["monto"] for p in actualizada["plazos"]] == [300000.0, 250000.0, 250000.0]

    # Borrar la nota vuelve a repartir: faltan 600.000.
    nota_id = actualizada["notas"][0]["id"]
    client.delete(f"/compras/{compra['id']}/notas/{nota_id}", headers=headers_admin)
    assert [p["monto"] for p in _compra(client, headers_admin, compra["id"])["plazos"]] == [
        300000.0,
        300000.0,
        300000.0,
    ]


def test_nota_de_debito_sobre_una_compra_pagada_agrega_un_plazo_de_ajuste(
    client, db_session, headers_admin, monkeypatch
):
    monkeypatch.setattr(ruta_compras, "subir_comprobante", lambda *a, **k: "notas_compra/x/nota.pdf")
    compra = _crear_compra(client, db_session, headers_admin, estado="pagado")

    client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_debito",
            "tipo_factura": "factura_a",
            "descripcion": "Flete que faltaba",
            "fecha": "2026-03-10",
            "origen": "acuerdo_comercial",
            "monto_ars": 50000,
            **COTIZACION,
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    actualizada = _compra(client, headers_admin, compra["id"])
    assert actualizada["estado_pago"] == "pendiente"
    ajuste = actualizada["plazos"][-1]
    assert (ajuste["monto"], ajuste["fecha_vencimiento"], ajuste["pagado"]) == (50000.0, "2026-03-10", False)


def test_nota_de_credito_sobre_una_compra_pagada_no_toca_los_plazos(
    client, db_session, headers_admin, monkeypatch
):
    monkeypatch.setattr(ruta_compras, "subir_comprobante", lambda *a, **k: "notas_compra/x/nota.pdf")
    compra = _crear_compra(client, db_session, headers_admin, estado="pagado")

    client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "factura_a",
            "descripcion": "Devolución",
            "fecha": "2026-03-10",
            "origen": "acuerdo_comercial",
            "monto_ars": 50000,
            **COTIZACION,
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    actualizada = _compra(client, headers_admin, compra["id"])
    assert actualizada["estado_pago"] == "pagado"
    assert [p["monto"] for p in actualizada["plazos"]] == [1000000.0]


def test_editar_el_monto_reparte_entre_los_pendientes(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días")
    _marcar(client, headers_admin, compra["plazos"][0])

    respuesta = client.put(
        f"/compras/{compra['id']}", json={"precio_neto_ars": 1200000}, headers=headers_admin
    )

    assert respuesta.status_code == 200
    assert [p["monto"] for p in respuesta.json()["plazos"]] == [500000.0, 700000.0]


def test_cambiar_la_condicion_sin_pagos_rearma_los_plazos(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días")
    nueva = _condicion(db_session, "30/60/90/120 días")

    respuesta = client.put(
        f"/compras/{compra['id']}", json={"condicion_pago_id": str(nueva.id)}, headers=headers_admin
    )

    assert respuesta.status_code == 200
    assert [p["monto"] for p in respuesta.json()["plazos"]] == [250000.0] * 4


def test_cambiar_la_condicion_con_un_plazo_pagado_da_400(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días")
    _marcar(client, headers_admin, compra["plazos"][0])

    respuesta = client.put(
        f"/compras/{compra['id']}",
        json={"condicion_pago_id": str(_condicion(db_session, "30 días").id)},
        headers=headers_admin,
    )

    assert respuesta.status_code == 400
    assert "ya hay plazos pagados" in respuesta.json()["detail"]


def test_mandar_la_misma_condicion_con_pagos_no_falla(client, db_session, headers_admin):
    """El modal de edición manda la compra entera, condición incluida."""
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días")
    _marcar(client, headers_admin, compra["plazos"][0])

    respuesta = client.put(
        f"/compras/{compra['id']}",
        json={
            "condicion_pago_id": compra["condicion_pago_id"],
            "estado_pago": "pendiente",
            "descripcion": "X",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    # El estado "pendiente" que manda el modal no borra el pago que ya había.
    assert [p["pagado"] for p in respuesta.json()["plazos"]] == [True, False]


def test_cambiar_la_fecha_mueve_solo_los_vencimientos_pendientes(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días")
    _marcar(client, headers_admin, compra["plazos"][0])

    respuesta = client.put(f"/compras/{compra['id']}", json={"fecha": "2026-03-11"}, headers=headers_admin)

    assert [p["fecha_vencimiento"] for p in respuesta.json()["plazos"]] == ["2026-03-31", "2026-05-10"]


def test_el_badge_pagado_marca_todos_y_pendiente_los_desmarca(client, db_session, headers_admin):
    compra = _crear_compra(client, db_session, headers_admin, condicion="30/60 días")

    pagada = client.put(
        f"/compras/{compra['id']}", json={"estado_pago": "pagado"}, headers=headers_admin
    ).json()
    assert pagada["estado_pago"] == "pagado"
    assert all(p["pagado"] and p["fecha_pago"] for p in pagada["plazos"])

    impaga = client.put(
        f"/compras/{compra['id']}", json={"estado_pago": "pendiente"}, headers=headers_admin
    ).json()
    assert impaga["estado_pago"] == "pendiente"
    assert not any(p["pagado"] for p in impaga["plazos"])


# ---------------------------------------------------------------------------
# Gastos
# ---------------------------------------------------------------------------


def _cuerpo_gasto(proyecto, **extra):
    return {
        "proyecto_id": str(proyecto.id),
        "monto_ars": 90000,
        **COTIZACION,
        "descripcion": "Mano de obra",
        "fecha": "2026-03-01",
        "tipo_factura": "factura_c",
        **extra,
    }


def test_gasto_por_default_es_contado_y_pagado(client, db_session, headers_admin):
    proyecto, *_ = _escenario(db_session)

    gasto = client.post("/gastos/crear", json=_cuerpo_gasto(proyecto), headers=headers_admin).json()

    assert gasto["condicion_pago"]["nombre"] == "Contado"
    assert gasto["estado_pago"] == "pagado"
    assert [(p["monto"], p["pagado"], p["fecha_pago"]) for p in gasto["plazos"]] == [
        (90000.0, True, "2026-03-01")
    ]


def test_gasto_a_30_60_90_queda_a_pagar(client, db_session, headers_admin):
    proyecto, *_ = _escenario(db_session)

    gasto = client.post(
        "/gastos/crear",
        json=_cuerpo_gasto(
            proyecto,
            condicion_pago_id=str(_condicion(db_session, "30/60/90 días").id),
            estado_pago="pendiente",
            medio_pago="cheque",
        ),
        headers=headers_admin,
    ).json()

    assert gasto["estado_pago"] == "pendiente"
    assert gasto["medio_pago"] == "cheque"
    assert [p["monto"] for p in gasto["plazos"]] == [30000.0, 30000.0, 30000.0]

    _marcar(client, headers_admin, gasto["plazos"][0])
    editado = client.put(f"/gastos/{gasto['id']}", json={"monto_ars": 120000}, headers=headers_admin).json()
    assert [p["monto"] for p in editado["plazos"]] == [30000.0, 45000.0, 45000.0]


# ---------------------------------------------------------------------------
# Ajustes: condiciones de pago
# ---------------------------------------------------------------------------


def test_lista_de_fabrica_en_orden(client, headers_lectura):
    respuesta = client.get("/condiciones-pago/", headers=headers_lectura)

    assert [c["nombre"] for c in respuesta.json()] == [
        "Contado",
        "30 días",
        "60 días",
        "90 días",
        "30/60 días",
        "30/60/90 días",
        "30/60/90/120 días",
    ]
    assert [c["nombre"] for c in respuesta.json() if c["protegido"]] == ["Contado"]


def test_crear_condicion_ordena_los_dias(client, headers_admin):
    respuesta = client.post(
        "/condiciones-pago/crear", json={"nombre": "45/90 días", "dias": [90, 45, 45]}, headers=headers_admin
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["dias"] == [45, 90]


@pytest.mark.parametrize("dias", [[0], [400], list(range(1, 14))])
def test_dias_invalidos_dan_422(client, headers_admin, dias):
    respuesta = client.post(
        "/condiciones-pago/crear", json={"nombre": "Rara", "dias": dias}, headers=headers_admin
    )

    assert respuesta.status_code == 422


def test_contado_no_se_borra_ni_lleva_dias(client, db_session, headers_admin):
    contado = _condicion(db_session, "Contado")

    assert client.delete(f"/condiciones-pago/{contado.id}", headers=headers_admin).status_code == 400
    assert (
        client.put(f"/condiciones-pago/{contado.id}", json={"dias": [30]}, headers=headers_admin).status_code
        == 400
    )
    renombrar = client.put(
        f"/condiciones-pago/{contado.id}", json={"nombre": "Al contado"}, headers=headers_admin
    )
    assert renombrar.status_code == 200


def test_condicion_en_uso_no_se_borra(client, db_session, headers_admin):
    _crear_compra(client, db_session, headers_admin, condicion="30 días")
    usada = _condicion(db_session, "30 días")

    respuesta = client.delete(f"/condiciones-pago/{usada.id}", headers=headers_admin)

    assert respuesta.status_code == 400
    assert "asociados" in respuesta.json()["detail"]


def test_condicion_sin_uso_se_borra(client, db_session, headers_admin):
    sin_uso = _condicion(db_session, "60 días")

    assert client.delete(f"/condiciones-pago/{sin_uso.id}", headers=headers_admin).status_code == 200


def test_lectura_no_puede_crear_condiciones(client, headers_lectura):
    respuesta = client.post(
        "/condiciones-pago/crear", json={"nombre": "X", "dias": [10]}, headers=headers_lectura
    )

    assert respuesta.status_code == 403


def test_gasto_contado_pagado_por_error_se_pasa_a_30_dias_a_pagar_en_una_edicion(
    client, db_session, headers_admin
):
    proyecto, *_ = _escenario(db_session)
    gasto = client.post("/gastos/crear", json=_cuerpo_gasto(proyecto), headers=headers_admin).json()

    respuesta = client.put(
        f"/gastos/{gasto['id']}",
        json={
            "condicion_pago_id": str(_condicion(db_session, "30/60 días").id),
            "estado_pago": "pendiente",
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["estado_pago"] == "pendiente"
    assert [(p["dias"], p["pagado"]) for p in respuesta.json()["plazos"]] == [(30, False), (60, False)]
