"""configuracion (clave/valor editable desde la app)

Revision ID: e1d94a2c7f83
Revises: c8a1f6d20b45
Create Date: 2026-08-21 00:00:00.000000

Tabla clave/valor para settings editables desde Manager sin redeployar (ver
models.Configuracion y app/configuracion.py). Arranca vacía a propósito: sin
fila para una clave, el valor efectivo sigue siendo el de Settings/.env --
no hay nada que sembrar acá, a diferencia de la whitelist de autoregistro
(migración d5a3c1e88f42).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e1d94a2c7f83"
down_revision: Union[str, Sequence[str], None] = "c8a1f6d20b45"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "configuracion",
        sa.Column("clave", sa.String(length=100), nullable=False),
        sa.Column("valor", sa.String(length=500), nullable=False),
        sa.Column(
            "fecha_actualizacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("clave"),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("configuracion")
