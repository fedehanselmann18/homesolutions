import mimetypes
import shutil
import threading
import uuid
from pathlib import Path

import boto3
from botocore.client import Config
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException, UploadFile
from fastapi.responses import FileResponse, Response

from app.config import settings

BASE_UPLOAD_DIR = Path("uploads")
ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png"}
MAX_SIZE_BYTES = 10 * 1024 * 1024  # 10MB

# Firma binaria real de cada tipo permitido, para no confiar solo en la
# extensión del filename (que el cliente puede poner lo que quiera): un
# .pdf que en realidad es un .html con un XSS adentro pasaría el chequeo de
# extensión, y X-Content-Type-Options: nosniff no ayuda si el contenido
# reportado (por extensión) ya es mentira.
FIRMAS_POR_EXTENSION = {
    ".pdf": (b"%PDF-",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".png": (b"\x89PNG\r\n\x1a\n",),
}

CONTENT_TYPE_POR_EXTENSION = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
}

# La firma más larga que validamos es la de PNG (8 bytes) -- alcanza para
# todos los tipos permitidos, no hace falta leer más para chequear magic bytes.
BYTES_FIRMA = 8


def contenido_coincide_con_extension(contenido: bytes, ext: str) -> bool:
    firmas = FIRMAS_POR_EXTENSION.get(ext, ())
    return any(contenido.startswith(firma) for firma in firmas)


# Raíz del backend (.../backend), calculada desde este archivo. Los paths se
# guardan relativos en la DB (para no romperlos si se mueve el proyecto de
# carpeta), pero se resuelven SIEMPRE contra esta raíz y no contra el cwd:
# si no, arrancar uvicorn desde otro directorio hacía que eliminar_comprobante
# no encontrara el archivo y lo dejara huérfano en disco sin avisar.
# Solo aplica al backend de disco local (dev); R2 no usa paths de filesystem.
RAIZ_BACKEND = Path(__file__).resolve().parents[2]


def ruta_absoluta(path) -> Path:
    """Resuelve un path guardado en la DB (relativo) contra la raíz del backend."""
    ruta = Path(path)
    return ruta if ruta.is_absolute() else RAIZ_BACKEND / ruta


# B-12: singleton con lock en vez de @lru_cache -- @lru_cache no tiene forma
# de invalidarse selectivamente para ESTA función sin afectar otras (y
# cache_clear() de una función sin argumentos igual no distingue "credenciales
# viejas" de "quiero una instancia nueva"). Con esto, reset_r2_client() fuerza
# que la próxima llamada arme un cliente nuevo -- por ejemplo después de
# rotar R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY -- sin reiniciar el proceso.
_r2_client_instance = None
_r2_client_lock = threading.Lock()


def _r2_client():
    """
    Cliente boto3 apuntando al endpoint S3-compatible de Cloudflare R2.
    Cacheado como singleton (no se reabre conexión en cada request) hasta
    que se llame a reset_r2_client(). Solo se llama cuando
    settings.r2_configurado es True.
    """
    global _r2_client_instance
    if _r2_client_instance is None:
        with _r2_client_lock:
            # Doble chequeo: otro thread pudo haber creado el cliente
            # mientras este esperaba el lock (FastAPI corre las rutas sync
            # en un threadpool, esto sí puede pasar concurrentemente).
            if _r2_client_instance is None:
                _r2_client_instance = boto3.client(
                    "s3",
                    endpoint_url=settings.r2_endpoint_url,
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    region_name="auto",
                    config=Config(signature_version="s3v4"),
                )
    return _r2_client_instance


def reset_r2_client() -> None:
    """
    Fuerza que la próxima llamada a _r2_client() arme una instancia nueva,
    con las credenciales que tenga settings en ese momento -- usar después
    de rotar credenciales de R2, sin reiniciar el proceso del backend.
    """
    global _r2_client_instance
    with _r2_client_lock:
        _r2_client_instance = None


