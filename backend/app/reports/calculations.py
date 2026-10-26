"""
Cálculos financieros para el reporte PDF de un Proyecto.

Es un puerto a Python del subconjunto de frontend/src/utils/analisis.js que
hace falta para el reporte (totales, cascada de rentabilidad, notas de
crédito/débito, deuda a proveedores, gastos por categoría, impuestos por
tipo, top proveedores). Mismas fórmulas, mismos nombres de campo en español
-- así si algún día hay que tocar un cálculo, se busca en los dos lugares a
la vez y no se pisan.

Doble moneda: calcular_analisis_proyecto
recibe la moneda y es UN SOLO cuerpo de fórmulas que se invoca dos veces
(USD y ARS). Así las dos monedas usan exactamente la misma cuenta y nadie
puede arreglar una y olvidarse de la otra. Cada movimiento ya trae sus dos
cifras congeladas, así que acá no se convierte nada: solo se elige qué
columna sumar. Los pesos son nominales históricos (lo que salió de la caja),
nada se reexpresa a dólar de hoy.

Recibe objetos ORM ya cargados (con notas/impuestos_aplicados/categorias
eager-loaded por la route) y devuelve un dict plano, listo para pasarle a
pdf_proyecto.py.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Literal

# Los type hints de calcular_analisis_proyecto (más abajo) referencian
# app.db.models solo para autocompletado/type-checking -- este módulo tiene
# que seguir siendo puro (sin dependencias de SQLAlchemy) y NO se importa
# models en runtime. Sin este import bajo TYPE_CHECKING, esos hints
# quedaban apuntando a un nombre no definido (los pisaba `from __future__
# import annotations`, así que no rompía nada en ejecución, pero un type
# checker real -- o alguien leyendo el código -- no podía resolverlos).
if TYPE_CHECKING:
    from app.db import models

Moneda = Literal["usd", "ars"]

SIN_CATEGORIA = "Sin categoría"


def _num(valor) -> float:
    return float(valor) if valor is not None else 0.0


class _Amounts:
    """
    Qué columna leer de cada movimiento según la moneda. Es lo único que
    cambia entre el análisis en USD y en ARS: las fórmulas son las mismas.
    """

    def __init__(self, moneda: Moneda):
        if moneda not in ("usd", "ars"):
            raise ValueError(f"Moneda desconocida: {moneda!r}")
        self.moneda = moneda

    def gasto(self, gasto) -> float:
        return _num(getattr(gasto, f"monto_{self.moneda}"))

    def cobro_neto(self, cobro) -> float:
        return getattr(cobro, f"monto_neto_{self.moneda}")

    def compra_neto(self, compra) -> float:
        return _num(getattr(compra, f"precio_neto_{self.moneda}"))

    def compra_total(self, compra) -> float:
        return getattr(compra, f"precio_total_{self.moneda}")

    def impuesto(self, aplicado) -> float:
        # Los impuestos guardan solo pesos: en USD heredan la cotización de
        # su compra (CompraImpuesto.monto_usd).
        return _num(aplicado.monto) if self.moneda == "ars" else aplicado.monto_usd

    def nota(self, nota) -> float:
        return _num(getattr(nota, f"monto_{self.moneda}"))


def _notas_credito(notas: list, m: _Amounts) -> float:
    return sum(m.nota(n) for n in notas if n.tipo == "nota_credito")


def _notas_debito(notas: list, m: _Amounts) -> float:
    return sum(m.nota(n) for n in notas if n.tipo == "nota_debito")


def _porcentaje(parte: float, total: float | None) -> float:
    if not total:
        return 0.0
    return (parte / total) * 100


ESTADO_FASE_LABELS = {
    "por_empezar": "Por empezar",
    "en_curso": "En curso",
    "terminada": "Terminada",
    "auditada": "Auditada",
}


def _armar_cascada(pasos: list[dict]) -> list[dict]:
    """
    Mismo criterio que armarCascada() en utils/analisis.js: los pasos
    "subtotal"/"total" arrancan en cero, los demás siguen desde donde terminó
    el paso anterior. Devuelve cada paso con su "rango" [desde, hasta] para
    poder dibujar el waterfall.
    """
    acumulado = 0.0
    resultado = []
    for paso in pasos:
        arranca_en_cero = paso["tipo"] in ("subtotal", "total")
        desde = 0.0 if arranca_en_cero else acumulado
        hasta = paso["valor"] if arranca_en_cero else acumulado + paso["valor"]
        acumulado = hasta
        resultado.append({**paso, "rango": [desde, hasta]})
    return resultado


def _gastos_por_categoria(gastos: list, m: _Amounts) -> list[dict]:
    """
    Un Gasto puede tener varias categorías (N a N) -- el monto se reparte en
    partes iguales entre ellas para que la suma dé exactamente el total de
    gastos (mismo criterio que gastosPorCategoria() en utils/analisis.js).
    """
    acumulado: dict[str, float] = {}
    for gasto in gastos:
        categorias = list(gasto.categorias) if gasto.categorias else None
        nombres = [c.nombre for c in categorias] if categorias else [SIN_CATEGORIA]
        por_categoria = m.gasto(gasto) / len(nombres)
        for nombre in nombres:
            acumulado[nombre] = acumulado.get(nombre, 0.0) + por_categoria
    return sorted(
        [{"nombre": n, "monto": m_} for n, m_ in acumulado.items()],
        key=lambda d: d["monto"],
        reverse=True,
    )


def _impuestos_por_tipo(compras: list, m: _Amounts) -> list[dict]:
    acumulado: dict[str, float] = {}
    for compra in compras:
        for aplicado in compra.impuestos_aplicados:
            # Por grupo ("IVA" junta IVA 21 e IVA 10,5); sin grupo, por nombre.
            # Mismo criterio que impuestosPorTipo en el front (utils/analisis.js).
            impuesto = aplicado.impuesto
            nombre = (impuesto.grupo or impuesto.nombre) if impuesto else "Impuesto"
            acumulado[nombre] = acumulado.get(nombre, 0.0) + m.impuesto(aplicado)
    return sorted(
        [{"nombre": n, "monto": m_} for n, m_ in acumulado.items()],
        key=lambda d: d["monto"],
        reverse=True,
    )


def _top_proveedores(compras: list, m: _Amounts, limite: int = 6) -> list[dict]:
    acumulado: dict[str, float] = {}
    for compra in compras:
        nombre = compra.proveedor.nombre if compra.proveedor else "Proveedor eliminado"
        acumulado[nombre] = acumulado.get(nombre, 0.0) + m.compra_total(compra)
    ranking = sorted(
        [{"nombre": n, "monto": m_} for n, m_ in acumulado.items()],
        key=lambda d: d["monto"],
        reverse=True,
    )
    return ranking[:limite]


def _sumas(gastos: list, cobros: list, compras: list, m: _Amounts) -> dict:
    # Cobrado NETO: Cobro.monto_neto_* ya descuenta notas de crédito y suma
    # las de débito (ver app/db/models/). Usar el bruto acá ignoraría los
    # ajustes de precio hechos al cliente.
    cobrado = sum(m.cobro_neto(c) for c in cobros)
    total_gastos = sum(m.gasto(g) for g in gastos)
    compras_neto = sum(m.compra_neto(c) for c in compras)
    impuestos = sum(sum(m.impuesto(ci) for ci in c.impuestos_aplicados) for c in compras)
    notas_compra = [n for c in compras for n in c.notas]
    ajuste_notas_compras = _notas_debito(notas_compra, m) - _notas_credito(notas_compra, m)
    total_compras = compras_neto + impuestos + ajuste_notas_compras
    return {
        "cobrado": cobrado,
        "gastos": total_gastos,
        "compras_neto": compras_neto,
        "impuestos": impuestos,
        "ajuste_notas_compras": ajuste_notas_compras,
        "compras": total_compras,
        "egresos": total_gastos + total_compras,
    }


def calcular_analisis_proyecto(
    proyecto: "models.Project",
    fases: list["models.Phase"],
    gastos: list["models.Expense"],
    cobros: list["models.ClientPayment"],
    compras: list["models.Purchase"],
    moneda: Moneda = "usd",
    cotizacion_actual: float | None = None,
) -> dict:
    """
    `cotizacion_actual` solo se usa para el precio acordado en pesos ("cuánto
    vale hoy el contrato", decisión #8): es lo único que no tiene una cifra
    congelada propia. Sin cotización cargada, ese precio queda en None.
    """
    m = _Amounts(moneda)
    usd = _Amounts("usd")

    s = _sumas(gastos, cobros, compras, m)
    total_cobrado = s["cobrado"]
    total_gastos = s["gastos"]
    total_compras_neto = s["compras_neto"]
    total_impuestos = s["impuestos"]
    ajuste_notas_compras = s["ajuste_notas_compras"]
    total_compras = s["compras"]
    total_egresos = s["egresos"]
    disponible = total_cobrado - total_egresos
    margen_bruto = total_cobrado - total_gastos - total_compras_neto - ajuste_notas_compras

    # Notas de crédito/débito de las compras (cuenta corriente con proveedores).
    notas_compra = [n for c in compras for n in c.notas]
    # Mismo criterio del lado de los cobros (ajustes de precio al cliente).
    notas_cobro = [n for c in cobros for n in c.notas]

    precio_acordado_usd = _num(proyecto.precio_acordado_usd)
    if moneda == "usd":
        precio_acordado = precio_acordado_usd
    else:
        precio_acordado = precio_acordado_usd * float(cotizacion_actual) if cotizacion_actual else None

    # Los % contra el precio acordado se calculan SIEMPRE en USD (caveat 6.3):
    # comparar pesos nominales de marzo contra un precio reexpresado a hoy
    # mezcla dos cosas distintas. En el análisis en pesos se muestran igual,
    # pero el número sale de la cuenta en dólares.
    s_usd = s if moneda == "usd" else _sumas(gastos, cobros, compras, usd)

    cascada = _armar_cascada(
        [
            {"nombre": "Cobrado", "valor": total_cobrado, "tipo": "entrada"},
            {"nombre": "Gastos", "valor": -total_gastos, "tipo": "salida"},
            {"nombre": "Compras", "valor": -total_compras_neto, "tipo": "salida"},
            {"nombre": "Notas (compras)", "valor": -ajuste_notas_compras, "tipo": "ajuste"},
            {"nombre": "Margen bruto", "valor": margen_bruto, "tipo": "subtotal"},
            {"nombre": "Impuestos", "valor": -total_impuestos, "tipo": "salida"},
            {"nombre": "Ganancia neta", "valor": disponible, "tipo": "total"},
        ]
    )

    # Resumen por fase: gastado = gastos de la fase + compras de la fase
    # (Compra.precio_total_* ya neto de notas, ver app/db/models/).
    def _gastado_fase(fase_id, montos: _Amounts) -> float:
        return sum(montos.gasto(g) for g in gastos if g.fase_id == fase_id) + sum(
            montos.compra_total(c) for c in compras if c.fase_id == fase_id
        )

    fases_resumen = []
    for fase in fases:
        fases_resumen.append(
            {
                "nombre": fase.nombre,
                "estado": ESTADO_FASE_LABELS.get(fase.estado, fase.estado),
                "gastado": _gastado_fase(fase.id, m),
                # En USD siempre, mismo motivo que pctGastado.
                "pct_presupuesto": _porcentaje(_gastado_fase(fase.id, usd), precio_acordado_usd),
            }
        )
    egresos_por_fase = sorted(
        [f for f in fases_resumen if f["gastado"] > 0], key=lambda f: f["gastado"], reverse=True
    )

    # Deuda pendiente por proveedor (mismo criterio que utils/seguimiento.js:
    # esCompraImpaga = estado_pago == "pendiente"). Ordenada SIEMPRE por los
    # pesos, en las dos monedas: la deuda es una obligación en pesos (caveat
    # 6.2), y así las dos listas quedan en el mismo orden para mostrarlas juntas.
    deuda_por_proveedor: dict[str, dict] = {}
    for compra in compras:
        if compra.estado_pago != "pendiente":
            continue
        nombre = compra.proveedor.nombre if compra.proveedor else "Proveedor eliminado"
        actual = deuda_por_proveedor.setdefault(
            nombre, {"proveedor": nombre, "monto": 0.0, "monto_ars": 0.0, "compras": 0}
        )
        actual["monto"] += m.compra_total(compra)
        actual["monto_ars"] += compra.precio_total_ars
        actual["compras"] += 1
    deuda_lista = sorted(deuda_por_proveedor.values(), key=lambda d: d["monto_ars"], reverse=True)
    for deuda in deuda_lista:
        del deuda["monto_ars"]

    notas = {
        "compras": {
            "credito": _notas_credito(notas_compra, m),
            "debito": _notas_debito(notas_compra, m),
            "cantidad": len(notas_compra),
        },
        "cobros": {
            "credito": _notas_credito(notas_cobro, m),
            "debito": _notas_debito(notas_cobro, m),
            "cantidad": len(notas_cobro),
        },
    }
    totales = {
        "cobrado": total_cobrado,
        "gastos": total_gastos,
        "comprasNeto": total_compras_neto,
        "compras": total_compras,
        "impuestos": total_impuestos,
        "egresos": total_egresos,
        "disponible": disponible,
        "margenBruto": margen_bruto,
        "precioAcordado": precio_acordado,
        "pctCobrado": _porcentaje(s_usd["cobrado"], precio_acordado_usd),
        "pctGastado": _porcentaje(s_usd["egresos"], precio_acordado_usd),
    }
    deuda_total = sum(d["monto"] for d in deuda_lista)

    return {
        "moneda": moneda,
        "totales": totales,
        "cascada": cascada,
        "notas": notas,
        "fases": fases_resumen,
        "egresos_por_fase": egresos_por_fase,
        "deuda_por_proveedor": deuda_lista,
        "deuda_total": deuda_total,
        "gastos_por_categoria": _gastos_por_categoria(gastos, m),
        "impuestos_por_tipo": _impuestos_por_tipo(compras, m),
        "top_proveedores": _top_proveedores(compras, m),
    }


# ---------------------------------------------------------------------------
# Reporte completo: las dos monedas + resumen ejecutivo
# ---------------------------------------------------------------------------


def _fmt(monto: float, moneda: Moneda) -> str:
    # Formato simple (US$ 1.234.567 / ARS 1.234.567, es-AR) -- duplicado a
    # propósito del de pdf_proyecto.py: calculos.py es puro y no debe
    # importar el módulo de render del PDF.
    monto = round(monto or 0)
    signo = "-" if monto < 0 else ""
    entero = f"{abs(monto):,.0f}".replace(",", ".")
    return f"{signo}{'US$' if moneda == 'usd' else 'ARS'} {entero}"


def _dual(usd: float, ars: float) -> str:
    """USD principal y ARS entre paréntesis (decisión #6)."""
    return f"{_fmt(usd, 'usd')} ({_fmt(ars, 'ars')})"


def _pct(parte: float, total: float) -> str:
    return f"{_porcentaje(parte, total):.1f}"


def _resumen_ejecutivo(usd: dict, ars: dict) -> list[str]:
    """
    Un puñado de frases armadas a partir de los números, para que el que abre
    el PDF entienda el estado del proyecto sin tener que leer todas las
    tablas. Determinístico (sin IA): solo condicionales sobre los totales ya
    calculados, cero riesgo de inventar un dato que no está en la cuenta.

    Las decisiones (positivo/negativo, cuánto se gastó) se toman en USD, que
    es la vara de rentabilidad; cada cifra se muestra en las dos monedas.
    """
    t, ta = usd["totales"], ars["totales"]
    frases = []

    if t["margenBruto"] >= 0:
        frases.append(
            f"El proyecto mantiene un margen bruto positivo de {_dual(t['margenBruto'], ta['margenBruto'])}, "
            f"un {_pct(t['margenBruto'], t['cobrado'])}% de lo cobrado."
        )
    else:
        frases.append(
            f"El proyecto tiene un margen bruto NEGATIVO de {_dual(t['margenBruto'], ta['margenBruto'])}: "
            f"los gastos y compras ya superaron lo cobrado."
        )

    if t["pctGastado"] > 100:
        frases.append(
            f"El gasto total ({_dual(t['egresos'], ta['egresos'])}) superó el precio acordado "
            f"en un {t['pctGastado'] - 100:.1f}%."
        )
    elif t["pctGastado"] > 85:
        frases.append(f"Ya se gastó el {t['pctGastado']:.1f}% del precio acordado.")

    if usd["deuda_total"] > 0:
        # Al revés que el resto: la deuda se debe en pesos (caveat 6.2).
        frases.append(
            f"Hay {_fmt(ars['deuda_total'], 'ars')} ({_fmt(usd['deuda_total'], 'usd')}) "
            f"pendientes de pago a proveedores."
        )

    def _ajuste_neto(notas):
        return (
            notas["compras"]["debito"]
            - notas["compras"]["credito"]
            + notas["cobros"]["debito"]
            - notas["cobros"]["credito"]
        )

    notas = usd["notas"]
    if notas["compras"]["cantidad"] + notas["cobros"]["cantidad"] > 0:
        ajuste_usd = _ajuste_neto(notas)
        ajuste_ars = _ajuste_neto(ars["notas"])
        direccion = "sumaron" if ajuste_usd > 0 else "restaron"
        frases.append(
            f"Las notas de crédito/débito {direccion} {_dual(abs(ajuste_usd), abs(ajuste_ars))} netos al resultado."
        )

    if t["disponible"] >= 0:
        frases.append(f"Disponible actual: {_dual(t['disponible'], ta['disponible'])}.")
    else:
        frases.append(
            f"El proyecto está {_dual(abs(t['disponible']), abs(ta['disponible']))} por debajo de lo cobrado."
        )

    return frases


def calcular_reporte_proyecto(
    proyecto: "models.Project",
    fases: list["models.Phase"],
    gastos: list["models.Expense"],
    cobros: list["models.ClientPayment"],
    compras: list["models.Purchase"],
    cotizacion_actual: float | None = None,
) -> dict:
    """El análisis en las dos monedas, listo para el PDF (USD principal)."""
    usd = calcular_analisis_proyecto(proyecto, fases, gastos, cobros, compras, "usd", cotizacion_actual)
    ars = calcular_analisis_proyecto(proyecto, fases, gastos, cobros, compras, "ars", cotizacion_actual)
    return {
        "usd": usd,
        "ars": ars,
        "cotizacion_actual": cotizacion_actual,
        "resumen_ejecutivo": _resumen_ejecutivo(usd, ars),
    }
