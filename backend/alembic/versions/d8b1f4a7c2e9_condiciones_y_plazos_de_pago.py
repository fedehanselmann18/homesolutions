"""condiciones de pago en plazos (30/60/90...) para compras y gastos

Revision ID: d8b1f4a7c2e9
Revises: c4a8e2f6b1d3
Create Date: 2026-10-09 17:00:00.000000

- Tabla condiciones_pago (Ajustes) sembrada con Contado (protegido), 30, 60,
  90, 30/60, 30/60/90 y 30/60/90/120 días.
- Tabla plazos_pago: los pagos de cada compra o gasto, con vencimiento y
  pagado/fecha de pago propios.
- compras.condicion_pago era en realidad el MEDIO de pago: se renombra a
  medio_pago (contado -> efectivo, cuenta_corriente -> vacío, cheque y
  transferencia igual) y se suma condicion_pago_id (todas Contado).
- gastos suma condicion_pago_id (Contado), medio_pago y estado_pago (pagado:
  hasta ahora un gasto se daba por pagado al cargarlo).
- Cada compra y cada gasto que ya existe queda con un plazo Contado por su
  total, pagado si estaba pagado (en la fecha del movimiento).

No borra datos: el downgrade vuelve medio_pago a condicion_pago con los
valores de antes (efectivo -> contado, vacío -> cuenta_corriente).
"""

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "d8b1f4a7c2e9"
down_revision: Union[str, Sequence[str], None] = "c4a8e2f6b1d3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# (nombre, días, protegido) en el orden del select.
CONDICIONES_DE_FABRICA = [
    ("Contado", [], True),
    ("30 días", [30], False),
    ("60 días", [60], False),
    ("90 días", [90], False),
    ("30/60 días", [30, 60], False),
    ("30/60/90 días", [30, 60, 90], False),
    ("30/60/90/120 días", [30, 60, 90, 120], False),
]


