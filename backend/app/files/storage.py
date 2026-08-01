import uuid
from pathlib import Path
from fastapi import UploadFile, HTTPException
from fastapi.responses import FileResponse

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


def contenido_coincide_con_extension(contenido: bytes, ext: str) -> bool:
    firmas = FIRMAS_POR_EXTENSION.get(ext, ())
    return any(contenido.startswith(firma) for firma in firmas)

# Raíz del backend (.../backend), calculada desde este archivo. Los paths se
# guardan relativos en la DB (para no romperlos si se mueve el proyecto de
# carpeta), pero se resuelven SIEMPRE contra esta raíz y no contra el cwd:
# si no, arrancar uvicorn desde otro directorio hacía que eliminar_comprobante
# no encontrara el archivo y lo dejara huérfano en disco sin avisar.
RAIZ_BACKEND = Path(__file__).resolve().parents[2]


def ruta_absoluta(path) -> Path:
    """Resuelve un path guardado en la DB (relativo) contra la raíz del backend."""
    ruta = Path(path)
    return ruta if ruta.is_absolute() else RAIZ_BACKEND / ruta


def subir_comprobante(archivo: UploadFile, carpeta: str, entidad_id: str) -> str:
    """
    Guarda el archivo en disco y devuelve el path relativo a guardar en la DB.
    carpeta: "comprobantes_compra" | "comprobantes_gasto" | "comprobantes_cobro"
    entidad_id: compra_id / gasto_id / cobro_id
    """
    ext = Path(archivo.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"Extensión no permitida: {ext}")

    archivo.file.seek(0, 2)
    tamaño = archivo.file.tell()
    archivo.file.seek(0)
    if tamaño > MAX_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="El archivo supera los 10MB")

    contenido = archivo.file.read()
    if not contenido_coincide_con_extension(contenido, ext):
        raise HTTPException(
            status_code=400,
            detail="El contenido del archivo no coincide con su extensión",
        )

    ruta_relativa = BASE_UPLOAD_DIR / carpeta / entidad_id / f"{uuid.uuid4()}{ext}"
    ruta_completa = ruta_absoluta(ruta_relativa)
    ruta_completa.parent.mkdir(parents=True, exist_ok=True)

    with open(ruta_completa, "wb") as f:
        f.write(contenido)

    # path relativo, no absoluto -> así no se rompe si movés el proyecto de carpeta
    return str(ruta_relativa)


def eliminar_comprobante(path: str) -> None:
    """
    Borra el archivo físico si existe. No falla si ya no está en disco
    (por ejemplo si se borró a mano o el path quedó huérfano).

    Además borra la carpeta de la entidad (uploads/<tipo>/<entidad_id>/) si
    quedó vacía: al borrar una compra/gasto/cobro — o todo un proyecto o fase
    con sus movimientos — antes quedaban directorios vacíos acumulándose.

    IMPORTANTE: esta función solo borra el archivo. El router que la llama
    tiene que borrar también la fila de la tabla Comprobante* en la misma
    operación (ver comprobantes_router.py) — si solo se borra una de las dos
    cosas quedan huérfanos: o un archivo fantasma en disco, o una fila que
    apunta a un archivo que ya no existe.
    """
    ruta = ruta_absoluta(path)
    if ruta.exists():
        ruta.unlink()

    carpeta = ruta.parent
    # el `not any(...)` es el chequeo de "carpeta vacía"; el try cubre la carrera
    # de que otro request suba un comprobante justo entre el chequeo y el rmdir
    if carpeta.is_dir() and carpeta.parent.name.startswith("comprobantes_") and not any(carpeta.iterdir()):
        try:
            carpeta.rmdir()
        except OSError:
            pass


def ver_comprobante(path: str) -> FileResponse:
    """
    Devuelve el archivo para visualizar/descargar.

    CORREGIDO: la versión anterior tipaba `-> bytes` pero devolvía un
    FileResponse (inconsistente), y encima abría el archivo con `open()`
    para nada — FileResponse ya se encarga de leer y streamear el archivo
    él solo, pasándole únicamente el path.
    """
    ruta = ruta_absoluta(path)
    if not ruta.exists():
        raise HTTPException(status_code=404, detail="Archivo no encontrado")
    return FileResponse(ruta, filename=ruta.name)