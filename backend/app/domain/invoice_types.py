"""
Tipos de factura (ver models.InvoiceType): lo que comparten el router de
Ajustes, las rutas de movimientos y la lectura de comprobantes con IA.

- El código se arma del nombre al crear y no cambia nunca: es lo que guardan
  los movimientos (FK a tipos_factura.codigo), así que renombrar no toca nada.
- «Otros» (CODIGO_OTROS) no se borra: es el que usa la IA cuando no reconoce
  el comprobante. Sí se puede renombrar.
- La lista sale en `orden`, pero «Otros» siempre último: así un tipo nuevo,
  que va al final, queda antes del comodín.
"""

import re
import unicodedata

from fastapi import HTTPException
from sqlalchemy import case
from sqlalchemy.orm import Session

from app.db import models

CODIGO_OTROS = "otros"
LARGO_CODIGO = 30
TIPO_INVALIDO = "Elegí un tipo de factura de la lista"


def generar_codigo(nombre: str) -> str:
    """'Factura interna' -> 'factura_interna'. Sin tildes, minúsculas, todo
    lo que no sea letra o número pasa a '_'. Puede quedar vacío ('¡¡!!')."""
    sin_tildes = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode("ascii")
    codigo = re.sub(r"[^a-z0-9]+", "_", sin_tildes.lower()).strip("_")
    return codigo[:LARGO_CODIGO].rstrip("_")


def listar(db: Session) -> list[models.InvoiceType]:
    return (
        db.query(models.InvoiceType)
        .order_by(
            case((models.InvoiceType.codigo == CODIGO_OTROS, 1), else_=0),
            models.InvoiceType.orden,
            models.InvoiceType.nombre,
        )
        .all()
    )


def validar_tipo_factura(db: Session, codigo: str | None) -> None:
    """400 con un mensaje que Agus entienda si el código no está en la lista.
    La FK es la red de seguridad; esto es para no devolver un "datos
    inválidos" genérico (o un 500 en las rutas que no capturan IntegrityError)."""
    existe = (
        codigo is not None
        and db.query(models.InvoiceType.id).filter(models.InvoiceType.codigo == codigo).first() is not None
    )
    if not existe:
        raise HTTPException(status_code=400, detail=TIPO_INVALIDO)
