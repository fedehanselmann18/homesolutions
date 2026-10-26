"""
Consulta del rastro de auditoría (tabla `auditoria`, ver models.AuditLog y
app/core/audit.py). Solo lectura y solo para la cuenta "Manager": no hay POST
(las filas las escribe log_auditoria desde los endpoints auditados) ni
DELETE (un historial que se puede borrar desde la app no sirve como
historial).
"""

import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.auth.oauth2 import requiere_manager
from app.core.pagination import PaginationParams
from app.db import models
from app.db.database import get_db
from app.schemas import AuditLogOut, AuditLogPage

router = APIRouter(prefix="/auditoria", tags=["auditoria"])


@router.get("/tipos", response_model=list[str], status_code=status.HTTP_200_OK)
def get_tipos_auditoria(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_manager),
):
    """
    Los tipos de recurso que REALMENTE aparecen en la tabla, para armar el
    combo de filtro sin hardcodear la lista en el front (si mañana se
    audita una entidad nueva, el filtro la muestra solo). Es un DISTINCT
    sobre una columna indexada de una tabla chica: sale barato.
    """
    tipos = db.query(models.AuditLog.tipo_recurso).distinct().order_by(models.AuditLog.tipo_recurso).all()
    return [tipo for (tipo,) in tipos]


@router.get("/", response_model=AuditLogPage, status_code=status.HTTP_200_OK)
def get_auditoria(
    tipo_recurso: str | None = Query(None, description="Filtra por tipo de recurso (Proyecto, Compra...)"),
    usuario_id: uuid.UUID | None = Query(None, description="Filtra por quién hizo la acción"),
    desde: date | None = Query(None, description="Incluye desde esta fecha (inclusive)"),
    hasta: date | None = Query(None, description="Incluye hasta esta fecha (inclusive)"),
    paginacion: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_manager),
):
    """
    Listado paginado del historial, del más reciente al más viejo.

    A diferencia del resto de los listados (ver app/core/pagination.py), acá el
    front SÍ manda siempre limit/offset: esta tabla crece sin techo y es la
    única pantalla con paginado real.
    """
    query = db.query(models.AuditLog)

    if tipo_recurso:
        query = query.filter(models.AuditLog.tipo_recurso == tipo_recurso)
    if usuario_id:
        query = query.filter(models.AuditLog.usuario_id == usuario_id)
    if desde:
        query = query.filter(models.AuditLog.creado_en >= desde)
    if hasta:
        # +1 día en vez de <= hasta: creado_en es un timestamp y `hasta` una
        # fecha suelta, así que comparar directo dejaría afuera todo lo que
        # pasó ese mismo día después de las 00:00 -- justo el día que más se
        # va a consultar (hoy).
        query = query.filter(models.AuditLog.creado_en < hasta + timedelta(days=1))

    total = query.count()

    filas = (
        query.order_by(models.AuditLog.creado_en.desc())
        .offset(paginacion.offset)
        .limit(paginacion.limit)
        .all()
    )

    # El nombre del ejecutor se resuelve en una sola query aparte en vez de
    # con un join por fila: son 3 o 4 usuarios en total, así que el dict
    # entero es más barato que arrastrar el join.
    nombres = dict(db.query(models.User.id, models.User.nombre_usuario).all())

    items = []
    for fila in filas:
        datos = AuditLogOut.model_validate(fila)
        datos.usuario_nombre = nombres.get(fila.usuario_id)
        items.append(datos)

    return AuditLogPage(items=items, total=total)
