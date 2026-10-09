"""
IVA con alícuota (21 / 10,5): el impuesto guarda su porcentaje y su grupo,
una compra o nota no puede llevar dos del mismo grupo (una alícuota de IVA
por factura), y en el Análisis/PDF todos los del grupo suman juntos.

El monto lo calcula el front (y se puede sobrescribir): el backend guarda lo
que llega, igual que antes.
"""

import uuid
from datetime import date
from decimal import Decimal

from app.db import models
from app.reportes.calculos import calcular_analisis_proyecto
from app.routes import compras as ruta_compras
from app.tipo_cambio import a_usd

COTIZACION = {"cotizacion_dolar": 1000, "tipo_cambio": "blue"}


def _iva(db_session, nombre, alicuota, grupo="IVA"):
    impuesto = models.Impuesto(nombre=nombre, alicuota=alicuota, grupo=grupo)
    db_session.add(impuesto)
    db_session.commit()
    db_session.refresh(impuesto)
    return impuesto


def _fase_y_proveedor(db_session):
    proyecto = models.Proyecto(
        nombre="Obra",
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=100000,
    )
    fase = models.Fase(nombre="Fase", estado="en_curso", proyecto=proyecto)
    proveedor = models.Proveedor(nombre="Frío Sur", cuit="20-12345678-9")
    producto = models.Producto(proveedor=proveedor, marca="LG", modelo="VRF", tipo="equipo", precio=100000)
    db_session.add_all([proyecto, fase, proveedor, producto])
    db_session.commit()
    return fase, proveedor, producto


def _cuerpo_compra(fase, proveedor, producto, impuestos):
    return {
        "fase_id": str(fase.id),
        "proveedor_id": str(proveedor.id),
        "descripcion": "Equipos",
        "precio_neto_ars": 100000,
        **COTIZACION,
        "tipo_factura": "factura_a",
        "fecha": "2026-01-15",
        "medio_pago": "efectivo",
        "estado_pago": "pendiente",
        "estado_envio": "pedido",
        "detalle": [{"producto_id": str(producto.id), "cantidad": 1, "precio_unitario": 100000}],
        "impuestos": impuestos,
    }


# ---------------------------------------------------------------------------
# Ajustes: alícuota y grupo
# ---------------------------------------------------------------------------


