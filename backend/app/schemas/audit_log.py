import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    """
    Una fila del rastro de auditoría (ver models.AuditLog).

    No hereda de TimestampOut, a diferencia de todos los demás Out: esta
    tabla no tiene fecha_creacion/fecha_actualizacion porque una fila de
    auditoría no se edita nunca. Su única fecha es creado_en.
    """

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    usuario_id: uuid.UUID
    # No es una columna: lo completa el endpoint con el join a usuarios,
    # mismo patrón que ya_registrado en UsuarioAutorizadoOut. El id solo no
    # le dice nada a nadie leyendo el listado.
    usuario_nombre: Optional[str] = None
    accion: str
    tipo_recurso: str
    recurso_id: Optional[str] = None
    detalle: Optional[dict] = None
    creado_en: datetime


class AuditLogPage(BaseModel):
    """
    A diferencia del resto de los listados (que devuelven una lista pelada),
    la auditoría viaja envuelta con el total: es la única pantalla con
    paginado real en la UI, y sin saber cuántas filas hay en total no se
    puede dibujar "mostrando 1-50 de 320" ni deshabilitar "siguiente" en la
    última página.
    """

    items: list[AuditLogOut]
    total: int
