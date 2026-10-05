"""
Tests unitarios de los cálculos de plata de Compra (ver properties en
app/db/models.py). Si esto se rompe, se rompen los totales que ve Agus en
toda la app (Panel, detalle de proveedor, seguimiento de proyecto...).

A propósito NO tocan la base de datos: se arman los objetos en memoria
(SQLAlchemy permite asignar relaciones directamente sobre un objeto
transient, sin sesión) para que corran en milisegundos y no dependan de que
haya un Postgres corriendo. Los tests que sí necesitan la base están en
test_login.py y test_productos.py.
"""

import uuid
from decimal import Decimal

import pytest

from app.db import models
from app.tipo_cambio import a_ars, a_usd


def _categoria(nombre="Aires", tipo="equipo"):
    return models.Categoria(id=uuid.uuid4(), nombre=nombre, tipo=tipo)


def _producto(tipo="equipo", categorias=None):
    producto = models.Producto(
        id=uuid.uuid4(),
        proveedor_id=uuid.uuid4(),
        marca="Surrey",
        modelo="3000F",
        tipo=tipo,
        precio=Decimal("100000"),
    )
    producto.categorias = categorias or []
    return producto


def _linea(producto, cantidad=1, precio_unitario=Decimal("100000")):
    return models.DetalleCompra(
        id=uuid.uuid4(),
        producto_id=producto.id,
        cantidad=cantidad,
        precio_unitario=precio_unitario,
        producto=producto,
    )


# Pesos por dólar de las compras/cobros de estos tests, salvo que el test
# diga otra cosa. Redondo para que las cuentas se lean de un vistazo.
COTIZACION = Decimal("1000")


def _compra(neto_ars, cotizacion=COTIZACION):
    """Compra con su USD congelado como lo haría la route (ver app/tipo_cambio.py)."""
    return models.Compra(
        precio_neto_ars=neto_ars,
        precio_neto_usd=a_usd(neto_ars, cotizacion),
        cotizacion_dolar=cotizacion,
        tipo_cambio="blue",
    )


def _cobro(monto_usd, cotizacion=COTIZACION):
    return models.Cobro(
        monto_usd=monto_usd,
        monto_ars=a_ars(monto_usd, cotizacion),
        cotizacion_dolar=cotizacion,
        tipo_cambio="blue",
    )


def _impuesto_aplicado(monto, nombre="IVA"):
    impuesto = models.Impuesto(id=uuid.uuid4(), nombre=nombre)
    return models.CompraImpuesto(id=uuid.uuid4(), monto=monto, impuesto=impuesto)


def _nota_compra(
    tipo,
    monto_ars,
    origen=None,
    tipo_factura="factura_a",
    detalles=None,
    impuestos_aplicados=None,
    cotizacion=COTIZACION,
):
    nota = models.NotaCompra(
        id=uuid.uuid4(),
        archivo_path="x.pdf",
        tipo=tipo,
        monto_ars=monto_ars,
        monto_usd=a_usd(monto_ars, cotizacion),
        cotizacion_dolar=cotizacion,
        tipo_cambio="blue",
        origen=origen,
        tipo_factura=tipo_factura,
        descripcion="test",
        fecha=None,
    )
    nota.detalles = detalles or []
    nota.impuestos_aplicados = impuestos_aplicados or []
    return nota


def _nota_cobro(tipo, monto_usd, origen=None, tipo_factura="factura_a", cotizacion=COTIZACION):
    return models.NotaCobro(
        id=uuid.uuid4(),
        archivo_path="x.pdf",
        tipo=tipo,
        monto_usd=monto_usd,
        monto_ars=a_ars(monto_usd, cotizacion),
        cotizacion_dolar=cotizacion,
        tipo_cambio="blue",
        origen=origen,
        tipo_factura=tipo_factura,
        descripcion="test",
        fecha=None,
    )


def _nota_compra_detalle(detalle_compra_id, cantidad, precio_unitario):
    return models.NotaCompraDetalle(
        id=uuid.uuid4(),
        detalle_compra_id=detalle_compra_id,
        cantidad=cantidad,
        precio_unitario=precio_unitario,
    )


# ---------------------------------------------------------------------------
# Doble moneda: el USD de una compra NO es su total en pesos / su cotización,
# porque cada nota trae su propio dólar (PLAN_TIPO_CAMBIO.md §3).
# ---------------------------------------------------------------------------


def test_precio_total_usd_hereda_la_cotizacion_de_la_compra_en_los_impuestos():
    compra = _compra(Decimal("100000"))  # 100 USD a 1000
    compra.impuestos_aplicados = [_impuesto_aplicado(Decimal("21000"))]
    compra.notas = []

    assert compra.precio_total_usd == pytest.approx(121.0)


