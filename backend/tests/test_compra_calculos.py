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

from app.db import models


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


def _impuesto_aplicado(monto, nombre="IVA"):
    impuesto = models.Impuesto(id=uuid.uuid4(), nombre=nombre)
    return models.CompraImpuesto(id=uuid.uuid4(), monto=monto, impuesto=impuesto)


def test_precio_total_sin_impuestos_es_igual_al_neto():
    compra = models.Compra(precio_neto=Decimal("50000"))
    compra.detalle = []
    compra.impuestos_aplicados = []

    assert compra.precio_total == 50000.0


def test_precio_total_suma_todos_los_impuestos_aplicados():
    compra = models.Compra(precio_neto=Decimal("100000"))
    compra.detalle = []
    compra.impuestos_aplicados = [
        _impuesto_aplicado(Decimal("21000"), "IVA"),
        _impuesto_aplicado(Decimal("5000"), "Percepción"),
    ]

    assert compra.precio_total == 126000.0


def test_categorias_se_derivan_del_detalle_sin_duplicados():
    aires = _categoria("Aires", "equipo")
    cafeteras = _categoria("Cafeteras", "equipo")

    producto_1 = _producto(categorias=[aires])
    producto_2 = _producto(categorias=[aires, cafeteras])  # "aires" se repite a propósito

    compra = models.Compra(precio_neto=Decimal("1"))
    compra.impuestos_aplicados = []
    compra.detalle = [_linea(producto_1), _linea(producto_2)]

    nombres = {c.nombre for c in compra.categorias}
    assert nombres == {"Aires", "Cafeteras"}
    assert len(compra.categorias) == 2  # sin duplicados aunque "Aires" salga en las dos líneas


def test_categorias_vacio_si_no_hay_detalle():
    compra = models.Compra(precio_neto=Decimal("1"))
    compra.impuestos_aplicados = []
    compra.detalle = []

    assert compra.categorias == []


def test_tipos_compra_se_derivan_del_tipo_de_cada_producto():
    equipo = _producto(tipo="equipo")
    materiales = _producto(tipo="materiales")

    compra = models.Compra(precio_neto=Decimal("1"))
    compra.impuestos_aplicados = []
    compra.detalle = [_linea(equipo), _linea(materiales)]

    assert set(compra.tipos_compra) == {"equipo", "materiales"}


def test_tipos_compra_no_duplica_si_dos_lineas_son_del_mismo_tipo():
    producto_1 = _producto(tipo="equipo")
    producto_2 = _producto(tipo="equipo")

    compra = models.Compra(precio_neto=Decimal("1"))
    compra.impuestos_aplicados = []
    compra.detalle = [_linea(producto_1), _linea(producto_2)]

    assert compra.tipos_compra == ["equipo"]
