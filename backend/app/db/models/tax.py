import uuid

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk


class Tax(TimestampMixin, Base):
    """IVA, percepciones, IIBB... (se arman en Ajustes).

    - alicuota: porcentaje fijo (21.00, 10.50). Si está, el front calcula el
      monto sobre el neto (y Agus lo puede sobrescribir para igualar el
      redondeo de la factura). Sin alícuota, el monto se tipea a mano.
    - grupo: cómo suma en el Análisis y el PDF ("IVA" junta IVA 21 e IVA
      10,5). Sin grupo, suma por su nombre. Una compra o nota no puede tener
      dos impuestos del mismo grupo: una alícuota de IVA por factura.
    """

    __tablename__ = "impuestos"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    alicuota: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    grupo: Mapped[str | None] = mapped_column(String(50), nullable=True)