def _timestamps():
    return [
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "fecha_actualizacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    ]


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "condiciones_pago",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("dias", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("orden", sa.Integer(), nullable=False),
        sa.Column("protegido", sa.Boolean(), nullable=False),
        *_timestamps(),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre"),
    )
    tabla = sa.table(
        "condiciones_pago",
        sa.column("id", sa.Uuid()),
        sa.column("nombre", sa.String()),
        sa.column("dias", postgresql.JSONB()),
        sa.column("orden", sa.Integer()),
        sa.column("protegido", sa.Boolean()),
    )
    contado_id = uuid.uuid4()
    op.bulk_insert(
        tabla,
        [
            {
                "id": contado_id if protegido else uuid.uuid4(),
                "nombre": nombre,
                "dias": dias,
                "orden": orden,
                "protegido": protegido,
            }
            for orden, (nombre, dias, protegido) in enumerate(CONDICIONES_DE_FABRICA, start=1)
        ],
    )

    op.create_table(
        "plazos_pago",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("compra_id", sa.Uuid(), nullable=True),
        sa.Column("gasto_id", sa.Uuid(), nullable=True),
        sa.Column("numero", sa.Integer(), nullable=False),
        sa.Column("dias", sa.Integer(), nullable=False),
        sa.Column("fecha_vencimiento", sa.Date(), nullable=False),
        sa.Column("monto", sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column("pagado", sa.Boolean(), nullable=False),
        sa.Column("fecha_pago", sa.Date(), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("(compra_id IS NULL) <> (gasto_id IS NULL)", name="ck_plazos_pago_compra_o_gasto"),
        sa.ForeignKeyConstraint(["compra_id"], ["compras.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["gasto_id"], ["gastos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_plazos_pago_compra_id", "plazos_pago", ["compra_id"])
    op.create_index("ix_plazos_pago_gasto_id", "plazos_pago", ["gasto_id"])
    op.create_index("ix_plazos_pago_fecha_vencimiento", "plazos_pago", ["fecha_vencimiento"])

    # --- Compras: condicion_pago (era el medio) -> medio_pago ---------------
    op.alter_column("compras", "condicion_pago", new_column_name="medio_pago", nullable=True)
    op.execute(
        "UPDATE compras SET medio_pago = CASE medio_pago "
        "WHEN 'contado' THEN 'efectivo' WHEN 'cuenta_corriente' THEN NULL ELSE medio_pago END"
    )
    op.add_column("compras", sa.Column("condicion_pago_id", sa.Uuid(), nullable=True))
    op.execute(sa.text("UPDATE compras SET condicion_pago_id = :id").bindparams(id=contado_id))
    op.alter_column("compras", "condicion_pago_id", nullable=False)
    op.create_foreign_key(
        "fk_compras_condicion_pago",
        "compras",
        "condiciones_pago",
        ["condicion_pago_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # --- Gastos: condición, medio y estado ----------------------------------
    op.add_column("gastos", sa.Column("condicion_pago_id", sa.Uuid(), nullable=True))
    op.add_column("gastos", sa.Column("medio_pago", sa.String(length=30), nullable=True))
    op.add_column(
        "gastos", sa.Column("estado_pago", sa.String(length=20), nullable=False, server_default="pagado")
    )
    op.alter_column("gastos", "estado_pago", server_default=None)
    op.execute(sa.text("UPDATE gastos SET condicion_pago_id = :id").bindparams(id=contado_id))
    op.alter_column("gastos", "condicion_pago_id", nullable=False)
    op.create_foreign_key(
        "fk_gastos_condicion_pago",
        "gastos",
        "condiciones_pago",
        ["condicion_pago_id"],
        ["id"],
        ondelete="RESTRICT",
    )

    # --- Un plazo Contado por cada movimiento que ya existe -----------------
    # Total de la compra = neto + impuestos - notas de crédito + notas de
    # débito (lo mismo que Compra.precio_total_ars).
    op.execute("""
        INSERT INTO plazos_pago (id, compra_id, numero, dias, fecha_vencimiento, monto, pagado, fecha_pago)
        SELECT gen_random_uuid(), c.id, 1, 0, c.fecha,
               c.precio_neto_ars
               + COALESCE((SELECT SUM(ci.monto) FROM compra_impuesto ci WHERE ci.compra_id = c.id), 0)
               - COALESCE((SELECT SUM(n.monto_ars) FROM notas_compra n
                           WHERE n.compra_id = c.id AND n.tipo = 'nota_credito'), 0)
               + COALESCE((SELECT SUM(n.monto_ars) FROM notas_compra n
                           WHERE n.compra_id = c.id AND n.tipo = 'nota_debito'), 0),
               c.estado_pago = 'pagado',
               CASE WHEN c.estado_pago = 'pagado' THEN c.fecha END
        FROM compras c
        """)
    op.execute("""
        INSERT INTO plazos_pago (id, gasto_id, numero, dias, fecha_vencimiento, monto, pagado, fecha_pago)
        SELECT gen_random_uuid(), g.id, 1, 0, g.fecha, g.monto_ars, true, g.fecha
        FROM gastos g
        """)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_gastos_condicion_pago", "gastos", type_="foreignkey")
    op.drop_column("gastos", "estado_pago")
    op.drop_column("gastos", "medio_pago")
    op.drop_column("gastos", "condicion_pago_id")

    op.drop_constraint("fk_compras_condicion_pago", "compras", type_="foreignkey")
    op.drop_column("compras", "condicion_pago_id")
    op.execute(
        "UPDATE compras SET medio_pago = CASE "
        "WHEN medio_pago = 'efectivo' THEN 'contado' WHEN medio_pago IS NULL THEN 'cuenta_corriente' "
        "WHEN medio_pago = 'tarjeta' THEN 'contado' ELSE medio_pago END"
    )
    op.alter_column("compras", "medio_pago", new_column_name="condicion_pago", nullable=False)

    op.drop_index("ix_plazos_pago_fecha_vencimiento", table_name="plazos_pago")
    op.drop_index("ix_plazos_pago_gasto_id", table_name="plazos_pago")
    op.drop_index("ix_plazos_pago_compra_id", table_name="plazos_pago")
    op.drop_table("plazos_pago")
    op.drop_table("condiciones_pago")
