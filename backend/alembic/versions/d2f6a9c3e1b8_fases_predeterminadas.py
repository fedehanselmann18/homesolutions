"""fases predeterminadas (opciones del select del modal de fase)

Revision ID: d2f6a9c3e1b8
Revises: c9e4a7b3d1f0
Create Date: 2026-10-08 22:30:00.000000

Nombres sugeridos para las fases de una obra (ver models.FasePredeterminada).
Se siembran las nueve etapas de una obra de climatización, en el orden en que
se hacen, más Calefacción al final. Después se agregan, renombran o borran
desde Ajustes, pestaña «Fases predeterminadas».
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2f6a9c3e1b8"
down_revision: Union[str, Sequence[str], None] = "c9e4a7b3d1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

FASES_DE_FABRICA = [
    "Relevamiento y anteproyecto",
    "Ingeniería de detalle",
    "Provisión y logística de equipos y materiales",
    "Montaje de unidades interiores",
    "Montaje de cañerías y aislaciones",
    "Armado + montaje de conductos y flexibles",
    "Instalación de unidades exteriores",
    "Colocación de difusores lineales",
    "Puesta en marcha y ensayos",
    "Calefacción",
]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "fases_predeterminadas",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(length=150), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "fecha_actualizacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )
    op.execute(
        sa.text(
            "INSERT INTO fases_predeterminadas (id, nombre, orden) "
            "SELECT gen_random_uuid(), nombre, orden FROM unnest(CAST(:nombres AS text[])) "
            "WITH ORDINALITY AS t(nombre, orden)"
        ).bindparams(nombres=FASES_DE_FABRICA)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table("fases_predeterminadas")