def test_precio_total_usd_resta_cada_nota_con_su_propia_cotizacion():
    compra = _compra(Decimal("100000"))  # 100 USD a 1000
    compra.impuestos_aplicados = []
    # Misma plata en pesos, pero devuelta un mes después con el dólar a 1250.
    compra.notas = [_nota_compra("nota_credito", Decimal("10000"), cotizacion=Decimal("1250"))]

    assert compra.precio_total_ars == 90000.0
    assert compra.precio_total_usd == pytest.approx(92.0)  # 100 - 8, no 90000 / 1000 = 90


def test_monto_neto_cobro_en_pesos_usa_la_cotizacion_de_cada_nota():
    cobro = _cobro(Decimal("1000"))  # 1000 USD a 1000 = 1.000.000 ARS
    cobro.notas = [_nota_cobro("nota_credito", Decimal("100"), cotizacion=Decimal("1200"))]

    assert cobro.monto_neto_usd == 900.0
    assert cobro.monto_neto_ars == 880000.0  # 1.000.000 - 120.000


def test_precio_total_sin_impuestos_es_igual_al_neto():
    compra = _compra(Decimal("50000"))
    compra.detalle = []
    compra.impuestos_aplicados = []

    assert compra.precio_total_ars == 50000.0


def test_precio_total_suma_todos_los_impuestos_aplicados():
    compra = _compra(Decimal("100000"))
    compra.detalle = []
    compra.impuestos_aplicados = [
        _impuesto_aplicado(Decimal("21000"), "IVA"),
        _impuesto_aplicado(Decimal("5000"), "Percepción"),
    ]

    assert compra.precio_total_ars == 126000.0


def test_categorias_se_derivan_del_detalle_sin_duplicados():
    aires = _categoria("Aires", "equipo")
    cafeteras = _categoria("Cafeteras", "equipo")

    producto_1 = _producto(categorias=[aires])
    producto_2 = _producto(categorias=[aires, cafeteras])  # "aires" se repite a propósito

    compra = _compra(Decimal("1"))
    compra.impuestos_aplicados = []
    compra.detalle = [_linea(producto_1), _linea(producto_2)]

    nombres = {c.nombre for c in compra.categorias}
    assert nombres == {"Aires", "Cafeteras"}
    assert len(compra.categorias) == 2  # sin duplicados aunque "Aires" salga en las dos líneas


def test_categorias_vacio_si_no_hay_detalle():
    compra = _compra(Decimal("1"))
    compra.impuestos_aplicados = []
    compra.detalle = []

    assert compra.categorias == []


def test_tipos_compra_se_derivan_del_tipo_de_cada_producto():
    equipo = _producto(tipo="equipo")
    materiales = _producto(tipo="materiales")

    compra = _compra(Decimal("1"))
    compra.impuestos_aplicados = []
    compra.detalle = [_linea(equipo), _linea(materiales)]

    assert set(compra.tipos_compra) == {"equipo", "materiales"}


def test_tipos_compra_no_duplica_si_dos_lineas_son_del_mismo_tipo():
    producto_1 = _producto(tipo="equipo")
    producto_2 = _producto(tipo="equipo")

    compra = _compra(Decimal("1"))
    compra.impuestos_aplicados = []
    compra.detalle = [_linea(producto_1), _linea(producto_2)]

    assert compra.tipos_compra == ["equipo"]


def test_precio_total_resta_notas_de_credito():
    compra = _compra(Decimal("100000"))
    compra.detalle = []
    compra.impuestos_aplicados = [_impuesto_aplicado(Decimal("21000"), "IVA")]
    compra.notas = [_nota_compra("nota_credito", Decimal("10000"), origen="devolucion_producto")]

    assert compra.precio_total_ars == 111000.0  # 100000 + 21000 - 10000


def test_precio_total_suma_notas_de_debito():
    compra = _compra(Decimal("100000"))
    compra.detalle = []
    compra.impuestos_aplicados = []
    compra.notas = [_nota_compra("nota_debito", Decimal("8000"), origen="acuerdo_comercial")]

    assert compra.precio_total_ars == 108000.0


def test_precio_total_combina_credito_y_debito():
    compra = _compra(Decimal("100000"))
    compra.detalle = []
    compra.impuestos_aplicados = [_impuesto_aplicado(Decimal("21000"), "IVA")]
    compra.notas = [
        _nota_compra("nota_credito", Decimal("10000")),
        _nota_compra("nota_credito", Decimal("5000")),
        _nota_compra("nota_debito", Decimal("3000")),
    ]

    assert compra.precio_total_ars == 109000.0  # 100000 + 21000 - 15000 + 3000


def test_monto_neto_cobro_sin_notas_es_igual_al_monto():
    cobro = _cobro(Decimal("80000"))
    cobro.notas = []

    assert cobro.monto_neto_usd == 80000.0


