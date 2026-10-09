"""
Plazos de pago de compras y gastos (ver models.CondicionPago / PlazoPago).

Reglas (decididas con Fede, 09/10/2026):
- La condición arma los plazos: «Contado» = uno solo el día de la factura;
  «30/60 días» = dos, a +30 y +60 días de la fecha del movimiento.
- Partes iguales, a centavos; el último absorbe el redondeo.
- Cada plazo se marca pagado por separado. `estado_pago` del movimiento es
  derivado: pagado sólo si están todos pagados.
- Si cambia el total (edición, impuestos, una nota), lo que falta pagar
  (total − ya pagado) se reparte en partes iguales entre los pendientes; los
  pagados no se tocan. Si no queda ninguno pendiente y el total sube (nota
  de débito sobre algo ya pagado), se agrega un plazo de ajuste que vence ese
  día. Si baja, no se toca nada: es saldo a favor, no plata que volvió.
- Cambiar la condición sólo se puede si todavía no se pagó ningún plazo.

Todo en Decimal (plata). Las funciones modifican el movimiento en memoria;
el commit lo hace la ruta.
"""

from datetime import date, datetime, timedelta
from decimal import ROUND_DOWN, Decimal
from zoneinfo import ZoneInfo

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db import models

PAGADO = "pagado"
PENDIENTE = "pendiente"
_CENTAVO = Decimal("0.01")
_ZONA = ZoneInfo("America/Argentina/Buenos_Aires")

CONDICION_CON_PAGOS = (
    "No se puede cambiar la condición de pago: ya hay plazos pagados. "
    "Si cambió el monto, editalo y lo que falta se reparte solo."
)
CONDICION_NO_ENCONTRADA = "Condición de pago no encontrada"


def hoy() -> date:
    """La fecha de hoy en Argentina (el servidor está en UTC: después de las
    21 h ya sería mañana)."""
    return datetime.now(_ZONA).date()


def _decimal(valor) -> Decimal:
    return valor if isinstance(valor, Decimal) else Decimal(str(valor))


def dividir(total, partes: int) -> list[Decimal]:
    """Partes iguales a centavos; el último absorbe el redondeo.
    dividir(100, 3) -> [33.33, 33.33, 33.34]."""
    total = _decimal(total).quantize(_CENTAVO)
    base = (total / partes).quantize(_CENTAVO, rounding=ROUND_DOWN)
    return [base] * (partes - 1) + [total - base * (partes - 1)]


def total_ars(movimiento) -> Decimal:
    """Lo que hay que pagar en total: la compra con impuestos y notas, o el
    monto del gasto."""
    if isinstance(movimiento, models.Compra):
        return _decimal(movimiento.precio_total_ars).quantize(_CENTAVO)
    return _decimal(movimiento.monto_ars).quantize(_CENTAVO)


def contado(db: Session) -> models.CondicionPago:
    """La condición «Contado» (protegida, sin días): el default."""
    condicion = (
        db.query(models.CondicionPago)
        .filter(models.CondicionPago.protegido.is_(True))
        .order_by(models.CondicionPago.orden)
        .first()
    )
    if condicion is None:  # no debería pasar: la siembra la migración
        raise HTTPException(status_code=500, detail="Falta la condición de pago «Contado»")
    return condicion


def buscar_condicion(db: Session, condicion_id) -> models.CondicionPago:
    if condicion_id is None:
        return contado(db)
    condicion = db.query(models.CondicionPago).filter(models.CondicionPago.id == condicion_id).first()
    if condicion is None:
        raise HTTPException(status_code=404, detail=CONDICION_NO_ENCONTRADA)
    return condicion


def sincronizar_estado(movimiento) -> None:
    pagados = [p.pagado for p in movimiento.plazos]
    movimiento.estado_pago = PAGADO if pagados and all(pagados) else PENDIENTE


def armar_plazos(movimiento, condicion: models.CondicionPago, pagado: bool) -> None:
    """Plazos nuevos según la condición, sobre el total actual. Cargado ya
    pagado (historia del Excel), cada plazo queda pagado en su vencimiento:
    no se inventa un pago de hoy."""
    dias = list(condicion.dias) or [0]
    montos = dividir(max(total_ars(movimiento), Decimal(0)), len(dias))
    plazos = []
    for numero, (d, monto) in enumerate(zip(dias, montos), start=1):
        vencimiento = movimiento.fecha + timedelta(days=d)
        plazos.append(
            models.PlazoPago(
                numero=numero,
                dias=d,
                fecha_vencimiento=vencimiento,
                monto=monto,
                pagado=pagado,
                fecha_pago=vencimiento if pagado else None,
            )
        )
    movimiento.condicion_pago_id = condicion.id
    movimiento.plazos = plazos
    sincronizar_estado(movimiento)


