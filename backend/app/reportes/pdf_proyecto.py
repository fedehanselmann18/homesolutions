"""
Generación del PDF de "Reporte de Proyecto" con reportlab.

Uso reportlab (no weasyprint) a propósito: es pip-install puro, sin
dependencias de sistema (Pango/Cairo) que compliquen correr esto en local en
Mac antes del eventual deploy -- ver charla con Fede del 2026-07-30. Los
gráficos (waterfall, donuts, barras) se agregaron después con
reportlab.graphics a pedido de Fede, para que el reporte no sea solo tablas.

Identidad de marca (Home Solutions, manual HS_IID_Manual.pdf v1_06/26):
- Paleta: oliva #6f7f45, oliva claro #a8b36a, gris claro #d9d7d2,
  gris oscuro #5a5a58, negro #000000.
- Tipografía del manual: Public Sans (Google Fonts). No se pudo bajar el TTF
  exacto (sin salida de red a fonts.gstatic.com desde donde se armó esto) --
  se usa Liberation Sans como reemplazo visualmente muy cercano (misma
  familia humanista/geométrica). Los .ttf están en assets/fuentes/; para
  pasar a Public Sans real alcanza con reemplazar esos archivos y los
  registerFont() de abajo.
- Logo: assets/marca/logo_negro.png (isotipo + logotipo, para fondo claro).
"""

from __future__ import annotations

import io
from datetime import date, datetime
from pathlib import Path

from reportlab.graphics.charts.barcharts import HorizontalBarChart, VerticalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Circle, Drawing, Line, Rect, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

ASSETS = Path(__file__).parent / "assets"
FUENTES = ASSETS / "fuentes"
MARCA = ASSETS / "marca"

# --- Paleta de marca (manual HS_IID_Manual.pdf) ---------------------------
OLIVA = colors.HexColor("#6f7f45")
GRIS_CLARO = colors.HexColor("#d9d7d2")
GRIS_OSCURO = colors.HexColor("#5a5a58")
NEGRO = colors.HexColor("#000000")
BLANCO = colors.white

# --- Paleta funcional de gráficos (misma semántica que AnalisisGeneral.jsx) -
VERDE = colors.HexColor("#16a34a")
ROJO = colors.HexColor("#dc2626")
AZUL = colors.HexColor("#64748b")
NARANJA = colors.HexColor("#d97706")

COLORES_TORTA = [
    colors.HexColor(h)
    for h in ["#6f7f45", "#16a34a", "#d97706", "#64748b", "#7c3aed", "#0891b2", "#dc2626", "#52525b"]
]

_FUENTES_REGISTRADAS = False


def _registrar_fuentes() -> None:
    global _FUENTES_REGISTRADAS
    if _FUENTES_REGISTRADAS:
        return
    pdfmetrics.registerFont(TTFont("Marca", str(FUENTES / "LiberationSans-Regular.ttf")))
    pdfmetrics.registerFont(TTFont("Marca-Bold", str(FUENTES / "LiberationSans-Bold.ttf")))
    pdfmetrics.registerFont(TTFont("Marca-Italic", str(FUENTES / "LiberationSans-Italic.ttf")))
    _FUENTES_REGISTRADAS = True


def formato_moneda(monto: float) -> str:
    """$ 1.234.567 -- mismo formato que frontend/src/utils/formato.js (es-AR, sin decimales)."""
    monto = round(monto or 0)
    signo = "-" if monto < 0 else ""
    entero = f"{abs(monto):,.0f}".replace(",", ".")
    return f"{signo}$ {entero}"


def formato_moneda_corta(monto: float) -> str:
    """$500K / $1.2M -- mismo criterio que formatMonedaCorta() del frontend, para ejes y etiquetas de gráficos."""
    monto = monto or 0
    signo = "-" if monto < 0 else ""
    absoluto = abs(monto)
    if absoluto >= 1_000_000:
        texto = f"{absoluto / 1_000_000:.1f}".rstrip("0").rstrip(".") + "M"
    elif absoluto >= 1_000:
        texto = f"{absoluto / 1_000:.0f}K"
    else:
        texto = f"{absoluto:.0f}"
    return f"{signo}${texto}"


