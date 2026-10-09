"""alícuota y grupo de impuestos (IVA 21 / 10,5 calculado y agrupado)

Revision ID: c4a8e2f6b1d3
Revises: b7e3c5a1d9f2
Create Date: 2026-10-09 15:00:00.000000

Dos columnas nullable en impuestos: `alicuota` (porcentaje; si está, el front
calcula el monto sobre el neto) y `grupo` (cómo suma en el Análisis: "IVA"
junta IVA 21 e IVA 10,5). No destructiva: los impuestos que ya existen
quedan sin alícuota ni grupo y se siguen cargando a mano, como hasta ahora.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c4a8e2f6b1d3"
down_revision: Union[str, Sequence[str], None] = "b7e3c5a1d9f2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("impuestos", sa.Column("alicuota", sa.Numeric(precision=5, scale=2), nullable=True))
    op.add_column("impuestos", sa.Column("grupo", sa.String(length=50), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("impuestos", "grupo")
    op.drop_column("impuestos", "alicuota")
