"""
Resuelve valores de configuración editables desde la app (tabla
`configuracion`, ver models.Setting), con fallback automático a
Settings/.env cuando no hay fila. Vive en su propio módulo -- ni en
config.py (que es el .env, sin acceso a DB) ni en app/api/configuration.py
(que es la API) -- porque lo consumen también otros módulos que no son rutas
(app/ai/extractor.py, app/ai/catalog.py).

Por ahora la única clave migrada es GEMINI_MODEL (piloto). SECRET_KEY,
credenciales de DB y del bucket NO se agregan acá a propósito: pasarlas por una
tabla las expone a cualquiera con acceso de lectura a la base y a cualquier
fuga de GET /configuracion, algo que un .env fuera del repo no tiene.

Sumar una clave nueva es agregar una entrada acá -- el endpoint y el
resolver ya son genéricos.
"""

from dataclasses import dataclass
from typing import Callable

from sqlalchemy.orm import Session

from app.core.config import settings
from app.db import models


@dataclass(frozen=True)
class ConfigurableKey:
    descripcion: str
    # El valor que se usa cuando la clave no tiene fila en la tabla -- lazy
    # (función y no valor fijo) para leer siempre el settings vigente, no el
    # que había al importar este módulo.
    valor_por_defecto: Callable[[], str]


CLAVES_CONFIGURABLES: dict[str, ConfigurableKey] = {
    "GEMINI_MODEL": ConfigurableKey(
        descripcion="Modelo de Gemini para la lectura de comprobantes y catálogos con IA.",
        valor_por_defecto=lambda: settings.GEMINI_MODEL,
    ),
}


def obtener_valor(db: Session, clave: str) -> str:
    """
    Valor efectivo de una clave configurable: la fila de la tabla si existe,
    si no el default (Settings/.env). KeyError si `clave` no está en
    CLAVES_CONFIGURABLES -- llamar esto con una clave que no se decidió
    hacer editable es un bug del caller, no un 404 en runtime.
    """
    if clave not in CLAVES_CONFIGURABLES:
        raise KeyError(f"'{clave}' no es una clave configurable (ver CLAVES_CONFIGURABLES)")

    fila = db.query(models.Setting).filter(models.Setting.clave == clave).first()
    if fila is not None:
        return fila.valor
    return CLAVES_CONFIGURABLES[clave].valor_por_defecto()
