"""tipos de factura configurables (FK por código en los movimientos)

Revision ID: b7e3c5a1d9f2
Revises: d2f6a9c3e1b8
Create Date: 2026-10-09 13:00:00.000000

Los tipos de factura dejan de ser una lista fija en el código y pasan a la
tabla tipos_factura (se administran desde Ajustes). Las cinco columnas
tipo_factura NO cambian: siguen guardando el código (factura_a, remito...),
ahora con FK a tipos_factura.codigo (RESTRICT).

No destructiva: crea la tabla, siembra los tipos de fábrica + «Factura
interna», y antes de crear las FKs suma como tipo cualquier valor que ya
exista en las columnas y no esté en la lista (datos de dev), para que la FK
nunca falle al aplicarse.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7e3c5a1d9f2"
down_revision: Union[str, Sequence[str], None] = "d2f6a9c3e1b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (código, nombre) en el orden del select. «Otros» va último.
TIPOS_DE_FABRICA = [
    ("factura_a", "Factura A"),
    ("factura_b", "Factura B"),
    ("factura_c", "Factura C"),
    ("remito", "Remito"),
    ("recibo", "Recibo"),
    ("factura_interna", "Factura interna"),
    ("otros", "Otros"),
]

TABLAS_CON_TIPO = ["compras", "notas_compra", "gastos", "cobros", "notas_cobro"]


def _nombre_fk(tabla: str) -> str:
    return f"fk_{tabla}_tipo_factura"


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "tipos_factura",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("codigo", sa.String(length=30), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
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
            "INSERT INTO tipos_factura (id, codigo, nombre, orden) "
            "SELECT gen_random_uuid(), codigo, nombre, orden "
            "FROM unnest(CAST(:codigos AS text[]), CAST(:nombres AS text[])) "
            "WITH ORDINALITY AS t(codigo, nombre, orden)"
        ).bindparams(
            codigos=[c for c, _ in TIPOS_DE_FABRICA],
            nombres=[n for _, n in TIPOS_DE_FABRICA],
        )
    )

    # Valores que ya estén cargados y no sean de fábrica (en dev hay "A",
    # "nota_credito_a"...): se suman como tipo con código = nombre = valor,
    # al final. Si el valor choca con un nombre de fábrica (ej. alguien
    # guardó "Remito" como texto), el nombre lleva el código para no violar
    # el UNIQUE.
    valores = " UNION ".join(f"SELECT tipo_factura AS valor FROM {t}" for t in TABLAS_CON_TIPO)
    op.execute(
        sa.text(
            "INSERT INTO tipos_factura (id, codigo, nombre, orden) "
            "SELECT gen_random_uuid(), v.valor, "
            "  CASE WHEN EXISTS (SELECT 1 FROM tipos_factura x WHERE x.nombre = v.valor) "
            "       THEN v.valor || ' (' || v.valor || ')' ELSE v.valor END, "
            f"  {len(TIPOS_DE_FABRICA)} + row_number() OVER (ORDER BY v.valor) "
            f"FROM ({valores}) v "
            "WHERE NOT EXISTS (SELECT 1 FROM tipos_factura t WHERE t.codigo = v.valor)"
        )
    )

    for tabla in TABLAS_CON_TIPO:
        op.create_foreign_key(
            _nombre_fk(tabla), tabla, "tipos_factura", ["tipo_factura"], ["codigo"], ondelete="RESTRICT"
        )


def downgrade() -> None:
    """Downgrade schema."""
    for tabla in TABLAS_CON_TIPO:
        op.drop_constraint(_nombre_fk(tabla), tabla, type_="foreignkey")
    op.drop_table("tipos_factura")