def _validar(archivo: UploadFile) -> str:
    """Chequeos comunes a ambos backends: extensión, tamaño y contenido real
    (magic bytes). Lee SOLO los primeros BYTES_FIRMA bytes para el chequeo de
    firma (no el archivo entero) y deja el puntero al inicio del archivo, así
    el caller puede streamear el contenido completo al destino sin
    mantenerlo entero en memoria de Python. Devuelve la extensión o levanta
    HTTPException 400."""
    ext = Path(archivo.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Extensión no permitida: {ext}")

    archivo.file.seek(0, 2)
    tamaño = archivo.file.tell()
    archivo.file.seek(0)
    if tamaño > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera los 10MB")

    firma = archivo.file.read(BYTES_FIRMA)
    archivo.file.seek(0)
    if not contenido_coincide_con_extension(firma, ext):
        raise HTTPException(
            status_code=400,
            detail="El contenido del archivo no coincide con su extensión",
        )
    return ext


def subir_comprobante(archivo: UploadFile, carpeta: str, entidad_id: str) -> str:
    """
    Guarda el archivo (en R2 si está configurado, si no en disco local) y
    devuelve la "key"/path relativo a guardar en la DB (columna
    archivo_path). El formato del string difiere entre backends (R2 no
    lleva el prefijo "uploads/"), pero es un detalle interno: ambos se
    resuelven de nuevo con el mismo backend al leerlos o borrarlos, porque
    cuál backend está activo se decide una sola vez por deploy (según haya
    o no credenciales R2 en el .env), no por archivo.

    carpeta: "comprobantes_compra" | "comprobantes_gasto" | "comprobantes_cobro"
    entidad_id: compra_id / gasto_id / cobro_id
    """
    ext = _validar(archivo)

    if settings.r2_configurado:
        key = f"{carpeta}/{entidad_id}/{uuid.uuid4()}{ext}"
        try:
            # Body acepta un file-like (boto3 lo streamea solo): no hace
            # falta juntar el archivo entero en un bytes de Python primero.
            _r2_client().put_object(
                Bucket=settings.R2_BUCKET_NAME,
                Key=key,
                Body=archivo.file,
                ContentType=CONTENT_TYPE_POR_EXTENSION.get(ext, "application/octet-stream"),
            )
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(status_code=502, detail="No se pudo subir el comprobante a R2") from exc
        return key

    ruta_relativa = BASE_UPLOAD_DIR / carpeta / entidad_id / f"{uuid.uuid4()}{ext}"
    ruta_completa = ruta_absoluta(ruta_relativa)
    ruta_completa.parent.mkdir(parents=True, exist_ok=True)

    with open(ruta_completa, "wb") as f:
        shutil.copyfileobj(archivo.file, f)

    # path relativo, no absoluto -> así no se rompe si movés el proyecto de carpeta
    return str(ruta_relativa)


def eliminar_comprobante(path: str) -> None:
    """
    Borra el archivo (de R2 o de disco local, según backend activo). No
    falla si ya no existe (por ejemplo si se borró a mano o el path quedó
    huérfano).

    IMPORTANTE: esta función solo borra el archivo. El router que la llama
    tiene que borrar también la fila de la tabla Comprobante* en la misma
    operación (ver comprobantes_router.py) — si solo se borra una de las dos
    cosas quedan huérfanos: o un archivo fantasma, o una fila que apunta a
    un archivo que ya no existe.
    """
    if settings.r2_configurado:
        try:
            _r2_client().delete_object(Bucket=settings.R2_BUCKET_NAME, Key=path)
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(status_code=502, detail="No se pudo borrar el comprobante en R2") from exc
        return

    ruta = ruta_absoluta(path)
    if ruta.exists():
        ruta.unlink()

    # Borra la carpeta de la entidad (uploads/<tipo>/<entidad_id>/) si quedó
    # vacía: al borrar una compra/gasto/cobro (o todo un proyecto/fase con
    # sus movimientos) antes quedaban directorios vacíos acumulándose. El
    # try cubre la carrera de que otro request suba un comprobante justo
    # entre el chequeo y el rmdir.
    carpeta = ruta.parent
    if carpeta.is_dir() and carpeta.parent.name.startswith("comprobantes_") and not any(carpeta.iterdir()):
        try:
            carpeta.rmdir()
        except OSError:
            pass


def ver_comprobante(path: str):
    """
    Devuelve el archivo para visualizar/descargar.

    Con disco local: FileResponse (streamea el archivo directo).

    Con R2: ANTES esto devolvía un RedirectResponse a una URL firmada
    temporal, para que el navegador bajara el archivo directo de R2 sin
    gastar ancho de banda del backend. Se rompía en producción: el frontend
    pide este endpoint con axios + withCredentials=true (para mandar la
    cookie de sesión), y el browser trata el redirect como parte de la
    MISMA request con credenciales -- al llegar a r2.cloudflarestorage.com
    (un origen distinto, sin política CORS que permita el dominio de Vercel
    con credentials), lo bloquea. Eso es justo el "Network Error" que tira
    axios sin ningún status code.

    Por eso ahora el backend baja el objeto de R2 con boto3 y lo devuelve
    él mismo: el navegador solo habla con nuestra propia API (que ya tiene
    CORS bien configurado), sin un segundo salto a un origen distinto.
    Los comprobantes están limitados a 10MB (MAX_SIZE_BYTES), así que
    traerlo entero a memoria en vez de streamearlo es una simplificación
    aceptable.
    """
    if settings.r2_configurado:
        try:
            objeto = _r2_client().get_object(Bucket=settings.R2_BUCKET_NAME, Key=path)
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(status_code=404, detail="Comprobante no encontrado en R2") from exc

        contenido = objeto["Body"].read()
        media_type = objeto.get("ContentType") or mimetypes.guess_type(path)[0] or "application/octet-stream"
        nombre = Path(path).name
        return Response(
            content=contenido,
            media_type=media_type,
            headers={"Content-Disposition": f'inline; filename="{nombre}"'},
        )

    ruta = ruta_absoluta(path)
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(ruta, filename=ruta.name)
