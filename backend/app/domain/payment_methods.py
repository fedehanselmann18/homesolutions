"""
Medios de pago (ver models.PaymentMethod): lo que comparten el router de Ajustes
y las rutas de compras y gastos.

- El código se arma del nombre al crear y no cambia nunca: es lo que guardan
  los movimientos (FK a medios_pago.codigo), así que renombrar no toca nada.
- Un medio con movimientos no se borra: se desactiva. Uno desactivado no se
  puede elegir al cargar, pero los movimientos viejos que lo usan siguen
  válidos (por eso validar_medio_pago deja pasar el valor que ya tenía).
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db import models

MEDIO_INVALIDO = "Elegí un medio de pago de la lista"


def listar(db: Session) -> list[models.PaymentMethod]:
    return (
        db.query(models.PaymentMethod).order_by(models.PaymentMethod.orden, models.PaymentMethod.nombre).all()
    )


def validar_medio_pago(db: Session, codigo: str | None, actual: str | None = None) -> None:
    """Opcional: None / "" no se valida. 400 si no existe o está desactivado.
    `actual` es el valor que el movimiento ya tiene al editarlo: conservarlo
    es válido aunque el medio se haya desactivado después."""
    if not codigo or codigo == actual:
        return
    medio = db.query(models.PaymentMethod).filter(models.PaymentMethod.codigo == codigo).first()
    if medio is None or not medio.activo:
        raise HTTPException(status_code=400, detail=MEDIO_INVALIDO)
