import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    DateTime,
    ForeignKey,
    String,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import uuid_pk

if TYPE_CHECKING:
    from app.db.models.user import User


class AuditLog(Base):
    """
    Rastro persistido de las acciones importantes: create/update/delete de
    Proyecto, Compra, Gasto y Cobro, más todo el mantenimiento de cuentas que
    hace "Manager" (ver app/core/audit.py y app/api/users.py).

    Hasta acá eso solo iba al logger del servidor, así que responder "quién
    borró esta compra" pedía entrar a los logs de Railway. Esta tabla es lo
    que hace esa pregunta contestable desde la propia app (GET /auditoria,
    solo "Manager").

    NO usa TimestampMixin a propósito: una fila de auditoría es inmutable --
    nunca se edita ni se toca después de insertada, así que
    fecha_actualizacion no significaría nada. Lo único que importa es
    creado_en, o sea CUÁNDO pasó lo que se está registrando.

    Tampoco se borra desde la app: no hay endpoint de delete. Si algún día
    hace falta recortar el historial, va como tarea de mantenimiento
    explícita, no como un botón.
    """

    __tablename__ = "auditoria"

    id: Mapped[uuid.UUID] = uuid_pk()
    # Quién hizo la acción. RESTRICT por el mismo criterio que el resto del
    # historial: una cuenta no se borra (se desactiva, ver Usuario.activo), y
    # menos todavía si dejó rastro acá.
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    # "create" | "update" | "delete" para las entidades de negocio; para las
    # acciones de Manager es la frase corta que ya usaba el log ("desactivar",
    # "cambiar rol a admin", etc.).
    accion: Mapped[str] = mapped_column(String(50), nullable=False)
    # "Proyecto" | "Compra" | "Gasto" | "Cobro" | "Usuario" | "Autorizacion".
    tipo_recurso: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    # String y SIN foreign key, a propósito: buena parte de estas filas
    # registran un borrado, así que el recurso ya no existe -- una FK haría
    # imposible insertar justo el caso que más interesa auditar. String
    # porque tampoco todo recurso_id es un UUID (una autorización que todavía
    # no se creó no tiene id).
    recurso_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Contexto extra libre (ej. sobre qué usuario se ejecutó una acción de
    # Manager). Opcional: la mayoría de las filas no lo necesitan.
    detalle: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    usuario: Mapped["User"] = relationship()
