"""
Congelamiento de la cotización en los movimientos de plata (ver
docs/PLAN_TIPO_CAMBIO.md, §3 y §4.4).

Cada compra, gasto, cobro y nota guarda las dos cifras (ARS y USD) y la
cotización con la que se cargó. Una de las dos cifras la tipea el usuario y
la otra la calcula SIEMPRE el backend con estas funciones -- nunca se toma
lo que mande el front, aunque lo mande (el front muestra el equivalente
como preview, pero no es la fuente de verdad):

    gasto / compra / nota de compra:  monto_usd = monto_ars / cotizacion
    cobro / nota de cobro:            monto_ars = monto_usd * cotizacion

Decimal y no float: dividir 60.000.000 por 1450 en float y redondear puede
caer del lado equivocado del medio centavo. ROUND_HALF_UP es el redondeo
"de calculadora" que espera quien controla la cuenta a mano.
"""

from decimal import ROUND_HALF_UP, Decimal

_CENTAVO = Decimal("0.01")


def _decimal(valor) -> Decimal:
    # str() primero: Decimal(0.1) arrastra el error binario del float,
    # Decimal("0.1") no.
    return valor if isinstance(valor, Decimal) else Decimal(str(valor))


def a_usd(monto_ars, cotizacion) -> Decimal:
    """Pesos -> dólares con la cotización congelada, redondeado al centavo."""
    return (_decimal(monto_ars) / _decimal(cotizacion)).quantize(_CENTAVO, rounding=ROUND_HALF_UP)


def a_ars(monto_usd, cotizacion) -> Decimal:
    """Dólares -> pesos con la cotización congelada, redondeado al centavo."""
    return (_decimal(monto_usd) * _decimal(cotizacion)).quantize(_CENTAVO, rounding=ROUND_HALF_UP)
