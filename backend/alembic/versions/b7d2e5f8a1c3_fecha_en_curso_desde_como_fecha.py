"""fases.fecha_en_curso_desde pasa de timestamptz a date

Revision ID: b7d2e5f8a1c3
Revises: a1f3c7e9d5b2
Create Date: 2026-10-15 00:00:00.000000

"En curso desde" deja de ser el instante en que se tocó el estado y pasa a
ser una fecha que elige el usuario (o la del primer movimiento que arrancó
la fase), como `fecha` en compras y gastos. Cada valor existente se
convierte al día de Argentina en que cayó: no se pierde nada salvo la hora,
que no se usaba (el front sólo cuenta días).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7d2e5f8a1c3"
down_revision: Union[str, Sequence[str], None] = "a1f3c7e9d5b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "fases",
        "fecha_en_curso_desde",
        type_=sa.Date(),
        existing_type=sa.DateTime(timezone=True),
        existing_nullable=True,
        postgresql_using="(fecha_en_curso_desde AT TIME ZONE 'America/Argentina/Buenos_Aires')::date",
    )


def downgrade() -> None:
    op.alter_column(
        "fases",
        "fecha_en_curso_desde",
        type_=sa.DateTime(timezone=True),
        existing_type=sa.Date(),
        existing_nullable=True,
        postgresql_using="fecha_en_curso_desde::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'",
    )