def test_monto_neto_cobro_resta_notas_de_credito():
    cobro = _cobro(Decimal("80000"))
    cobro.notas = [_nota_cobro("nota_credito", Decimal("15000"), origen="ajuste_precio")]

    assert cobro.monto_neto_usd == 65000.0


def test_monto_neto_cobro_combina_credito_y_debito():
    cobro = _cobro(Decimal("80000"))
    cobro.notas = [
        _nota_cobro("nota_credito", Decimal("15000")),
        _nota_cobro("nota_debito", Decimal("4000")),
    ]

    assert cobro.monto_neto_usd == 69000.0  # 80000 - 15000 + 4000


def test_nota_credito_devolucion_producto_admite_varias_lineas():
    """Una nota de devolución puede traer más de un producto (ver
    NotaCompraDetalle) -- el monto en sí sigue siendo lo que calculó/congeló
    la route al crearla (ver routes/compras.py: crear_nota_compra), acá solo
    se verifica que el modelo sostiene la relación uno-a-muchos sin problema."""
    detalle_id_a = uuid.uuid4()
    detalle_id_b = uuid.uuid4()
    nota = _nota_compra(
        "nota_credito",
        Decimal("9000"),  # 2*3000 (A) + 1*3000 (B)
        origen="devolucion_producto",
        detalles=[
            _nota_compra_detalle(detalle_id_a, cantidad=2, precio_unitario=Decimal("3000")),
            _nota_compra_detalle(detalle_id_b, cantidad=1, precio_unitario=Decimal("3000")),
        ],
    )

    assert len(nota.detalles) == 2
    assert {d.detalle_compra_id for d in nota.detalles} == {detalle_id_a, detalle_id_b}
    assert sum(float(d.cantidad) * float(d.precio_unitario) for d in nota.detalles) == float(nota.monto_ars)


def test_nota_debito_reposicion_producto_suma_al_total_como_cualquier_debito():
    """reposicion_producto (solo nota_debito) usa el mismo selector de
    producto+cantidad que devolucion_producto (ver ModalNota.jsx y
    routes/compras.py: crear_nota_compra), pero sin tope de restante -- caso
    típico: te cambian 3 aires fallados (nota_credito devolucion_producto) y
    te facturan los 3 nuevos con esta nota_debito reposicion_producto. Acá
    solo se verifica que, sea cual sea el origen, una nota_debito sigue
    SUMANDO a precio_total (el signo lo define tipo, no origen)."""
    detalle_id = uuid.uuid4()
    compra = _compra(Decimal("100000"))
    compra.detalle = []
    compra.impuestos_aplicados = []
    compra.notas = [
        _nota_compra(
            "nota_debito",
            Decimal("9000"),
            origen="reposicion_producto",
            detalles=[_nota_compra_detalle(detalle_id, cantidad=3, precio_unitario=Decimal("3000"))],
        )
    ]

    assert compra.precio_total_ars == 109000.0  # 100000 + 9000


def test_precio_total_de_compra_usa_el_monto_frozen_de_la_nota_no_recalcula_detalles():
    """precio_total resta/suma nota.monto directamente -- el monto queda
    frozen en el momento de creación (route), Compra.precio_total no vuelve a
    sumar cantidad*precio_unitario de las líneas devueltas."""
    compra = _compra(Decimal("100000"))
    compra.detalle = []
    compra.impuestos_aplicados = []
    compra.notas = [
        _nota_compra(
            "nota_credito",
            Decimal("6000"),
            origen="devolucion_producto",
            detalles=[_nota_compra_detalle(uuid.uuid4(), cantidad=2, precio_unitario=Decimal("3000"))],
        )
    ]

    assert compra.precio_total_ars == 94000.0  # 100000 - 6000, sin importar el detalle interno


# ---------------------------------------------------------------------------
# validar_integridad_nota_compra (B-14): NotaCompra.proveedor_id se
# denormaliza desde Compra.proveedor_id al crearla -- este chequeo hace
# explícita esa garantía en vez de confiar en que el caller la copie bien.
# ---------------------------------------------------------------------------


def test_validar_integridad_nota_compra_no_hace_nada_si_coinciden():
    proveedor_id = uuid.uuid4()
    compra = models.Compra(id=uuid.uuid4(), proveedor_id=proveedor_id)
    nota = models.NotaCompra(id=uuid.uuid4(), proveedor_id=proveedor_id)

    models.validar_integridad_nota_compra(nota, compra)  # no levanta nada


def test_validar_integridad_nota_compra_rechaza_proveedor_distinto():
    compra = models.Compra(id=uuid.uuid4(), proveedor_id=uuid.uuid4())
    nota = models.NotaCompra(id=uuid.uuid4(), proveedor_id=uuid.uuid4())  # otro proveedor

    with pytest.raises(ValueError, match="proveedor"):
        models.validar_integridad_nota_compra(nota, compra)