def formato_fecha(fecha: date | None) -> str:
    if not fecha:
        return "-"
    return fecha.strftime("%d/%m/%Y")


def formato_pct(valor: float) -> str:
    return f"{valor:.1f}%"


def _truncar(texto: str, largo: int) -> str:
    return texto if len(texto) <= largo else texto[: largo - 1] + "…"


def _estilos():
    _registrar_fuentes()
    hoja = getSampleStyleSheet()
    return {
        "titulo": ParagraphStyle(
            "titulo", parent=hoja["Normal"], fontName="Marca-Bold", fontSize=20, textColor=NEGRO, leading=24
        ),
        "subtitulo": ParagraphStyle(
            "subtitulo",
            parent=hoja["Normal"],
            fontName="Marca",
            fontSize=10,
            textColor=GRIS_OSCURO,
            leading=14,
        ),
        "seccion": ParagraphStyle(
            "seccion",
            parent=hoja["Normal"],
            fontName="Marca-Bold",
            fontSize=13,
            textColor=OLIVA,
            spaceBefore=16,
            spaceAfter=8,
        ),
        "subseccion": ParagraphStyle(
            "subseccion",
            parent=hoja["Normal"],
            fontName="Marca-Bold",
            fontSize=10.5,
            textColor=GRIS_OSCURO,
            spaceBefore=10,
            spaceAfter=4,
        ),
        "texto": ParagraphStyle(
            "texto", parent=hoja["Normal"], fontName="Marca", fontSize=9.5, textColor=NEGRO, leading=13
        ),
        "vacio": ParagraphStyle(
            "vacio", parent=hoja["Normal"], fontName="Marca-Italic", fontSize=9.5, textColor=GRIS_OSCURO
        ),
        "resumen_item": ParagraphStyle(
            "resumen_item",
            parent=hoja["Normal"],
            fontName="Marca",
            fontSize=10,
            textColor=NEGRO,
            leading=15,
            leftIndent=10,
            bulletIndent=0,
        ),
    }


# ---------------------------------------------------------------------------
# Gráficos (reportlab.graphics)
# ---------------------------------------------------------------------------


def _color_paso_cascada(paso: dict):
    if paso["tipo"] in ("total", "ajuste"):
        return ROJO if paso["valor"] < 0 else VERDE
    return {"entrada": VERDE, "salida": NARANJA, "subtotal": AZUL}.get(paso["tipo"], AZUL)


ETIQUETAS_CORTAS_CASCADA = {
    "Cobrado": "Cobrado",
    "Gastos": "Gastos",
    "Compras": "Compras",
    "Notas (compras)": "Notas",
    "Margen bruto": "Margen",
    "Impuestos": "Impuestos",
    "Ganancia neta": "Ganancia",
}


