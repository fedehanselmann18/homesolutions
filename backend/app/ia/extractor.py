"""
Lectura automática de comprobantes (factura/remito/recibo) con Gemini.

No guarda nada en la base ni en disco: recibe los bytes del archivo que el
usuario ya arrastró al ComprobantesUploader (todavía sin confirmar el
submit), le pide a Gemini que lo lea, y devuelve campos sueltos para
prellenar ModalGasto/ModalCompra/ModalCobro. El usuario SIEMPRE revisa y
confirma con el submit normal del formulario antes de que se guarde nada
(ver routes/ia.py).

Compra NO pide "monto": precio_neto se calcula solo a partir del detalle de
productos (cantidad x precio de catálogo), nunca se tipea a mano -- ver el
comentario en ModalCompra.jsx. La IA SÍ puede sugerir líneas de detalle
(producto_id + cantidad), pero SOLO si el producto pertenece al proveedor
que la misma extracción resolvió -- precio_unitario nunca sale de la
factura, sigue siendo el precio de catálogo (ver IADetalleSugerido en
schemas.py). Si el proveedor no matcheó, no tiene sentido sugerir productos
(no sabríamos de qué proveedor son), así que se descartan todos.
"""

import json
import logging

from google import genai
from google.genai import types

from app.config import settings
from app.schemas import IAExtraccionComprobante

logger = logging.getLogger(__name__)

TIPOS_FACTURA_VALIDOS = ["factura_a", "factura_b", "factura_c", "remito", "recibo", "otros"]

# Qué campos tiene sentido pedirle a la IA según qué formulario se está
# completando. Cobro no tiene fase/categoría/proveedor (Cobro no los tiene
# en el modelo); Compra no tiene "monto" (ver docstring de arriba).
CAMPOS_POR_ENTIDAD = {
    "gasto": {"monto", "fecha", "tipo_factura", "descripcion", "categoria_gasto_id", "fase_id"},
    "compra": {"fecha", "tipo_factura", "descripcion", "proveedor_id", "fase_id", "detalle", "impuestos"},
    "cobro": {"monto", "fecha", "tipo_factura", "descripcion"},
}


class ExtraccionIAError(Exception):
    """Gemini no pudo leer el archivo, no está configurado, o devolvió algo no usable."""


