"""ultima_actividad en usuarios (visto por última vez)

Revision ID: f4b83c2e910a
Revises: e1d94a2c7f83
Create Date: 2026-08-21 00:00:00.000000

Columna nullable: las cuentas ya existentes arrancan en NULL ("nunca visto
desde que existe esta columna") hasta su próximo request autenticado. Ver
models.Usuario para el comentario completo sobre por qué el UPDATE que la
pisa tiene que neutralizar onupdate de fecha_actualizacion a mano.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f4b83c2e910a"
down_revision: Union[str, Sequence[str], None] = "e1d94a2c7f83"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("usuarios", sa.Column("ultima_actividad", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("usuarios", "ultima_actividad")
