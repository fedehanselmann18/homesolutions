"""add orden to fases

Revision ID: b7e21c4f9a3d
Revises: 040b91a97186
Create Date: 2026-08-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7e21c4f9a3d'
down_revision: Union[str, Sequence[str], None] = '040b91a97186'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Nullable primero porque hay que backfillear las fases que ya existen
    # antes de poder poner el NOT NULL.
    op.add_column('fases', sa.Column('orden', sa.Integer(), nullable=True))

    # Numera las fases existentes 1..N por proyecto, en el orden en que se
    # crearon (fecha_creacion, con id como desempate estable si dos fases
    # quedaron con el mismo timestamp).
    op.execute(
        """
        WITH numeradas AS (
            SELECT id, ROW_NUMBER() OVER (
                PARTITION BY proyecto_id ORDER BY fecha_creacion, id
            ) AS rn
            FROM fases
        )
        UPDATE fases
        SET orden = numeradas.rn
        FROM numeradas
        WHERE fases.id = numeradas.id
        """
    )

    op.alter_column('fases', 'orden', nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('fases', 'orden')
