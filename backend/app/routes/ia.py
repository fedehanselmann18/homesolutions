import json
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status

from app.auth.oAuth2 import requiere_admin
from app.db import models
from app.files.storage import contenido_coincide_con_extension
from app.ia.extractor import ExtraccionIAError, extraer_comprobante
from app.limiter import limiter
from app.schemas import IAExtraccionComprobante

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
        )
    except ExtraccionIAError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
