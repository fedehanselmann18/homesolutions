"""
Cálculos financieros para el reporte PDF de un Proyecto.

Es un puerto a Python del subconjunto de frontend/src/utils/analisis.js que
hace falta para el reporte (totales, cascada de rentabilidad, notas de
crédito/débito, deuda a proveedores, gastos por categoría, impuestos por
tipo, top proveedores). Mismas fórmulas, mismos nombres de campo en español
-- así si algún día hay que tocar un cálculo, se busca en los dos lugares a
la vez y no se pisan.

Recibe objetos ORM ya cargados (con notas/impuestos_aplicados/categorias
eager-loaded por la route) y devuelve un dict plano, listo para pasarle a
pdf_proyecto.py.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

# Los type hints de calcular_analisis_proyecto (más abajo) referencian
# app.db.models solo para autocompletado/type-checking -- este módulo tiene
# que seguir siendo puro (sin dependencias de SQLAlchemy) y NO se importa
# models en runtime. Sin este import bajo TYPE_CHECKING, esos hints
# quedaban apuntando a un nombre no definido (los pisaba `from __future__
# import annotations`, así que no rompía nada en ejecución, pero un type
# checker real -- o alguien leyendo el código -- no podía resolverlos).
if TYPE_CHECKING:
    from app.db import models

SIN_CATEGORIA = "Sin categoría"


def _num(valor) -> float:
    return float(valor) if valor is not None else 0.0


def _notas_credito(notas: list) -> float:
    return sum(_num(n.monto) for n in notas if n.tipo == "nota_credito")


def _notas_debito(notas: list) -> float:
    return sum(_num(n.monto) for n in notas if n.tipo == "nota_debito")


def _porcentaje(parte: float, total: float) -> float:
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


def _gastos_por_categoria(gastos: list) -> list[dict]:
    """
    Un Gasto puede tener varias categorías (N a N) -- el monto se reparte en
    partes iguales entre ellas para que la suma dé exactamente el total de
    gastos (mismo criterio que gastosPorCategoria() en utils/analisis.js).
    """
    acumulado: dict[str, float] = {}
    for gasto in gastos:
        categorias = list(gasto.categorias) if gasto.categorias else None
        nombres = [c.nombre for c in categorias] if categorias else [SIN_CATEGORIA]
        por_categoria = _num(gasto.monto) / len(nombres)
        for nombre in nombres:
            acumulado[nombre] = acumulado.get(nombre, 0.0) + por_categoria
    return sorted(
        [{"nombre": n, "monto": m} for n, m in acumulado.items()],
        key=lambda d: d["monto"],
        reverse=True,
    )


def _impuestos_por_tipo(compras: list) -> list[dict]:
    acumulado: dict[str, float] = {}
    for compra in compras:
        for aplicado in compra.impuestos_aplicados:
            nombre = aplicado.impuesto.nombre if aplicado.impuesto else "Impuesto"
            acumulado[nombre] = acumulado.get(nombre, 0.0) + _num(aplicado.monto)
    return sorted(
        [{"nombre": n, "monto": m} for n, m in acumulado.items()],
        key=lambda d: d["monto"],
        reverse=True,
    )


def _top_proveedores(compras: list, limite: int = 6) -> list[dict]:
    acumulado: dict[str, float] = {}
    for compra in compras:
        nombre = compra.proveedor.nombre if compra.proveedor else "Proveedor eliminado"
        acumulado[nombre] = acumulado.get(nombre, 0.0) + compra.precio_total
    ranking = sorted(
        [{"nombre": n, "monto": m} for n, m in acumulado.items()],
        key=lambda d: d["monto"],
        reverse=True,
    )
    return ranking[:limite]


def _resumen_ejecutivo(totales: dict, deuda_total: float, notas: dict) -> list[str]:
    """
    Un puñado de frases armadas a partir de los números, para que el que abre
    el PDF entienda el estado del proyecto sin tener que leer todas las
    tablas. Determinístico (sin IA): solo condicionales sobre los totales ya
    calculados, cero riesgo de inventar un dato que no está en la cuenta.
    """
    frases = []

    if totales["margenBruto"] >= 0:
        frases.append(
            f"El proyecto mantiene un margen bruto positivo de {_fmt(totales['margenBruto'])}, "
            f"un {_pct(totales['margenBruto'], totales['cobrado'])}% de lo cobrado."
        )
    else:
        frases.append(
            f"El proyecto tiene un margen bruto NEGATIVO de {_fmt(totales['margenBruto'])}: "
            f"los gastos y compras ya superaron lo cobrado."
        )

    if totales["pctGastado"] > 100:
        frases.append(
            f"El gasto total ({_fmt(totales['egresos'])}) superó el precio acordado "
            f"en un {totales['pctGastado'] - 100:.1f}%."
        )
    elif totales["pctGastado"] > 85:
        frases.append(f"Ya se gastó el {totales['pctGastado']:.1f}% del precio acordado.")

    if deuda_total > 0:
        frases.append(f"Hay {_fmt(deuda_total)} pendientes de pago a proveedores.")

    ajuste_neto_notas = (
        notas["compras"]["debito"]
        - notas["compras"]["credito"]
        + notas["cobros"]["debito"]
        - notas["cobros"]["credito"]
    )
    if notas["compras"]["cantidad"] + notas["cobros"]["cantidad"] > 0:
        direccion = "sumaron" if ajuste_neto_notas > 0 else "restaron"
        frases.append(
            f"Las notas de crédito/débito {direccion} {_fmt(abs(ajuste_neto_notas))} netos al resultado."
        )

    if totales["disponible"] >= 0:
        frases.append(f"Disponible actual: {_fmt(totales['disponible'])}.")
    else:
        frases.append(f"El proyecto está {_fmt(abs(totales['disponible']))} por debajo de lo cobrado.")

    return frases


def _fmt(monto: float) -> str:
    # Formato simple ($ 1.234.567, es-AR) -- duplicado a propósito del de
    # pdf_proyecto.py: calculos.py es puro y no debe importar el módulo de
    # render del PDF.
    monto = round(monto or 0)
    signo = "-" if monto < 0 else ""
    entero = f"{abs(monto):,.0f}".replace(",", ".")
    return f"{signo}$ {entero}"


def _pct(parte: float, total: float) -> str:
    return f"{_porcentaje(parte, total):.1f}"


def calcular_analisis_proyecto(
    proyecto: "models.Proyecto",
    fases: list["models.Fase"],
    gastos: list["models.Gasto"],
    cobros: list["models.Cobro"],
    compras: list["models.Compra"],
) -> dict:
    # Cobrado NETO: Cobro.monto_neto ya descuenta notas de crédito y suma las
    # de débito (ver app/db/models.py). Usar el bruto acá ignoraría los
    # ajustes de precio hechos al cliente.
    total_cobrado = sum(c.monto_neto for c in cobros)
    total_gastos = sum(_num(g.monto) for g in gastos)
    total_compras_neto = sum(_num(c.precio_neto) for c in compras)
    total_impuestos = sum(sum(_num(ci.monto) for ci in c.impuestos_aplicados) for c in compras)

    # Notas de crédito/débito de las compras (cuenta corriente con proveedores).
    notas_compra = [n for c in compras for n in c.notas]
    notas_credito_compras = _notas_credito(notas_compra)
    notas_debito_compras = _notas_debito(notas_compra)
    ajuste_notas_compras = notas_debito_compras - notas_credito_compras

    # Mismo criterio del lado de los cobros (ajustes de precio al cliente).
    notas_cobro = [n for c in cobros for n in c.notas]
    notas_credito_cobros = _notas_credito(notas_cobro)
    notas_debito_cobros = _notas_debito(notas_cobro)

    total_compras = total_compras_neto + total_impuestos + ajuste_notas_compras
    total_egresos = total_gastos + total_compras
    disponible = total_cobrado - total_egresos
    margen_bruto = total_cobrado - total_gastos - total_compras_neto - ajuste_notas_compras

    precio_acordado_usd = _num(proyecto.precio_acordado_usd)

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
    # (Compra.precio_total ya neto de notas, ver app/db/models.py).
    fases_resumen = []
    for fase in fases:
        gastado_fase = sum(_num(g.monto) for g in gastos if g.fase_id == fase.id) + sum(
            c.precio_total for c in compras if c.fase_id == fase.id
        )
        fases_resumen.append(
            {
                "nombre": fase.nombre,
                "estado": ESTADO_FASE_LABELS.get(fase.estado, fase.estado),
                "gastado": gastado_fase,
                "pct_presupuesto": _porcentaje(gastado_fase, precio_acordado_usd),
            }
        )
    egresos_por_fase = sorted(
        [f for f in fases_resumen if f["gastado"] > 0], key=lambda f: f["gastado"], reverse=True
    )

    # Deuda pendiente por proveedor (mismo criterio que utils/seguimiento.js:
    # esCompraImpaga = estado_pago == "pendiente").
    deuda_por_proveedor: dict[str, dict] = {}
    for compra in compras:
        if compra.estado_pago != "pendiente":
            continue
        nombre = compra.proveedor.nombre if compra.proveedor else "Proveedor eliminado"
        actual = deuda_por_proveedor.setdefault(nombre, {"proveedor": nombre, "monto": 0.0, "compras": 0})
        actual["monto"] += compra.precio_total
        actual["compras"] += 1
    deuda_lista = sorted(deuda_por_proveedor.values(), key=lambda d: d["monto"], reverse=True)

    notas = {
        "compras": {
            "credito": notas_credito_compras,
            "debito": notas_debito_compras,
            "cantidad": len(notas_compra),
        },
        "cobros": {
            "credito": notas_credito_cobros,
            "debito": notas_debito_cobros,
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
        "precioAcordado": precio_acordado_usd,
        "pctCobrado": _porcentaje(total_cobrado, precio_acordado_usd),
        "pctGastado": _porcentaje(total_egresos, precio_acordado_usd),
    }
    deuda_total = sum(d["monto"] for d in deuda_lista)

    return {
        "totales": totales,
        "cascada": cascada,
        "notas": notas,
        "fases": fases_resumen,
        "egresos_por_fase": egresos_por_fase,
        "deuda_por_proveedor": deuda_lista,
        "deuda_total": deuda_total,
        "gastos_por_categoria": _gastos_por_categoria(gastos),
        "impuestos_por_tipo": _impuestos_por_tipo(compras),
        "top_proveedores": _top_proveedores(compras),
        "resumen_ejecutivo": _resumen_ejecutivo(totales, deuda_total, notas),
    }
