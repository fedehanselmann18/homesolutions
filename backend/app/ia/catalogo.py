"""
Lectura automática de catálogos de proveedor (lista de precios en Excel/CSV,
PDF o foto) con Gemini.

Mismo espíritu que extractor.py: no guarda nada, solo lee el archivo que el
usuario acaba de elegir en ModalImportarCatalogo (todavía sin confirmar) y
devuelve una vista previa para que el usuario revise y confirme fila por
fila. La creación/actualización real de proveedor y productos la hace el
front después, llamando a los endpoints normales de proveedores/productos
(ver routes/ia.py).

Excel/CSV se parsean primero a una tabla de texto plano (pandas) y ESE texto
se le manda a Gemini como parte del prompt -- así hay un solo camino de
código (prompt + parseo de la respuesta) tanto para planillas como para
fotos/PDF, en vez de mantener dos extractores distintos. Para imagen/PDF se
manda el archivo tal cual, igual que en extractor.py.
"""

import io
import json
import logging
import re

import pandas as pd
from google import genai
from google.genai import types

from app.config import settings
from app.schemas import IALecturaCatalogo

logger = logging.getLogger(__name__)

MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MIME_CSV = "text/csv"
MIME_TIPOS_TABULARES = {MIME_XLSX, MIME_CSV}

TIPOS_PRODUCTO_VALIDOS = ["equipo", "materiales", "mano_obra"]


class LecturaCatalogoError(Exception):
    """Gemini no pudo leer el archivo, no está configurado, o devolvió algo no usable."""


def _cliente() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise LecturaCatalogoError("Falta configurar GEMINI_API_KEY en el .env del backend.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


def _bytes_a_texto_tabular(archivo_bytes: bytes, mime_type: str) -> str:
    """
    dtype=str + keep_default_na=False: si no, pandas "mejora" los datos por
    su cuenta (números a float con ceros de más, celdas vacías a "nan" como
    texto) y eso confunde más a la IA de lo que ayuda -- mejor mandarle
    exactamente lo que dice cada celda.
    """
    buffer = io.BytesIO(archivo_bytes)
    if mime_type == MIME_CSV:
        df = pd.read_csv(buffer, dtype=str, keep_default_na=False)
    else:
        df = pd.read_excel(buffer, dtype=str, keep_default_na=False)
    return df.to_csv(index=False)


def _armar_prompt(proveedor_id: str | None, contexto: dict, es_tabular: bool) -> str:
    partes = [
        "Sos un asistente que lee catálogos / listas de precios de "
        "proveedores de una empresa de reformas/construcción en Argentina. "
        "Te paso "
        + ("una tabla en texto plano (formato CSV)" if es_tabular else "un archivo (imagen o PDF)")
        + " con el catálogo de un proveedor.",
        "Extraé SOLO los campos que te pido abajo. Si no podés leer un dato "
        "con confianza, dejalo en null y contá el motivo en 'advertencias' "
        "en vez de inventarlo.",
    ]

    if proveedor_id is None:
        proveedores = contexto.get("proveedores") or []
        listado = "\n".join(f"- nombre={p['nombre']} | cuit={p.get('cuit', '')}" for p in proveedores)
        partes.append(
            "proveedor: intentá leer, del encabezado o pie del documento, "
            "quién emite este catálogo. Devolvé un objeto "
            '{"nombre":.., "cuit":.., "telefono":.., "email":..} con lo que '
            "puedas leer (lo que no puedas leer, dejalo null). No hace falta "
            "que coincida con ninguno de esta lista -- es solo para "
            f"identificarlo, la comparación la hacemos nosotros después:\n"
            f"{listado or '(sin proveedores cargados)'}"
        )

    categorias = contexto.get("categorias") or []
    listado_categorias = "\n".join(
        f"- id={c['id']} | nombre={c['nombre']} | tipo={c['tipo']}" for c in categorias
    )

    partes.append(
        "productos: una lista de TODAS las líneas de producto que reconozcas "
        "en el catálogo, cada una como un objeto "
        '{"marca":.., "modelo":.., "tipo":.., "precio":.., "categoria_ids":[..]}. '
        "marca y modelo son obligatorios -- si una línea no tiene los dos, no "
        "la incluyas. tipo tiene que ser EXACTAMENTE uno de estos valores: "
        f"{', '.join(TIPOS_PRODUCTO_VALIDOS)} (si no podés determinarlo con "
        "confianza, dejalo null, no adivines). precio es el precio de "
        "venta/lista, como número (sin '$' ni puntos de miles). No inventes "
        "filas que no estén en el documento."
    )
    partes.append(
        "categoria_ids: para cada línea de producto, 0 o más ids EXACTOS de "
        "esta lista de categorías que describan bien ese producto -- "
        "fijate SOLO en las categorías cuyo tipo coincida con el tipo que le "
        "asignaste a esa línea (no sugieras una categoría de tipo materiales "
        "para un producto que marcaste como equipo). Si ninguna categoría de "
        "la lista aplica bien, o no estás seguro, devolvé lista vacía -- no "
        f"inventes una categoría que no esté acá:\n"
        f"{listado_categorias or '(sin categorías cargadas)'}"
    )

    return "\n\n".join(partes)


def leer_catalogo(
    archivo_bytes: bytes, mime_type: str, proveedor_id: str | None, contexto: dict
) -> IALecturaCatalogo:
    cliente = _cliente()
    es_tabular = mime_type in MIME_TIPOS_TABULARES
    prompt = _armar_prompt(proveedor_id, contexto, es_tabular)

    if es_tabular:
        try:
            texto_tabular = _bytes_a_texto_tabular(archivo_bytes, mime_type)
        except Exception as exc:  # noqa: BLE001 -- archivo corrupto o con un formato que pandas no puede leer
            raise LecturaCatalogoError(
                "No se pudo leer el archivo, revisá que sea un Excel o CSV válido."
            ) from exc
        contenido = [f"{prompt}\n\nContenido del archivo:\n{texto_tabular}"]
    else:
        contenido = [types.Part.from_bytes(data=archivo_bytes, mime_type=mime_type), prompt]

    try:
        respuesta = cliente.models.generate_content(
            model=settings.GEMINI_MODEL,
            contents=contenido,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0,
            ),
        )
    except Exception as exc:  # noqa: BLE001 -- cualquier falla de red/API se traduce a un mensaje entendible
        logger.exception("Error llamando a Gemini para leer catálogo")
        raise LecturaCatalogoError("No se pudo leer el catálogo con IA, probá de nuevo.") from exc

    try:
        datos = json.loads(respuesta.text)
    except (json.JSONDecodeError, TypeError) as exc:
        raise LecturaCatalogoError("La IA no devolvió un resultado legible.") from exc

    return _validar_y_limpiar(datos, proveedor_id, contexto)


