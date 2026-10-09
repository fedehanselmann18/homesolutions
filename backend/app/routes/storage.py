"""
Reconciliación de archivos en el bucket: `eliminar_comprobante`
(app/files/storage.py) se llama explícitamente antes de cada borrado en
proyectos.py/compras.py/gastos.py/cobros.py/fases.py, así que esto NO es una
red de seguridad para un borrado que "se olvidó" -- es la red para lo que
ese borrado explícito no puede cubrir: un upload que llegó al bucket pero el
commit de la fila en DB falló, un request interrumpido a mitad de camino, o
un bug futuro en algún endpoint nuevo que suba sin registrar.

Solo tiene sentido con el bucket configurado: el disco local (dev) no tiene un
"listar todo el bucket" que comparar, y en producción los deploys de
Railway no persisten el disco entre reinicios de todos modos.

Exclusivo de "Manager" (requiere_manager), igual que /auditoria y
/configuracion.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import log_auditoria
from app.auth.oAuth2 import requiere_manager
from app.config import settings
from app.db import models
from app.db.db import get_db
from app.files.storage import eliminar_comprobante, listar_objetos_bucket
from app.schemas import (
    ArchivoRoto,
    ObjetoBucket,
    PurgarHuerfanosRequest,
    PurgarHuerfanosResultado,
    ReconciliacionBucket,
)

router = APIRouter(prefix="/storage", tags=["storage"])

# Todas las tablas que guardan un archivo_path apuntando al bucket/disco. Sumar
# una tabla nueva con archivo_path es agregarla acá -- la reconciliación ya
# es genérica sobre esta lista.
TABLAS_CON_ARCHIVO = [
    (models.ComprobanteCompra, "ComprobanteCompra"),
    (models.NotaCompra, "NotaCompra"),
    (models.ComprobanteGasto, "ComprobanteGasto"),
    (models.ComprobanteCobro, "ComprobanteCobro"),
    (models.NotaCobro, "NotaCobro"),
]


def _archivo_paths_en_db(db: Session) -> dict[str, tuple[str, str]]:
    """archivo_path -> (tipo_recurso, id de la fila que lo referencia)."""
    mapa: dict[str, tuple[str, str]] = {}
    for modelo, tipo in TABLAS_CON_ARCHIVO:
        for fila_id, path in db.query(modelo.id, modelo.archivo_path).all():
            mapa[path] = (tipo, str(fila_id))
    return mapa


def _exigir_bucket_configurado() -> None:
    if not settings.bucket_configurado:
        raise HTTPException(
            status_code=400,
            detail="El bucket de comprobantes no está configurado: esta comparación no aplica en disco local.",
        )


@router.get("/reconciliacion", response_model=ReconciliacionBucket, status_code=status.HTTP_200_OK)
def get_reconciliacion(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    _exigir_bucket_configurado()

    objetos_bucket = listar_objetos_bucket()
    claves_bucket = {objeto["key"] for objeto in objetos_bucket}
    mapa_db = _archivo_paths_en_db(db)

    huerfanos = [ObjetoBucket(**objeto) for objeto in objetos_bucket if objeto["key"] not in mapa_db]
    rotos = [
        ArchivoRoto(tipo_recurso=tipo, recurso_id=fila_id, archivo_path=path)
        for path, (tipo, fila_id) in mapa_db.items()
        if path not in claves_bucket
    ]

    return ReconciliacionBucket(huerfanos=huerfanos, rotos=rotos)


@router.post(
    "/reconciliacion/purgar", response_model=PurgarHuerfanosResultado, status_code=status.HTTP_200_OK
)
def purgar_huerfanos(
    datos: PurgarHuerfanosRequest,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """
    Borra del bucket las claves pedidas -- SOLO si siguen siendo huérfanas
    en este mismo momento. Revalida contra la DB de nuevo acá (no confía en
    la lista que el front vio al abrir la pantalla) por si en el medio
    entró un comprobante nuevo con esa misma key, aunque sea estadísticamente
    imposible (la key incluye un uuid4, ver subir_comprobante) -- el costo
    de revalidar es una sola query más, y la alternativa es borrar un
    comprobante real por una carrera de un caso en un millón.
    """
    _exigir_bucket_configurado()

    mapa_db = _archivo_paths_en_db(db)
    purgadas = []
    omitidas = []

    for clave in datos.claves:
        if clave in mapa_db:
            omitidas.append(clave)
            continue
        try:
            eliminar_comprobante(clave)
            purgadas.append(clave)
        except HTTPException:
            omitidas.append(clave)

    if purgadas:
        log_auditoria(
            db,
            current_user.id,
            "purgar huérfanos del bucket",
            "ArchivoBucket",
            None,
            detalle={"claves": purgadas},
        )

    return PurgarHuerfanosResultado(purgadas=purgadas, omitidas=omitidas)
