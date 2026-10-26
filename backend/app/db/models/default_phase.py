import uuid

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk


class DefaultPhase(TimestampMixin, Base):
    """Nombre sugerido para una fase (Relevamiento y anteproyecto, Montaje
    de unidades interiores...): son las opciones del select del modal de
    fase. NO hay FK desde Fase -- la fase guarda el nombre como texto, así
    que se puede escribir uno a mano que no esté acá, y renombrar o borrar
    una predeterminada no toca las fases ya creadas."""

    __tablename__ = "fases_predeterminadas"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(150), unique=True, nullable=False)
    # Posición en el select (1, 2, 3...): las de fábrica siguen el orden
    # natural de una obra; una nueva va al final (ver app/api/default_phases.py).
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