def _normalizar(texto: str | None) -> str:
    """Comparación laxa: minúsculas, sin puntuación, espacios colapsados --
    para que "Griferías S.A." matchee con "griferias sa"."""
    if not texto:
        return ""
    texto = texto.strip().lower()
    texto = re.sub(r"[^\w\s]", "", texto)
    return re.sub(r"\s+", " ", texto).strip()


def _match_proveedor(datos_proveedor: dict, proveedores: list[dict]) -> dict | None:
    nombre = _normalizar(datos_proveedor.get("nombre"))
    cuit = _normalizar(datos_proveedor.get("cuit"))
    if not nombre and not cuit:
        return None
    for p in proveedores:
        if nombre and _normalizar(p.get("nombre")) == nombre:
            return p
        if cuit and _normalizar(p.get("cuit")) == cuit:
            return p
    return None


def _resolver_proveedor_sugerido(datos: dict, contexto: dict, advertencias: list[str]) -> dict:
    crudo = datos.get("proveedor")
    if not isinstance(crudo, dict):
        crudo = {}

    match = _match_proveedor(crudo, contexto.get("proveedores") or [])
    if match:
        return {"tipo": "existente", "id": match["id"], "nombre": match["nombre"]}

    if not crudo.get("nombre") and not crudo.get("cuit"):
        advertencias.append("No pude leer quién es el proveedor de este catálogo, completalo a mano.")

    return {
        "tipo": "nuevo",
        "nombre": crudo.get("nombre"),
        "cuit": crudo.get("cuit"),
        "telefono": crudo.get("telefono"),
        "email": crudo.get("email"),
    }


