"""add fecha_en_curso_desde to fases

Revision ID: c391f0a2e6b1
Revises: b7e21c4f9a3d
Create Date: 2026-08-18 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c391f0a2e6b1'
down_revision: Union[str, Sequence[str], None] = 'b7e21c4f9a3d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('fases', sa.Column('fecha_en_curso_desde', sa.DateTime(timezone=True), nullable=True))

    # Backfill: para las fases que HOY están en_curso no sabemos el momento
    # exacto en que entraron (ese dato no se guardaba antes), así que se usa
    # fecha_actualizacion como mejor aproximación disponible -- es el mismo
    # dato que se venía usando (mal) para "días en curso" hasta ahora, pero
    # de acá en adelante fecha_en_curso_desde ya no se pisa con ediciones
    # que no cambian el estado.
    op.execute(
        """
        UPDATE fases
        SET fecha_en_curso_desde = fecha_actualizacion
        WHERE estado = 'en_curso'
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('fases', 'fecha_en_curso_desde')
