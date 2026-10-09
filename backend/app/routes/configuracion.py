"""
Panel de configuración de Manager: valores
editables desde la app sin redeployar (tabla `configuracion`, ver
models.Configuracion) más el estado -- solo lectura -- de las integraciones
externas (bucket de comprobantes, Gemini), que dependen de variables que NUNCA se migran acá
(son credenciales, ver el comentario de app/configuracion.py).

Todo el router es exclusivo de "Manager" (requiere_manager), igual que
/usuarios y /auditoria.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.audit import log_auditoria
from app.auth.oAuth2 import requiere_manager
from app.config import settings
from app.configuracion import CLAVES_CONFIGURABLES, obtener_valor
from app.db import models
from app.db.db import get_db
from app.schemas import ConfiguracionUpdate, ConfiguracionValor

router = APIRouter(prefix="/configuracion", tags=["configuracion"])


def _valor_actual(db: Session, clave: str) -> ConfiguracionValor:
    fila = db.query(models.Configuracion).filter(models.Configuracion.clave == clave).first()
    return ConfiguracionValor(
        clave=clave,
        valor=obtener_valor(db, clave),
        descripcion=CLAVES_CONFIGURABLES[clave].descripcion,
        personalizado=fila is not None,
    )


@router.get("/", response_model=list[ConfiguracionValor], status_code=status.HTTP_200_OK)
def get_configuracion(
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    return [_valor_actual(db, clave) for clave in CLAVES_CONFIGURABLES]


@router.get("/estado-integraciones", status_code=status.HTTP_200_OK)
def get_estado_integraciones(current_user: models.Usuario = Depends(requiere_manager)):
    """
    Estado de las integraciones que dependen de variables de entorno que
    nunca pasan por la tabla `configuracion` (son credenciales): si están
    seteadas o no, sin exponer los valores. El bucket reusa la property que ya
    usa app/files/storage.py para decidir disco vs. bucket; Gemini es la misma
    condición que revienta con 502 en /ia si falta.
    """
    return {
        "bucket_configurado": settings.bucket_configurado,
        "gemini_configurado": bool(settings.GEMINI_API_KEY),
    }


@router.patch("/{clave}", response_model=ConfiguracionValor, status_code=status.HTTP_200_OK)
def actualizar_configuracion(
    clave: str,
    datos: ConfiguracionUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    if clave not in CLAVES_CONFIGURABLES:
        raise HTTPException(status_code=404, detail=f"'{clave}' no es una clave configurable")

    fila = db.query(models.Configuracion).filter(models.Configuracion.clave == clave).first()
    if fila:
        fila.valor = datos.valor
    else:
        fila = models.Configuracion(clave=clave, valor=datos.valor)
        db.add(fila)
    db.commit()

    log_auditoria(db, current_user.id, "editar", "Configuracion", clave, detalle={"valor": datos.valor})
    return _valor_actual(db, clave)


@router.delete("/{clave}", response_model=ConfiguracionValor, status_code=status.HTTP_200_OK)
def restaurar_configuracion(
    clave: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_manager),
):
    """Borra la fila -- el valor efectivo vuelve a ser el de Settings/.env."""
    if clave not in CLAVES_CONFIGURABLES:
        raise HTTPException(status_code=404, detail=f"'{clave}' no es una clave configurable")

    fila = db.query(models.Configuracion).filter(models.Configuracion.clave == clave).first()
    if fila:
        db.delete(fila)
        db.commit()
        log_auditoria(db, current_user.id, "restaurar", "Configuracion", clave)

    return _valor_actual(db, clave)