def _grafico_cascada(cascada: list[dict], ancho: float = 470, alto: float = 210) -> Drawing:
    """Waterfall: barras flotantes [desde, hasta] coloreadas por tipo de paso, mismo criterio visual que la cascada de AnalisisGeneral.jsx."""
    d = Drawing(ancho, alto)

    margen_izq, margen_der, margen_sup, margen_inf = 45, 15, 26, 30
    area_ancho = ancho - margen_izq - margen_der
    area_alto = alto - margen_sup - margen_inf

    valores = [v for paso in cascada for v in paso["rango"]]
    minimo = min(0, *valores)
    maximo = max(0, *valores)
    rango_total = (maximo - minimo) or 1

    def y_de(valor):
        return margen_inf + (valor - minimo) / rango_total * area_alto

    n = len(cascada)
    espacio = area_ancho / n
    ancho_barra = espacio * 0.58

    y0 = y_de(0)
    d.add(Line(margen_izq, y0, ancho - margen_der, y0, strokeColor=GRIS_OSCURO, strokeWidth=0.6))

    for i, paso in enumerate(cascada):
        desde, hasta = paso["rango"]
        x = margen_izq + i * espacio + (espacio - ancho_barra) / 2
        y_abajo = y_de(min(desde, hasta))
        y_arriba = y_de(max(desde, hasta))
        altura = max(y_arriba - y_abajo, 1.2)

        d.add(Rect(x, y_abajo, ancho_barra, altura, fillColor=_color_paso_cascada(paso), strokeColor=None))

        etiqueta_valor = formato_moneda_corta(paso["valor"])
        # Siempre arriba del borde superior de la barra: evita que la etiqueta
        # de un paso negativo (barra "colgando" cerca del cero) se pise con
        # el nombre del paso en el eje x, de abajo.
        y_etiqueta = y_arriba + 4
        d.add(
            String(
                x + ancho_barra / 2,
                y_etiqueta,
                etiqueta_valor,
                fontName="Marca-Bold",
                fontSize=6.5,
                fillColor=NEGRO,
                textAnchor="middle",
            )
        )

        nombre = ETIQUETAS_CORTAS_CASCADA.get(paso["nombre"], paso["nombre"])
        d.add(
            String(
                x + ancho_barra / 2,
                margen_inf - 12,
                nombre,
                fontName="Marca",
                fontSize=6.5,
                fillColor=GRIS_OSCURO,
                textAnchor="middle",
            )
        )

    return d


def _grafico_donut(datos: list[dict], ancho: float = 250) -> Drawing:
    """Pie con hueco en el centro (donut manual: círculo blanco encima) + leyenda con % a la derecha."""
    if not datos:
        return Drawing(ancho, 1)

    radio = 65
    alto = max(radio * 2 + 20, len(datos[:7]) * 15 + 20)
    d = Drawing(ancho, alto)
    cx, cy = 15 + radio, alto / 2

    pie = Pie()
    pie.x = cx - radio
    pie.y = cy - radio
    pie.width = radio * 2
    pie.height = radio * 2
    pie.data = [max(item["monto"], 0.0001) for item in datos]
    pie.labels = None
    pie.slices.strokeWidth = 1
    pie.slices.strokeColor = BLANCO
    for i in range(len(datos)):
        pie.slices[i].fillColor = COLORES_TORTA[i % len(COLORES_TORTA)]
    d.add(pie)
    d.add(Circle(cx, cy, radio * 0.55, fillColor=BLANCO, strokeColor=None))

    total = sum(item["monto"] for item in datos) or 1
    lx = cx + radio + 18
    ly = alto - 12
    for i, item in enumerate(datos[:7]):
        d.add(Rect(lx, ly - 6, 8, 8, fillColor=COLORES_TORTA[i % len(COLORES_TORTA)], strokeColor=None))
        pct = item["monto"] / total * 100
        texto = f"{_truncar(item['nombre'], 20)} · {pct:.0f}%"
        d.add(String(lx + 12, ly - 5, texto, fontName="Marca", fontSize=7.5, fillColor=NEGRO))
        ly -= 15
        if ly < 12:
            break

    return d


