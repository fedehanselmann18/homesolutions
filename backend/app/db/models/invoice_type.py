import uuid

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk


class InvoiceType(TimestampMixin, Base):
    """Tipo de comprobante (Factura A, Remito, Factura interna...): las
    opciones del select de compras, gastos, cobros y notas. Se administran
    desde Ajustes.

    Los movimientos guardan el `codigo` (no el id) con FK RESTRICT: renombrar
    cambia la etiqueta en todo el historial sin tocar los movimientos, y no
    se puede borrar un tipo en uso. El código se arma del nombre al crear y
    no cambia nunca (ver app/domain/invoice_types.py)."""

    __tablename__ = "tipos_factura"

    id: Mapped[uuid.UUID] = uuid_pk()
    codigo: Mapped[str] = mapped_column(String(30), unique=True, nullable=False)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    # Posición en el select; uno nuevo va al final ("Otros" igual sale último,
    # ver app/domain/invoice_types.py).
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
