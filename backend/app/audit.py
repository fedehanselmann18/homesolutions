"""Logger de auditoría para operaciones críticas (create/update/delete de
Proyecto, Compra, Gasto, Cobro). Vive en su propio módulo para no repetir
el mismo armado de log en cada route file."""

import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger("audit")


def log_auditoria(usuario_id: uuid.UUID, accion: str, tipo: str, recurso_id) -> None:
    logger.info(
        "accion=%s tipo=%s id=%s usuario_id=%s timestamp=%s",
        accion,
        tipo,
        recurso_id,
        usuario_id,
        datetime.now(timezone.utc).isoformat(),
    )