def test_crear_impuesto_con_alicuota_y_grupo(client, headers_admin):
    respuesta = client.post(
        "/impuestos/crear",
        json={"nombre": "IVA 10,5", "alicuota": 10.5, "grupo": "  IVA "},
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["alicuota"] == 10.5
    assert cuerpo["grupo"] == "IVA"


def test_impuesto_sin_alicuota_sigue_andando(client, headers_admin):
    respuesta = client.post("/impuestos/crear", json={"nombre": "Percepción IIBB"}, headers=headers_admin)

    assert respuesta.status_code == 201
    assert respuesta.json()["alicuota"] is None
    assert respuesta.json()["grupo"] is None


def test_alicuota_fuera_de_rango_da_422(client, headers_admin):
    for alicuota in (0, -5, 150):
        respuesta = client.post(
            "/impuestos/crear", json={"nombre": f"X {alicuota}", "alicuota": alicuota}, headers=headers_admin
        )
        assert respuesta.status_code == 422


def test_editar_puede_sacar_la_alicuota(client, db_session, headers_admin):
    iva = _iva(db_session, "IVA 21", 21)

    respuesta = client.put(
        f"/impuestos/{iva.id}", json={"alicuota": None, "grupo": ""}, headers=headers_admin
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["alicuota"] is None
    assert respuesta.json()["grupo"] is None


# ---------------------------------------------------------------------------
# Una alícuota de IVA por factura
# ---------------------------------------------------------------------------


def test_compra_con_dos_iva_da_400(client, db_session, headers_admin):
    fase, proveedor, producto = _fase_y_proveedor(db_session)
    iva21 = _iva(db_session, "IVA 21", 21)
    iva105 = _iva(db_session, "IVA 10,5", 10.5)

    respuesta = client.post(
        "/compras/crear",
        json=_cuerpo_compra(
            fase,
            proveedor,
            producto,
            [{"impuesto_id": str(iva21.id), "monto": 21000}, {"impuesto_id": str(iva105.id), "monto": 10500}],
        ),
        headers=headers_admin,
    )

    assert respuesta.status_code == 400
    assert "una sola alícuota de IVA" in respuesta.json()["detail"]


def test_compra_con_iva_y_percepcion_se_guarda(client, db_session, headers_admin):
    fase, proveedor, producto = _fase_y_proveedor(db_session)
    iva21 = _iva(db_session, "IVA 21", 21)
    percepcion = _iva(db_session, "Percepción IIBB", None, grupo=None)

    respuesta = client.post(
        "/compras/crear",
        json=_cuerpo_compra(
            fase,
            proveedor,
            producto,
            [
                {"impuesto_id": str(iva21.id), "monto": 21000},
                {"impuesto_id": str(percepcion.id), "monto": 3000},
            ],
        ),
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    # El monto es el que mandó el front (calculado o sobrescrito), no se recalcula.
    assert respuesta.json()["precio_total_ars"] == 124000.0


def test_editar_compra_con_dos_iva_da_400(client, db_session, headers_admin):
    fase, proveedor, producto = _fase_y_proveedor(db_session)
    iva21 = _iva(db_session, "IVA 21", 21)
    iva105 = _iva(db_session, "IVA 10,5", 10.5)
    compra = client.post(
        "/compras/crear",
        json=_cuerpo_compra(fase, proveedor, producto, [{"impuesto_id": str(iva21.id), "monto": 21000}]),
        headers=headers_admin,
    ).json()

    respuesta = client.put(
        f"/compras/{compra['id']}",
        json={
            "impuestos": [
                {"impuesto_id": str(iva21.id), "monto": 21000},
                {"impuesto_id": str(iva105.id), "monto": 10500},
            ]
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 400


def test_nota_de_devolucion_con_dos_iva_da_400_sin_subir_archivo(
    client, db_session, headers_admin, monkeypatch
):
    def _no_subir(*args, **kwargs):
        raise AssertionError("no tendría que subir el comprobante")

    fase, proveedor, producto = _fase_y_proveedor(db_session)
    iva21 = _iva(db_session, "IVA 21", 21)
    iva105 = _iva(db_session, "IVA 10,5", 10.5)
    compra = client.post(
        "/compras/crear", json=_cuerpo_compra(fase, proveedor, producto, []), headers=headers_admin
    ).json()
    monkeypatch.setattr(ruta_compras, "subir_comprobante", _no_subir)

    respuesta = client.post(
        f"/compras/{compra['id']}/notas",
        data={
            "tipo": "nota_credito",
            "tipo_factura": "factura_a",
            "descripcion": "Devolución",
            "fecha": "2026-01-20",
            "origen": "devolucion_producto",
            **COTIZACION,
            "detalles_json": f'[{{"detalle_compra_id": "{compra["detalle"][0]["id"]}", "cantidad": 1}}]',
            "impuestos_json": (
                f'[{{"impuesto_id": "{iva21.id}", "monto": 21000}}, {{"impuesto_id": "{iva105.id}", "monto": 10500}}]'
            ),
        },
        files={"archivo": ("nota.pdf", b"%PDF-1.4 fake", "application/pdf")},
        headers=headers_admin,
    )

    assert respuesta.status_code == 400


# ---------------------------------------------------------------------------
# Análisis / PDF: todos los IVA suman como "IVA"
# ---------------------------------------------------------------------------


def _compra_con_impuesto(impuesto, monto):
    compra = models.Compra(
        fase_id=uuid.uuid4(),
        estado_pago="pagado",
        precio_neto_ars=Decimal("100000"),
        precio_neto_usd=a_usd(100000, 1000),
        cotizacion_dolar=1000,
        tipo_cambio="blue",
    )
    compra.proveedor = models.Proveedor(id=uuid.uuid4(), nombre="Frío Sur")
    compra.impuestos_aplicados = [models.CompraImpuesto(monto=Decimal(monto), impuesto=impuesto)]
    compra.notas = []
    return compra


def test_pdf_agrupa_iva_21_y_10_5_como_iva():
    iva21 = models.Impuesto(nombre="IVA 21", alicuota=21, grupo="IVA")
    iva105 = models.Impuesto(nombre="IVA 10,5", alicuota=10.5, grupo="IVA")
    percepcion = models.Impuesto(nombre="Percepción IIBB")
    proyecto = models.Proyecto(id=uuid.uuid4(), nombre="Obra", precio_acordado_usd=Decimal("100000"))
    compras = [
        _compra_con_impuesto(iva21, "21000"),
        _compra_con_impuesto(iva105, "10500"),
        _compra_con_impuesto(percepcion, "3000"),
    ]

    analisis = calcular_analisis_proyecto(proyecto, [], [], [], compras, moneda="ars")

    assert analisis["impuestos_por_tipo"] == [
        {"nombre": "IVA", "monto": 31500.0},
        {"nombre": "Percepción IIBB", "monto": 3000.0},
    ]
