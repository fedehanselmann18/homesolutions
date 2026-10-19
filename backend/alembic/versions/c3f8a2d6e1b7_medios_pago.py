"""medios de pago configurables (FK por código en compras y gastos)

Revision ID: c3f8a2d6e1b7
Revises: b7d2e5f8a1c3
Create Date: 2026-10-19 12:00:00.000000

Los medios de pago dejan de ser una lista fija del front y pasan a la tabla
medios_pago (se administran desde Ajustes). compras.medio_pago y
gastos.medio_pago NO cambian: siguen siendo texto nullable con el código
(efectivo, transferencia...), ahora con FK a medios_pago.codigo (RESTRICT).

No destructiva: crea la tabla, siembra los 4 medios de siempre con el mismo
código que ya guardan los movimientos (así no hay migración de datos) y,
antes de crear las FKs, suma como medio cualquier otro valor que ya exista
en las columnas, para que la FK nunca falle al aplicarse.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c3f8a2d6e1b7"
down_revision: Union[str, Sequence[str], None] = "b7d2e5f8a1c3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

MEDIOS_DE_FABRICA = [
    ("efectivo", "Efectivo"),
    ("transferencia", "Transferencia"),
    ("cheque", "Cheque"),
    ("tarjeta", "Tarjeta"),
]

TABLAS_CON_MEDIO = ["compras", "gastos"]


def _nombre_fk(tabla: str) -> str:
    return f"fk_{tabla}_medio_pago"


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "medios_pago",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(length=30), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "fecha_actualizacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("codigo"),
        sa.UniqueConstraint("nombre"),
    )
    op.execute(
        sa.text(
            "INSERT INTO medios_pago (id, codigo, nombre, orden) "
            "SELECT gen_random_uuid(), codigo, nombre, orden "
            "FROM unnest(CAST(:codigos AS text[]), CAST(:nombres AS text[])) "
            "WITH ORDINALITY AS t(codigo, nombre, orden)"
        ).bindparams(
            codigos=[c for c, _ in MEDIOS_DE_FABRICA],
            nombres=[n for _, n in MEDIOS_DE_FABRICA],
        )
    )

    # Cualquier otro valor ya cargado (datos de dev) se suma como medio, con
    # código = nombre = valor, al final. Si el nombre choca con uno de fábrica
    # (ej. "Efectivo" con mayúscula), el nombre lleva el código para no violar
    # el UNIQUE. Los valores vacíos ("") también se tratan como "sin medio".
    op.execute("UPDATE compras SET medio_pago = NULL WHERE medio_pago = ''")
    op.execute("UPDATE gastos SET medio_pago = NULL WHERE medio_pago = ''")
    valores = " UNION ".join(
        f"SELECT medio_pago AS valor FROM {t} WHERE medio_pago IS NOT NULL" for t in TABLAS_CON_MEDIO
    )
    op.execute(
        sa.text(
            "INSERT INTO medios_pago (id, codigo, nombre, orden) "
            "SELECT gen_random_uuid(), v.valor, "
            "  CASE WHEN EXISTS (SELECT 1 FROM medios_pago x WHERE x.nombre = v.valor) "
            "       THEN v.valor || ' (' || v.valor || ')' ELSE v.valor END, "
            f"  {len(MEDIOS_DE_FABRICA)} + row_number() OVER (ORDER BY v.valor) "
            f"FROM ({valores}) v "
            "WHERE NOT EXISTS (SELECT 1 FROM medios_pago m WHERE m.codigo = v.valor)"
        )
    )

    for tabla in TABLAS_CON_MEDIO:
        op.create_foreign_key(
            _nombre_fk(tabla), tabla, "medios_pago", ["medio_pago"], ["codigo"], ondelete="RESTRICT"
        )


def downgrade() -> None:
    """Downgrade schema."""
    for tabla in TABLAS_CON_MEDIO:
        op.drop_constraint(_nombre_fk(tabla), tabla, type_="foreignkey")
    op.drop_table("medios_pago")
