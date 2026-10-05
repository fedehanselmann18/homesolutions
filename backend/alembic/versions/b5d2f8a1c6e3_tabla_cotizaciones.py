"""tabla cotizaciones (histórico del dólar, fuente de sugerencia)

Revision ID: b5d2f8a1c6e3
Revises: a3c7e1f9b204
Create Date: 2026-10-05 00:00:00.000000

Ver models.Cotizacion: es de dónde el form precarga el dólar del día. Los
movimientos guardan su propia cotización congelada, así que esta tabla no
tiene FKs entrando ni saliendo.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b5d2f8a1c6e3"
down_revision: Union[str, Sequence[str], None] = "a3c7e1f9b204"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "cotizaciones",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("fecha", sa.Date(), nullable=False),
        sa.Column("tipo", sa.String(length=20), nullable=False),
        sa.Column("valor", sa.Numeric(precision=12, scale=4), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column(
            "fecha_actualizacion", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fecha", "tipo", name="uq_cotizacion_fecha_tipo"),
    )
    op.create_index(op.f("ix_cotizaciones_fecha"), "cotizaciones", ["fecha"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_cotizaciones_fecha"), table_name="cotizaciones")
    op.drop_table("cotizaciones")
