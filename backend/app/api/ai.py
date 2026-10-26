import io
import json
import zipfile
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.ai.catalog import CatalogReadError, leer_catalogo
from app.ai.extractor import AIExtractionError, extraer_comprobante
from app.auth.oauth2 import requiere_admin
from app.core.app_settings import obtener_valor
from app.core.limiter import limiter
from app.db import models
from app.db.database import get_db
from app.domain.invoice_types import listar as listar_tipos_factura
from app.file_management.storage import contenido_coincide_con_extension, tamanio_de
from app.schemas import AICatalogReading, AIReceiptExtraction

router = APIRouter(prefix="/ia", tags=["ia"])

# Mismos límites que los comprobantes que ya se suben de verdad (ver
# file_management/storage.py) -- no tiene sentido aceptar acá algo que después el
# upload real de todos modos va a rechazar.
EXTENSIONES_PERMITIDAS = {".pdf", ".jpg", ".jpeg", ".png"}
MIME_POR_EXTENSION = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}
TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024  # 10MB

# Catálogo de proveedor: además de foto/PDF de una lista de precios, también
# se puede mandar la planilla tal cual (ver app/ai/catalog.py). Set/dict
# aparte -- extender los de arriba habilitaría .xlsx/.csv también en
# /extraer-comprobante, que no sabe qué hacer con eso.
EXTENSIONES_PERMITIDAS_CATALOGO = EXTENSIONES_PERMITIDAS | {".xlsx", ".csv"}
MIME_POR_EXTENSION_CATALOGO = {
    **MIME_POR_EXTENSION,
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
}


# Un .xlsx es un .zip: 10MB comprimidos pueden ser gigas al abrirlo (zip
# bomb), y pandas/openpyxl lo descomprimen entero en memoria. Ninguna lista
# de precios real se acerca a esto.
TAMANIO_MAXIMO_XLSX_DESCOMPRIMIDO = 50 * 1024 * 1024
ENTRADAS_MAXIMAS_XLSX = 1000


async def _leer_archivo_con_tope(archivo: UploadFile) -> bytes:
    """Rechaza por tamaño ANTES de leer (ver tamanio_de) y recién ahí lo carga."""
    if tamanio_de(archivo) > TAMANIO_MAXIMO_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera los 10MB")
    return await archivo.read()


def _validar_xlsx_descomprimido(contenido: bytes) -> None:
    """
    Mira el índice del zip sin descomprimir nada. Los tamaños del índice los
    escribe quien arma el archivo, pero zipfile (que es lo que usa openpyxl)
    no lee más de lo que declara cada entrada, así que son un tope real.
    """
    try:
        with zipfile.ZipFile(io.BytesIO(contenido)) as zip_xlsx:
            entradas = zip_xlsx.infolist()
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="El archivo no es un Excel válido")

    if (
        len(entradas) > ENTRADAS_MAXIMAS_XLSX
        or sum(entrada.file_size for entrada in entradas) > TAMANIO_MAXIMO_XLSX_DESCOMPRIMIDO
    ):
        raise HTTPException(
            status_code=400,
            detail="El Excel es demasiado grande para leerlo. Probá con una planilla más chica.",
        )