def repartir_pendientes(movimiento, fecha_ajuste: date | None = None) -> None:
    """Lo que falta pagar (total − pagado) en partes iguales entre los
    plazos pendientes. Ver las reglas arriba para el caso sin pendientes."""
    plazos = movimiento.plazos
    pagado = sum((_decimal(p.monto) for p in plazos if p.pagado), Decimal(0))
    falta = total_ars(movimiento) - pagado
    pendientes = [p for p in plazos if not p.pagado]

    if pendientes:
        for plazo, monto in zip(pendientes, dividir(max(falta, Decimal(0)), len(pendientes))):
            plazo.monto = monto
    elif falta >= _CENTAVO:
        fecha = fecha_ajuste or hoy()
        plazos.append(
            models.PlazoPago(
                numero=len(plazos) + 1,
                dias=max((fecha - movimiento.fecha).days, 0),
                fecha_vencimiento=fecha,
                monto=falta,
                pagado=False,
                fecha_pago=None,
            )
        )
    sincronizar_estado(movimiento)


def mover_vencimientos(movimiento) -> None:
    """Cambió la fecha de la factura: los pendientes vencen desde la nueva.
    Los pagados quedan como están (ya pasaron)."""
    for plazo in movimiento.plazos:
        if not plazo.pagado:
            plazo.fecha_vencimiento = movimiento.fecha + timedelta(days=plazo.dias)


def cambiar_condicion(movimiento, condicion: models.CondicionPago) -> None:
    if condicion.id == movimiento.condicion_pago_id:
        return
    if any(p.pagado for p in movimiento.plazos):
        raise HTTPException(status_code=400, detail=CONDICION_CON_PAGOS)
    armar_plazos(movimiento, condicion, pagado=False)


def marcar_todos(movimiento, pagado: bool, fecha: date | None = None) -> None:
    """El badge de la lista y "marcar todas pagadas": todos los plazos de una.
    Los que se pagan ahora llevan la fecha de hoy; los ya pagados conservan
    la suya."""
    for plazo in movimiento.plazos:
        if pagado and not plazo.pagado:
            plazo.pagado = True
            plazo.fecha_pago = fecha or hoy()
        elif not pagado:
            plazo.pagado = False
            plazo.fecha_pago = None
    if not pagado:
        repartir_pendientes(movimiento)
    sincronizar_estado(movimiento)


def marcar_plazo(plazo: models.PlazoPago, pagado: bool, fecha: date | None = None) -> None:
    """Un plazo suelto desde la ficha. Desmarcarlo vuelve a repartir lo que
    falta (puede haber cambiado el total mientras estaba pagado)."""
    movimiento = plazo.compra or plazo.gasto
    plazo.pagado = pagado
    plazo.fecha_pago = (fecha or hoy()) if pagado else None
    repartir_pendientes(movimiento)


def actualizar(movimiento, condicion_nueva, estado_nuevo: str | None, cambio_fecha: bool) -> None:
    """Después de editar una compra o un gasto (montos y fecha ya puestos):
    condición nueva (sólo sin pagos), vencimientos pendientes a la fecha
    nueva, lo que falta repartido, y por último el estado (el badge "Pagado"
    de la lista marca todos los plazos).

    El estado sólo se aplica si cambia: el modal manda el movimiento entero,
    y uno con un plazo pagado y otro no (estado "pendiente") no tiene que
    perder el pago que ya tiene."""
    cambia_estado = estado_nuevo is not None and estado_nuevo != movimiento.estado_pago
    # Pasar de "Pagado" a "A pagar" desmarca todo ANTES de la condición: así
    # un gasto cargado como Contado pagado por error se puede pasar a 30 días
    # sin pagar en una sola edición. Un pago parcial real (estado ya
    # "pendiente") sigue bloqueando el cambio de condición.
    if cambia_estado and estado_nuevo != PAGADO:
        marcar_todos(movimiento, False)
    if condicion_nueva is not None:
        cambiar_condicion(movimiento, condicion_nueva)
    if cambio_fecha:
        mover_vencimientos(movimiento)
    repartir_pendientes(movimiento)
    if cambia_estado and estado_nuevo == PAGADO:
        marcar_todos(movimiento, True)


def extraer_cambios_de_pago(db: Session, datos: dict):
    """Saca del dict del PUT lo de pago (no son columnas que se pisan tal
    cual): (condición nueva o None, estado nuevo o None)."""
    condicion = buscar_condicion(db, datos.pop("condicion_pago_id")) if "condicion_pago_id" in datos else None
    return condicion, datos.pop("estado_pago", None)