def _grafico_barras_horizontal(
    datos: list[dict], campo_nombre: str, campo_valor: str, color, ancho: float = 470
) -> Drawing:
    """Ranking horizontal (top proveedores, egresos por fase). El primero de `datos` queda arriba."""
    n = len(datos)
    alto = max(n * 24 + 40, 90)
    d = Drawing(ancho, alto)
    if n == 0:
        return d

    ordenados = list(
        reversed(datos)
    )  # reportlab dibuja el índice 0 abajo -> invertimos para que el 1° quede arriba

    bc = HorizontalBarChart()
    bc.x = 110
    bc.y = 15
    bc.height = alto - 35
    bc.width = ancho - 110 - 55
    bc.data = [[item[campo_valor] for item in ordenados]]
    bc.categoryAxis.categoryNames = [_truncar(item[campo_nombre], 18) for item in ordenados]
    bc.categoryAxis.labels.fontName = "Marca"
    bc.categoryAxis.labels.fontSize = 7.5
    bc.valueAxis.valueMin = 0
    bc.valueAxis.labels.fontName = "Marca"
    bc.valueAxis.labels.fontSize = 7
    bc.valueAxis.labelTextFormat = formato_moneda_corta
    bc.bars[0].fillColor = color
    bc.barLabels.fontName = "Marca"
    bc.barLabels.fontSize = 7
    bc.barLabelFormat = formato_moneda_corta
    bc.barLabels.nudge = 8
    d.add(bc)
    return d


def _grafico_notas(notas: dict, ancho: float = 260, alto: float = 190) -> Drawing:
    """Barras agrupadas: Compras / Cobros, cada una con crédito (rojo) y débito (naranja)."""
    d = Drawing(ancho, alto)

    vc = VerticalBarChart()
    vc.x = 45
    vc.y = 35
    vc.height = alto - 60
    vc.width = ancho - 65
    vc.data = [
        (notas["compras"]["credito"], notas["cobros"]["credito"]),
        (notas["compras"]["debito"], notas["cobros"]["debito"]),
    ]
    vc.categoryAxis.categoryNames = ["Compras", "Cobros"]
    vc.categoryAxis.labels.fontName = "Marca"
    vc.categoryAxis.labels.fontSize = 8
    vc.valueAxis.valueMin = 0
    vc.valueAxis.labels.fontName = "Marca"
    vc.valueAxis.labels.fontSize = 6.5
    vc.valueAxis.labelTextFormat = formato_moneda_corta
    vc.bars[0].fillColor = ROJO
    vc.bars[1].fillColor = NARANJA
    vc.groupSpacing = 12
    d.add(vc)

    # Leyenda manual.
    d.add(Rect(ancho - 10, alto - 15, 8, 8, fillColor=ROJO, strokeColor=None))
    d.add(
        String(
            ancho - 18, alto - 16, "Crédito", fontName="Marca", fontSize=7, fillColor=NEGRO, textAnchor="end"
        )
    )
    d.add(Rect(ancho - 10, alto - 28, 8, 8, fillColor=NARANJA, strokeColor=None))
    d.add(
        String(
            ancho - 18, alto - 29, "Débito", fontName="Marca", fontSize=7, fillColor=NEGRO, textAnchor="end"
        )
    )

    return d


# ---------------------------------------------------------------------------
# Tablas
# ---------------------------------------------------------------------------


def _tabla_totales(analisis: dict) -> Table:
    t = analisis["totales"]
    filas = [
        ["Precio acordado", formato_moneda(t["precioAcordado"])],
        ["Cobrado (neto de notas)", formato_moneda(t["cobrado"])],
        ["Gastado (compras + gastos, neto de notas)", formato_moneda(t["egresos"])],
        ["Margen bruto", formato_moneda(t["margenBruto"])],
        ["Ganancia neta / disponible", formato_moneda(t["disponible"])],
        ["% cobrado del acordado", formato_pct(t["pctCobrado"])],
        ["% gastado del acordado", formato_pct(t["pctGastado"])],
    ]
    tabla = Table(filas, colWidths=[110 * mm, 60 * mm])
    tabla.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "Marca"),
                ("FONTNAME", (0, 4), (-1, 4), "Marca-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("TEXTCOLOR", (0, 0), (-1, -1), NEGRO),
                ("LINEBELOW", (0, 0), (-1, -2), 0.5, GRIS_CLARO),
                ("LINEABOVE", (0, 4), (-1, 4), 0.75, OLIVA),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return tabla


def _tabla_notas(analisis: dict) -> Table:
    n = analisis["notas"]
    filas = [
        ["", "Nota de crédito", "Nota de débito", "Cantidad"],
        [
            "Compras (proveedores)",
            formato_moneda(n["compras"]["credito"]),
            formato_moneda(n["compras"]["debito"]),
            str(n["compras"]["cantidad"]),
        ],
        [
            "Cobros (cliente)",
            formato_moneda(n["cobros"]["credito"]),
            formato_moneda(n["cobros"]["debito"]),
            str(n["cobros"]["cantidad"]),
        ],
    ]
    tabla = Table(filas, colWidths=[55 * mm, 35 * mm, 35 * mm, 25 * mm])
    tabla.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Marca-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Marca"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("TEXTCOLOR", (0, 0), (-1, 0), BLANCO),
                ("BACKGROUND", (0, 0), (-1, 0), GRIS_OSCURO),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BLANCO, GRIS_CLARO]),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return tabla


