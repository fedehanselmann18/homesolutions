from datetime import datetime

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    DateTime,
    String,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Setting(Base):
    """
    Valores de configuración editables desde la app (GET/PATCH /configuracion,
    solo "Manager"), clave/valor, con fallback automático a Settings/.env
    cuando la clave no tiene fila -- ver app/core/app_settings.py, que resuelve
    ese fallback, y CLAVES_CONFIGURABLES ahí para cuáles claves son estas.

    Mismo problema que resolvió la migración d5a3c1e88f42 con la whitelist de
    autoregistro (antes ROLES_PERMITIDOS_JSON): cambiar un valor no tiene que
    exigir editar el .env y redeployar. La diferencia es que acá "sin fila"
    es un estado normal y esperado (no todo el mundo pisa el default), así
    que no hay semilla: la tabla arranca vacía a propósito.

    NO uses esto para secretos: SECRET_KEY ni las credenciales de DB/bucket se
    migran acá (ver el comentario de CLAVES_CONFIGURABLES) -- una tabla es
    legible por cualquiera con acceso a la base, algo que un .env fuera del
    repo no es.
    """

    __tablename__ = "configuracion"

    clave: Mapped[str] = mapped_column(String(100), primary_key=True)
    valor: Mapped[str] = mapped_column(String(500), nullable=False)
    fecha_actualizacion: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