def _limpiar_categoria_ids(linea: dict, tipo: str | None, contexto: dict, advertencias: list[str]) -> list:
    """
    Igual criterio que el resto del archivo: un id que no está en el
    catálogo de categorías, o que sí está pero es de otro tipo (ej. la IA
    sugirió una categoría de "materiales" para un producto "equipo"), se
    descarta con advertencia en vez de guardarse -- nunca se inventa ni se
    fuerza una categoría que no aplica. Sin tipo resuelto no hay filtro por
    tipo posible, así que directamente no tiene sentido sugerir categoría.
    """
    if tipo is None:
        return []

    crudo = linea.get("categoria_ids")
    if not isinstance(crudo, list) or not crudo:
        return []

    categorias_por_id = {str(c["id"]): c for c in (contexto.get("categorias") or [])}
    marca, modelo = linea.get("marca"), linea.get("modelo")

    limpio = []
    for categoria_id in crudo:
        categoria = categorias_por_id.get(str(categoria_id))
        if categoria is None or categoria["tipo"] != tipo:
            advertencias.append(
                f"La IA sugirió una categoría que no existe, revisá la categoría de {marca} {modelo} a mano."
            )
            continue
        limpio.append(categoria_id)

    return limpio


def _limpiar_productos(datos: dict, contexto: dict, advertencias: list[str]) -> list[dict]:
    """
    Cada línea se descarta (sin tirar la lectura entera) si le falta
    marca/modelo o el precio no es un número positivo -- eso lo dice
    _validar_y_limpiar en advertencias en vez de guardar basura. El resto se
    clasifica contra el catálogo actual del proveedor (contexto.productos,
    solo viene si el front ya mandó un proveedor_id fijo) por marca+modelo
    normalizado.
    """
    crudo = datos.get("productos") or []
    if not isinstance(crudo, list):
        return []

    catalogo_actual = {
        (_normalizar(p["marca"]), _normalizar(p["modelo"])): p for p in (contexto.get("productos") or [])
    }

    limpio = []
    for linea in crudo:
        if not isinstance(linea, dict):
            continue

        marca = linea.get("marca")
        modelo = linea.get("modelo")
        if not marca or not modelo:
            advertencias.append("Descarté una línea del catálogo sin marca o modelo.")
            continue

        try:
            precio = float(linea.get("precio"))
        except (TypeError, ValueError):
            advertencias.append(f"No pude leer el precio de {marca} {modelo}, revisalo a mano.")
            continue
        if precio <= 0:
            advertencias.append(f"El precio de {marca} {modelo} no es válido, revisalo a mano.")
            continue

        tipo = linea.get("tipo")
        if tipo not in TIPOS_PRODUCTO_VALIDOS:
            if tipo is not None:
                advertencias.append(f"No reconocí el tipo de {marca} {modelo}, elegilo a mano.")
            tipo = None

        categoria_ids = _limpiar_categoria_ids(linea, tipo, contexto, advertencias)

        existente = catalogo_actual.get((_normalizar(marca), _normalizar(modelo)))
        if existente is None:
            estado, producto_id, precio_actual = "nuevo", None, None
        elif float(existente["precio"]) == precio:
            estado, producto_id, precio_actual = "sin_cambios", existente["id"], existente["precio"]
        else:
            estado, producto_id, precio_actual = "actualiza_precio", existente["id"], existente["precio"]

        limpio.append(
            {
                "marca": marca,
                "modelo": modelo,
                "tipo": tipo,
                "precio": precio,
                "estado": estado,
                "producto_id": producto_id,
                "precio_actual": precio_actual,
                # Solo tiene sentido sugerir categoría para algo que se va a
                # crear -- un producto que ya existía (actualiza_precio/
                # sin_cambios) ya tiene la suya, no se toca desde acá.
                "categoria_ids": categoria_ids if estado == "nuevo" else [],
            }
        )

    return limpio


def _validar_y_limpiar(datos: dict, proveedor_id: str | None, contexto: dict) -> IALecturaCatalogo:
    """
    Nunca confiar a ciegas en lo que devuelve el modelo: un proveedor
    sugerido que no matchea ninguno real se ofrece como "nuevo" en vez de
    inventarle un id, y cada producto se descarta a advertencia en vez de
    guardarse con un precio o tipo inválido.
    """
    advertencias = list(datos.get("advertencias") or [])

    proveedor_sugerido = (
        _resolver_proveedor_sugerido(datos, contexto, advertencias) if proveedor_id is None else None
    )

    return IALecturaCatalogo(
        proveedor_sugerido=proveedor_sugerido,
        productos=_limpiar_productos(datos, contexto, advertencias),
        advertencias=advertencias,
    )
