import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.orm import Session

from app.auth.oAuth2 import requiere_admin
from app.configuracion import obtener_valor
from app.db import models
from app.db.db import get_db
from app.files.storage import contenido_coincide_con_extension
from app.ia.catalogo import LecturaCatalogoError, leer_catalogo
from app.ia.extractor import ExtraccionIAError, extraer_comprobante
from app.limiter import limiter
from app.schemas import IAExtraccionComprobante, IALecturaCatalogo

router = APIRouter(prefix="/ia", tags=["ia"])

# Mismos límites que los comprobantes que ya se suben de verdad (ver
# files/storage.py) -- no tiene sentido aceptar acá algo que después el
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
# se puede mandar la planilla tal cual (ver app/ia/catalogo.py). Set/dict
# aparte -- extender los de arriba habilitaría .xlsx/.csv también en
# /extraer-comprobante, que no sabe qué hacer con eso.
EXTENSIONES_PERMITIDAS_CATALOGO = EXTENSIONES_PERMITIDAS | {".xlsx", ".csv"}
MIME_POR_EXTENSION_CATALOGO = {
    **MIME_POR_EXTENSION,
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".csv": "text/csv",
}


@router.post(
    "/extraer-comprobante",
    response_model=IAExtraccionComprobante,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("20/hour")
async def extraer_comprobante_endpoint(
    request: Request,
    tipo_entidad: str = Form(...),
    contexto: str = Form("{}"),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
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

    contenido = await archivo.read()
    if len(contenido) > TAMANIO_MAXIMO_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera los 10MB")
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
            # Editable desde Manager (ver PLAN_MANAGER.md #2) sin redeployar
            # -- ver app/configuracion.py para el fallback a Settings/.env.
            modelo=obtener_valor(db, "GEMINI_MODEL"),
        )
    except ExtraccionIAError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post(
    "/leer-catalogo",
    response_model=IALecturaCatalogo,
    status_code=status.HTTP_200_OK,
)
@limiter.limit("20/hour")
async def leer_catalogo_endpoint(
    request: Request,
    proveedor_id: str | None = Form(None),
    contexto: str = Form("{}"),
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
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
    app/ia/catalogo.py). Si se omite, la IA intenta leer el proveedor del
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

    contenido = await archivo.read()
    if len(contenido) > TAMANIO_MAXIMO_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera los 10MB")
    # .csv es texto plano, no tiene magic bytes confiables para validar --
    # el resto (incluido .xlsx, que es un .zip) sí los tiene.
    if ext != ".csv" and not contenido_coincide_con_extension(contenido, ext):
        raise HTTPException(status_code=400, detail="El contenido del archivo no coincide con su extensión")

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
    except LecturaCatalogoError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
