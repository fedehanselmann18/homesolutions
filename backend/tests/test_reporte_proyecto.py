"""
Reporte del proyecto en las dos monedas (ver app/reports/calculations.py).

El escenario es el del problema de negocio, con números redondos: precio
acordado 100.000 USD, se cobraron 65.000 USD con el dólar a 1000, y después
se pagó todo en pesos con el dólar ya a 1250. Lo importante que verifican:
- cada moneda suma SU columna congelada (nada se reconvierte al leer),
- los % contra el precio acordado salen siempre de la cuenta en USD (6.3),
- el precio acordado en pesos usa la última cotización (decisión #8).
"""

import uuid
from datetime import date
from decimal import Decimal

import pytest

from app.db import models
from app.domain.exchange_rate import a_ars, a_usd
from app.reports.calculations import calcular_analisis_proyecto, calcular_reporte_proyecto


def _escenario():
    proyecto = models.Project(id=uuid.uuid4(), nombre="Obra", precio_acordado_usd=Decimal("100000"))
    fase = models.Phase(id=uuid.uuid4(), nombre="Instalación", estado="en_curso")
    proveedor = models.Supplier(id=uuid.uuid4(), nombre="Frío SA")

    cobro = models.ClientPayment(
        monto_usd=Decimal("65000"), monto_ars=a_ars(65000, 1000), cotizacion_dolar=1000, tipo_cambio="blue"
    )
    cobro.notas = []

    gasto = models.Expense(
        fase_id=fase.id,
        monto_ars=Decimal("10000000"),
        monto_usd=a_usd(10000000, 1250),
        cotizacion_dolar=1250,
        tipo_cambio="blue",
    )
    gasto.categorias = []

    compra = models.Purchase(
        fase_id=fase.id,
        estado_pago="pendiente",
        precio_neto_ars=Decimal("50000000"),
        precio_neto_usd=a_usd(50000000, 1250),
        cotizacion_dolar=1250,
        tipo_cambio="blue",
    )
    compra.proveedor = proveedor
    compra.impuestos_aplicados = [
        models.PurchaseTax(monto=Decimal("10500000"), impuesto=models.Tax(nombre="IVA"))
    ]
    compra.notas = []

    return proyecto, [fase], [gasto], [cobro], [compra]


def test_analisis_en_usd_suma_las_cifras_congeladas_en_dolares():
    analisis = calcular_analisis_proyecto(*_escenario(), moneda="usd")
    t = analisis["totales"]

    assert t["cobrado"] == 65000
    assert t["gastos"] == 8000  # 10.000.000 / 1250
    assert t["compras"] == pytest.approx(48400)  # 40.000 neto + 8.400 IVA (a 1250, el de su compra)
    assert t["egresos"] == pytest.approx(56400)
    assert t["disponible"] == pytest.approx(8600)
    assert t["precioAcordado"] == 100000
    assert t["pctGastado"] == pytest.approx(56.4)
    assert t["pctCobrado"] == pytest.approx(65)


def test_analisis_en_pesos_son_nominales_historicos():
    """En pesos el proyecto da negativo aunque en USD gane plata: se cobró con
    el dólar a 1000 y se pagó a 1250. Es lo que salió de la caja, no un error."""
    analisis = calcular_analisis_proyecto(*_escenario(), moneda="ars", cotizacion_actual=1500)
    t = analisis["totales"]

    assert t["cobrado"] == 65000000
    assert t["egresos"] == 70500000
    assert t["disponible"] == -5500000
    assert t["precioAcordado"] == 150000000  # 100.000 USD x la cotización de hoy


def test_los_porcentajes_salen_siempre_de_la_cuenta_en_usd():
    usd = calcular_analisis_proyecto(*_escenario(), moneda="usd")
    ars = calcular_analisis_proyecto(*_escenario(), moneda="ars", cotizacion_actual=1500)

    # 70.5M / 150M daría 47%: mezclaría pesos de marzo con un precio de hoy.
    assert ars["totales"]["pctGastado"] == usd["totales"]["pctGastado"] == pytest.approx(56.4)
    assert ars["fases"][0]["pct_presupuesto"] == usd["fases"][0]["pct_presupuesto"]


def test_sin_cotizacion_cargada_el_precio_en_pesos_queda_sin_dato():
    ars = calcular_analisis_proyecto(*_escenario(), moneda="ars", cotizacion_actual=None)

    assert ars["totales"]["precioAcordado"] is None
    assert ars["totales"]["pctGastado"] == pytest.approx(56.4)  # el % no depende de eso


def test_moneda_desconocida_explota():
    with pytest.raises(ValueError):
        calcular_analisis_proyecto(*_escenario(), moneda="eur")


def test_reporte_trae_las_dos_monedas_y_la_deuda_en_pesos_primero():
    reporte = calcular_reporte_proyecto(*_escenario(), cotizacion_actual=1500)

    assert reporte["usd"]["deuda_total"] == pytest.approx(48400)
    assert reporte["ars"]["deuda_total"] == 60500000
    frase_deuda = next(f for f in reporte["resumen_ejecutivo"] if "pendientes de pago" in f)
    assert frase_deuda.startswith("Hay ARS 60.500.000 (US$ 48.400)")


# ---------------------------------------------------------------------------
# Endpoint del PDF de punta a punta, contra la base.
# ---------------------------------------------------------------------------


def _cargar_proyecto(db_session, usuario):
    proyecto = models.Project(
        nombre="Obra PDF",
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=100000,
    )
    fase = models.Phase(nombre="Fase 1", estado="en_curso", proyecto=proyecto)
    proveedor = models.Supplier(nombre="Frío SA")
    congelado = {"cotizacion_dolar": 1250, "tipo_cambio": "blue"}
    compra = models.Purchase(
        fase=fase,
        proveedor=proveedor,
        usuario_id=usuario.id,
        descripcion="Equipos",
        precio_neto_ars=50000000,
        precio_neto_usd=40000,
        **congelado,
        tipo_factura="factura_a",
        fecha=date(2026, 3, 1),
        medio_pago="efectivo",
        estado_pago="pendiente",
        estado_envio="pedido",
    )
    gasto = models.Expense(
        proyecto=proyecto,
        fase=fase,
        usuario_id=usuario.id,
        monto_ars=10000000,
        monto_usd=8000,
        **congelado,
        descripcion="Flete",
        fecha=date(2026, 3, 1),
        tipo_factura="factura_b",
    )
    cobro = models.ClientPayment(
        proyecto=proyecto,
        usuario_id=usuario.id,
        monto_usd=65000,
        monto_ars=65000000,
        cotizacion_dolar=1000,
        tipo_cambio="blue",
        descripcion="Anticipo",
        fecha=date(2026, 1, 15),
        tipo_factura="factura_a",
    )
    db_session.add_all([proyecto, fase, proveedor, compra, gasto, cobro])
    db_session.commit()
    return proyecto


@pytest.mark.parametrize("con_cotizacion", [True, False])
def test_pdf_del_proyecto_se_genera_con_y_sin_cotizacion(
    client, db_session, headers_admin, usuario_admin, con_cotizacion
):
    proyecto = _cargar_proyecto(db_session, usuario_admin)
    if con_cotizacion:
        db_session.add(models.ExchangeRate(fecha=date(2026, 3, 1), tipo="blue", valor=1500))
        db_session.commit()

    respuesta = client.get(f"/proyectos/{proyecto.id}/reporte-pdf", headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.headers["content-type"] == "application/pdf"
    assert respuesta.content.startswith(b"%PDF")