@router.post(
    "/extraer-comprobante",
    response_model=AIReceiptExtraction,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("20/hour")
async def extraer_comprobante_endpoint(
    request: Request,
    tipo_entidad: str = Form(...),
    contexto: str = Form("{}"),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    """
    Lee un comprobante (factura/remito/recibo) con IA y devuelve campos
    sueltos para prellenar ModalGasto/ModalCompra/ModalCobro.

    No guarda nada: ni el archivo, ni ningún registro en la base. El usuario
    sigue confirmando con el submit normal del formulario -- este endpoint
    solo ahorra tipeo, nunca decide por sí solo.

    tipo_entidad: "gasto" | "compra" | "cobro".
    contexto: JSON con los catálogos que el front ya tiene cargados (mismos
    que usa para los <select> del modal), para que la IA pueda sugerir un id
    real en vez de solo un nombre. Formato:
        {"fases": [{"id":.., "nombre":..}],
         "categorias_gasto": [{"id":.., "nombre":..}],
         "proveedores": [{"id":.., "nombre":.., "cuit":..}]}
    Cualquier clave ausente se trata como lista vacía.
    """
    if tipo_entidad not in ("gasto", "compra", "cobro"):
        raise HTTPException(status_code=400, detail="tipo_entidad inválido")

    ext = Path(archivo.filename or "").suffix.lower()
    if ext not in EXTENSIONES_PERMITIDAS:
        raise HTTPException(status_code=400, detail=f"Extensión no permitida: {ext}")

    contenido = await _leer_archivo_con_tope(archivo)
    if not contenido_coincide_con_extension(contenido, ext):
        raise HTTPException(status_code=400, detail="El contenido del archivo no coincide con su extensión")

    try:
        contexto_dict = json.loads(contexto)
    except json.JSONDecodeError:
        contexto_dict = {}

    try:
        return extraer_comprobante(
            archivo_bytes=contenido,
            mime_type=MIME_POR_EXTENSION[ext],
            tipo_entidad=tipo_entidad,
            contexto=contexto_dict,
            tipos_factura=[{"codigo": t.codigo, "nombre": t.nombre} for t in listar_tipos_factura(db)],
            # Editable desde Manager sin redeployar
            # -- ver app/core/app_settings.py para el fallback a Settings/.env.
            modelo=obtener_valor(db, "GEMINI_MODEL"),
        )
    except AIExtractionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/leer-catalogo",
    response_model=AICatalogReading,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("20/hour")
async def leer_catalogo_endpoint(
    request: Request,
    proveedor_id: str | None = Form(None),
    contexto: str = Form("{}"),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    """
    Lee un catálogo de proveedor (Excel/CSV, PDF, o foto de una lista de
    precios) con IA y devuelve una vista previa editable para
    ModalImportarCatalogo. No guarda nada: ni el archivo, ni ningún
    proveedor/producto en la base -- el usuario confirma fila por fila y
    recién ahí el front llama a los endpoints normales de
    proveedores/productos.

    proveedor_id: si el catálogo es de un proveedor que ya existe, se manda
    su id y la IA no intenta resolver/inventar uno (ver
    app/ai/catalog.py). Si se omite, la IA intenta leer el proveedor del
    documento y el front decide si matchea con uno existente o hay que
    crear uno nuevo.
    contexto: JSON con los catálogos que el front ya tiene cargados:
        {"proveedores": [{"id":.., "nombre":.., "cuit":..}],
         "productos": [{"id":.., "marca":.., "modelo":.., "tipo":.., "precio":..}],
         "categorias": [{"id":.., "nombre":.., "tipo":..}]}
    "productos" solo tiene sentido (y solo hace falta mandarlo) cuando ya
    viene proveedor_id -- es el catálogo actual de ESE proveedor, para
    clasificar cada fila detectada como nueva/actualización/sin cambios.
    "categorias" es el catálogo completo de categorías (de cualquier
    proveedor): se usa para sugerir categoria_ids en los productos nuevos,
    filtrando por que el tipo de la categoría coincida con el tipo que la IA
    le asignó a esa línea.
    """
    ext = Path(archivo.filename or "").suffix.lower()
    if ext not in EXTENSIONES_PERMITIDAS_CATALOGO:
        raise HTTPException(status_code=400, detail=f"Extensión no permitida: {ext}")

    contenido = await _leer_archivo_con_tope(archivo)
    # .csv es texto plano, no tiene magic bytes confiables para validar --
    # el resto (incluido .xlsx, que es un .zip) sí los tiene.
    if ext != ".csv" and not contenido_coincide_con_extension(contenido, ext):
        raise HTTPException(status_code=400, detail="El contenido del archivo no coincide con su extensión")
    if ext == ".xlsx":
        _validar_xlsx_descomprimido(contenido)

    try:
        contexto_dict = json.loads(contexto)
    except json.JSONDecodeError:
        contexto_dict = {}

    try:
        return leer_catalogo(
            archivo_bytes=contenido,
            mime_type=MIME_POR_EXTENSION_CATALOGO[ext],
            proveedor_id=proveedor_id or None,
            contexto=contexto_dict,
            modelo=obtener_valor(db, "GEMINI_MODEL"),
        )
    except CatalogReadError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
