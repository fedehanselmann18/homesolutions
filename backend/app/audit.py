"""Auditoría de las operaciones críticas (create/update/delete de Proyecto,
Compra, Gasto, Cobro). Vive en su propio módulo para no repetir el mismo
armado en cada route file.

Escribe en DOS lados a propósito:

1. La tabla `auditoria` (ver models.Auditoria), que es lo consultable desde
   la app: GET /auditoria, solo la cuenta "Manager".
2. El logger del servidor, igual que antes de que la tabla existiera.

Lo segundo NO es redundancia al pepe: es la red de seguridad para cuando
falla lo primero. Si el INSERT no entra (base caída, migración sin correr),
el log sigue siendo el rastro -- por eso el INSERT va envuelto en try/except
y nunca puede hacer fallar la acción que está auditando.

Ese try/except es seguro porque TODAS las llamadas se hacen DESPUÉS del
commit de la acción auditada: la sesión llega limpia acá, así que este
commit solo escribe la fila de auditoría, y si hay que rollbackear no se
pierde nada de lo que hizo el usuario. Auditar después y no antes también
evita el otro problema: dejar registrada una acción que después falló.
"""

import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.db import models

logger = logging.getLogger("audit")


def log_auditoria(
    db: Session,
    usuario_id: uuid.UUID,
    accion: str,
    tipo: str,
    recurso_id,
    detalle: dict | None = None,
) -> None:
    logger.info(
        "accion=%s tipo=%s id=%s usuario_id=%s detalle=%s timestamp=%s",
        accion,
        tipo,
        recurso_id,
        usuario_id,
        detalle,
        datetime.now(timezone.utc).isoformat(),
    )

    try:
        db.add(
            models.Auditoria(
                usuario_id=usuario_id,
                accion=accion,
                tipo_recurso=tipo,
                recurso_id=str(recurso_id) if recurso_id is not None else None,
                detalle=detalle,
            )
        )
        db.commit()
    except Exception:
        db.rollback()
        logger.exception(
            "No se pudo guardar la auditoría en la base: la acción se hizo igual "
            "y queda registrada solo en este log"
        )