def _tabla_fases(analisis: dict) -> Table | None:
    fases = analisis["fases"]
    if not fases:
        return None
    filas = [["Fase", "Estado", "Gastado", "% presup."]]
    for f in fases:
        filas.append(
            [f["nombre"], f["estado"], formato_moneda(f["gastado"]), formato_pct(f["pct_presupuesto"])]
        )
    tabla = Table(filas, colWidths=[60 * mm, 40 * mm, 40 * mm, 30 * mm])
    tabla.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Marca-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Marca"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("TEXTCOLOR", (0, 0), (-1, 0), BLANCO),
                ("BACKGROUND", (0, 0), (-1, 0), OLIVA),
                ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [BLANCO, GRIS_CLARO]),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return tabla


def _tabla_deuda(analisis: dict) -> Table | None:
    deuda = analisis["deuda_por_proveedor"]
    if not deuda:
        return None
    filas = [["Proveedor", "Compras pendientes", "Monto adeudado"]]
    for d in deuda:
        filas.append([d["proveedor"], str(d["compras"]), formato_moneda(d["monto"])])
    filas.append(["Total", "", formato_moneda(analisis["deuda_total"])])
    tabla = Table(filas, colWidths=[80 * mm, 40 * mm, 50 * mm])
    ultima = len(filas) - 1
    tabla.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, 0), "Marca-Bold"),
                ("FONTNAME", (0, 1), (-1, -1), "Marca"),
                ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                ("TEXTCOLOR", (0, 0), (-1, 0), BLANCO),
                ("BACKGROUND", (0, 0), (-1, 0), ROJO),
                ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
                ("ROWBACKGROUNDS", (0, 1), (-1, ultima - 1), [BLANCO, GRIS_CLARO]),
                ("FONTNAME", (0, ultima), (-1, ultima), "Marca-Bold"),
                ("LINEABOVE", (0, ultima), (-1, ultima), 1, ROJO),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    return tabla


def _header_footer(canvas, doc, proyecto_nombre: str):
    canvas.saveState()
    ancho, alto = A4

    canvas.setFillColor(OLIVA)
    canvas.rect(0, alto - 8 * mm, ancho, 8 * mm, fill=1, stroke=0)

    logo_path = MARCA / "logo_negro.png"
    if logo_path.exists():
        try:
            img = ImageReader(str(logo_path))
            iw, ih = img.getSize()
            alto_logo = 9 * mm
            ancho_logo = alto_logo * (iw / ih)
            canvas.drawImage(img, 20 * mm, alto - 22 * mm, width=ancho_logo, height=alto_logo, mask="auto")
        except Exception:
            pass

    canvas.setFont("Marca", 7.5)
    canvas.setFillColor(GRIS_OSCURO)
    canvas.drawString(20 * mm, 12 * mm, "Home Solutions · ventas@homesolutions.ar · www.homesolutions.ar")
    canvas.drawRightString(ancho - 20 * mm, 12 * mm, f"Página {doc.page}")
    canvas.drawString(
        20 * mm,
        8 * mm,
        f"Reporte de {proyecto_nombre} · generado el {datetime.now().strftime('%d/%m/%Y %H:%M')}",
    )

    canvas.restoreState()