def _cliente() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise ExtraccionIAError("Falta configurar GEMINI_API_KEY en el .env del backend.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _armar_prompt(tipo_entidad: str, contexto: dict) -> str:
    campos = CAMPOS_POR_ENTIDAD[tipo_entidad]
    partes = [
        "Sos un asistente que lee comprobantes de gastos de una empresa de "
        "reformas/construcción en Argentina (facturas, remitos, recibos). "
        "Te paso un archivo (imagen o PDF) de un comprobante.",
        "Extraé SOLO los campos que te pido abajo. Si no podés leer un dato "
        "con confianza, dejalo en null y contá el motivo en 'advertencias' "
        "en vez de inventarlo.",
        "tipo_factura tiene que ser EXACTAMENTE uno de estos valores: "
        f"{', '.join(TIPOS_FACTURA_VALIDOS)} (mirá qué letra tiene arriba la "
        "factura para elegir entre factura_a/factura_b/factura_c; si es un "
        "remito o un recibo usá esa palabra; si no es ninguna de esas, 'otros').",
    ]

    if "monto" in campos:
        partes.append(
            "monto: el importe TOTAL final del comprobante, como número (sin '$' ni puntos de miles)."
        )
    if "fecha" in campos:
        partes.append("fecha: la fecha de emisión del comprobante, en formato YYYY-MM-DD.")
    if "descripcion" in campos:
        partes.append(
            "descripcion: un texto corto (una línea) que resuma de qué es -- "
            "proveedor/emisor + concepto principal."
        )

    if "proveedor_id" in campos:
        proveedores = contexto.get("proveedores") or []
        listado = "\n".join(
            f"- id={p['id']} | nombre={p['nombre']} | cuit={p.get('cuit', '')}" for p in proveedores
        )
        partes.append(
            "proveedor_id: si el nombre o CUIT que figura en el comprobante "
            "coincide con alguno de esta lista, devolvé ESE id EXACTO tal "
            "cual está escrito (si ninguno coincide con confianza, null):\n"
            f"{listado or '(sin proveedores cargados)'}"
        )

    if "categoria_gasto_id" in campos:
        categorias = contexto.get("categorias_gasto") or []
        listado = "\n".join(f"- id={c['id']} | nombre={c['nombre']}" for c in categorias)
        partes.append(
            "categoria_gasto_id: elegí, de esta lista, la categoría que mejor "
            "describe el gasto (si ninguna encaja bien, null). Devolvé el id "
            f"EXACTO tal cual está escrito:\n{listado or '(sin categorías cargadas)'}"
        )

    if "fase_id" in campos:
        fases = contexto.get("fases") or []
        listado = "\n".join(f"- id={f['id']} | nombre={f['nombre']}" for f in fases)
        partes.append(
            "fase_id: SOLO si el comprobante menciona algo que lo asocie "
            "claramente a una de estas fases del proyecto, devolvé ese id "
            "EXACTO (si no hay ninguna pista clara, null -- no adivines):\n"
            f"{listado or '(sin fases cargadas)'}"
        )

    if "impuestos" in campos:
        impuestos_catalogo = contexto.get("impuestos") or []
        listado = "\n".join(f"- id={i['id']} | nombre={i['nombre']}" for i in impuestos_catalogo)
        partes.append(
            "impuestos: si el comprobante desglosa IVA, percepciones, "
            "retenciones u otros impuestos como líneas separadas del neto, "
            'devolvé una lista de objetos {"impuesto_id": <id EXACTO de la '
            'lista>, "monto": <importe en pesos, tal cual figura>} -- el '
            "monto SÍ tiene que ser el que dice el comprobante (no lo "
            "inventes ni lo calcules). Si un impuesto del comprobante no "
            "coincide con ninguno de esta lista, omitilo (no inventes un id). "
            f"Si el comprobante no desglosa impuestos, devolvé lista vacía:\n"
            f"{listado or '(sin impuestos cargados)'}"
        )

    if "detalle" in campos:
        productos = contexto.get("productos") or []
        listado = "\n".join(
            f"- id={p['id']} | marca={p['marca']} | modelo={p['modelo']} | proveedor_id={p['proveedor_id']}"
            for p in productos
        )
        partes.append(
            "detalle: si podés reconocer, en las líneas del comprobante, "
            "productos que coincidan con marca+modelo de esta lista, devolvé "
            'una lista de objetos {"producto_id": <id EXACTO>, "cantidad": <número>} '
            "-- SOLO para productos que pertenezcan al MISMO proveedor que "
            "identificaste en proveedor_id (fijate que el proveedor_id de cada "
            "producto coincida). Si no reconocés ningún producto de esa lista, "
            "o no estás seguro de a qué proveedor pertenecen, devolvé una lista "
            f"vacía -- no inventes productos que no estén acá:\n{listado or '(sin productos cargados)'}"
        )

    return "\n\n".join(partes)


def extraer_comprobante(
    archivo_bytes: bytes, mime_type: str, tipo_entidad: str, contexto: dict
) -> IAExtraccionComprobante:
    if tipo_entidad not in CAMPOS_POR_ENTIDAD:
        raise ExtraccionIAError(f"tipo_entidad inválido: {tipo_entidad}")

    cliente = _cliente()
    prompt = _armar_prompt(tipo_entidad, contexto)

    try:
        respuesta = cliente.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=archivo_bytes, mime_type=mime_type),
                prompt,
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0,
            ),
        )
    except Exception as exc:  # noqa: BLE001 -- cualquier falla de red/API se traduce a un mensaje entendible
        logger.exception("Error llamando a Gemini para extraer comprobante")
        raise ExtraccionIAError("No se pudo leer el comprobante con IA, probá de nuevo.") from exc

    try:
        datos = json.loads(respuesta.text)
    except (json.JSONDecodeError, TypeError) as exc:
        raise ExtraccionIAError("La IA no devolvió un resultado legible.") from exc

    return _validar_y_limpiar(datos, tipo_entidad, contexto)


def _ids_validos(contexto: dict, clave: str) -> set[str]:
    return {str(item["id"]) for item in (contexto.get(clave) or [])}


def _proveedor_por_producto(contexto: dict) -> dict[str, str]:
    return {str(p["id"]): str(p["proveedor_id"]) for p in (contexto.get("productos") or [])}