def generar_pdf_proyecto(
    proyecto, fases: list, gastos: list, cobros: list, compras: list, analisis: dict
) -> bytes:
    """Arma el PDF de reporte y devuelve los bytes (para servir como Response)."""
    estilos = _estilos()
    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        topMargin=30 * mm,
        bottomMargin=20 * mm,
        leftMargin=20 * mm,
        rightMargin=20 * mm,
        title=f"Reporte - {proyecto.nombre}",
    )

    story = []

    story.append(Paragraph(proyecto.nombre, estilos["titulo"]))
    story.append(
        Paragraph(
            f"{proyecto.direccion} · Inicio: {formato_fecha(proyecto.fecha_inicio)} · "
            f"Estado: {proyecto.estado.replace('_', ' ').capitalize()}",
            estilos["subtitulo"],
        )
    )
    story.append(Spacer(1, 10))

    # --- Resumen ejecutivo: unas frases armadas de los números, antes de cualquier tabla. ---
    story.append(Paragraph("Resumen ejecutivo", estilos["seccion"]))
    for frase in analisis["resumen_ejecutivo"]:
        story.append(Paragraph(f"•  {frase}", estilos["resumen_item"]))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Resumen financiero", estilos["seccion"]))
    story.append(_tabla_totales(analisis))

    story.append(Paragraph("Cascada de rentabilidad", estilos["seccion"]))
    story.append(_grafico_cascada(analisis["cascada"]))

    story.append(Paragraph("Notas de crédito / débito", estilos["seccion"]))
    story.append(_grafico_notas(analisis["notas"]))
    story.append(Spacer(1, 6))
    story.append(_tabla_notas(analisis))

    if analisis["gastos_por_categoria"] or analisis["impuestos_por_tipo"]:
        story.append(Paragraph("Gastos e impuestos", estilos["seccion"]))
        celdas = []
        if analisis["gastos_por_categoria"]:
            celdas.append(
                [
                    Paragraph("Gastos por categoría", estilos["subseccion"]),
                    _grafico_donut(analisis["gastos_por_categoria"]),
                ]
            )
        if analisis["impuestos_por_tipo"]:
            celdas.append(
                [
                    Paragraph("Impuestos por tipo", estilos["subseccion"]),
                    _grafico_donut(analisis["impuestos_por_tipo"]),
                ]
            )
        for titulo, grafico in celdas:
            story.append(titulo)
            story.append(grafico)

    if analisis["top_proveedores"]:
        story.append(Paragraph("Top proveedores", estilos["seccion"]))
        story.append(_grafico_barras_horizontal(analisis["top_proveedores"], "nombre", "monto", OLIVA))

    if analisis["egresos_por_fase"]:
        story.append(Paragraph("Egresos por fase", estilos["seccion"]))
        story.append(_grafico_barras_horizontal(analisis["egresos_por_fase"], "nombre", "gastado", AZUL))

    tabla_fases = _tabla_fases(analisis)
    story.append(Paragraph("Estado de las fases", estilos["seccion"]))
    if tabla_fases:
        story.append(tabla_fases)
    else:
        story.append(Paragraph("Este proyecto todavía no tiene fases cargadas.", estilos["vacio"]))

    tabla_deuda = _tabla_deuda(analisis)
    story.append(Paragraph("Deuda pendiente a proveedores", estilos["seccion"]))
    if tabla_deuda:
        story.append(tabla_deuda)
    else:
        story.append(Paragraph("No hay compras pendientes de pago.", estilos["vacio"]))

    def _con_header_footer(canvas, doc_):
        _header_footer(canvas, doc_, proyecto.nombre)

    doc.build(story, onFirstPage=_con_header_footer, onLaterPages=_con_header_footer)

    return buffer.getvalue()