def _limpiar_detalle(datos: dict, contexto: dict, proveedor_id, advertencias: list[str]) -> list[dict]:
    """
    Cada línea sugerida se descarta (sin tirar la extracción entera) si:
    - el producto_id no está en el catálogo que mandó el front,
    - no pertenece al proveedor ya resuelto (o no hay proveedor resuelto),
    - o la cantidad no es un número positivo.
    precio_unitario NUNCA sale de acá -- eso lo pone el front con el precio
    de catálogo del producto, igual que si lo eligieras a mano.
    """
    crudo = datos.get("detalle") or []
    if not isinstance(crudo, list):
        return []

    if proveedor_id is None:
        if crudo:
            advertencias.append(
                "La IA sugirió productos pero no pude confirmar el proveedor, así que los descarté -- cargalos a mano."
            )
        return []

    proveedor_por_producto = _proveedor_por_producto(contexto)
    limpio = []
    for linea in crudo:
        if not isinstance(linea, dict):
            continue
        producto_id = linea.get("producto_id")
        cantidad = linea.get("cantidad")
        if producto_id is None or str(producto_id) not in proveedor_por_producto:
            advertencias.append(
                "La IA sugirió un producto que no está en tu catálogo, revisá el detalle a mano."
            )
            continue
        if proveedor_por_producto[str(producto_id)] != str(proveedor_id):
            advertencias.append("La IA sugirió un producto de otro proveedor, se descartó esa línea.")
            continue
        try:
            cantidad = float(cantidad)
        except (TypeError, ValueError):
            advertencias.append("La IA no pudo leer bien una cantidad, revisá el detalle a mano.")
            continue
        if cantidad <= 0:
            continue
        limpio.append({"producto_id": producto_id, "cantidad": cantidad})

    return limpio


def _limpiar_impuestos(datos: dict, contexto: dict, advertencias: list[str]) -> list[dict]:
    """
    A diferencia de _limpiar_detalle, acá el monto SÍ viene de la factura
    (no hay precio de catálogo que lo reemplace) -- lo único que se valida
    es que el impuesto_id exista en el catálogo que mandó el front y que el
    monto sea un número positivo.
    """
    crudo = datos.get("impuestos") or []
    if not isinstance(crudo, list):
        return []

    ids_validos = _ids_validos(contexto, "impuestos")
    limpio = []
    for linea in crudo:
        if not isinstance(linea, dict):
            continue
        impuesto_id = linea.get("impuesto_id")
        monto = linea.get("monto")
        if impuesto_id is None or str(impuesto_id) not in ids_validos:
            advertencias.append("La IA sugirió un impuesto que no está en tu catálogo, revisá a mano.")
            continue
        try:
            monto = float(monto)
        except (TypeError, ValueError):
            advertencias.append("La IA no pudo leer bien un monto de impuesto, revisá a mano.")
            continue
        if monto <= 0:
            continue
        limpio.append({"impuesto_id": impuesto_id, "monto": monto})

    return limpio


def _validar_y_limpiar(datos: dict, tipo_entidad: str, contexto: dict) -> IAExtraccionComprobante:
    """
    Nunca confiar a ciegas en lo que devuelve el modelo: si sugirió un id que
    no está en el catálogo que le pasamos, se descarta a None y se avisa en
    'advertencias' -- mejor que el usuario elija a mano a que se guarde una
    referencia inventada.
    """
    advertencias = list(datos.get("advertencias") or [])
    campos = CAMPOS_POR_ENTIDAD[tipo_entidad]

    def limpiar_id(campo: str, clave_contexto: str, etiqueta: str):
        valor = datos.get(campo)
        if valor is None:
            return None
        if str(valor) not in _ids_validos(contexto, clave_contexto):
            advertencias.append(f"La IA sugirió un/a {etiqueta} que no está en tu lista, revisalo a mano.")
            return None
        return valor

    tipo_factura = datos.get("tipo_factura")
    if tipo_factura not in TIPOS_FACTURA_VALIDOS:
        if tipo_factura is not None:
            advertencias.append(f"No reconocí el tipo de factura '{tipo_factura}', elegilo a mano.")
        tipo_factura = None

    proveedor_id = (
        limpiar_id("proveedor_id", "proveedores", "proveedor") if "proveedor_id" in campos else None
    )

    resultado = {
        "monto": datos.get("monto") if "monto" in campos else None,
        "fecha": datos.get("fecha") if "fecha" in campos else None,
        "tipo_factura": tipo_factura,
        "descripcion": datos.get("descripcion") if "descripcion" in campos else None,
        "proveedor_id": proveedor_id,
        "fase_id": limpiar_id("fase_id", "fases", "fase") if "fase_id" in campos else None,
        "categoria_gasto_id": (
            limpiar_id("categoria_gasto_id", "categorias_gasto", "categoría")
            if "categoria_gasto_id" in campos
            else None
        ),
        "detalle": (
            _limpiar_detalle(datos, contexto, proveedor_id, advertencias) if "detalle" in campos else []
        ),
        "impuestos": _limpiar_impuestos(datos, contexto, advertencias) if "impuestos" in campos else [],
        "advertencias": advertencias,
    }
    return IAExtraccionComprobante(**resultado)
