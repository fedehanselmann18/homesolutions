"""Notas: detalle multi-producto + impuestos en devoluciones, tipo_factura obligatorio

Revision ID: a4d8f1c9b2e7
Revises: fc87cc57423a
Create Date: 2026-07-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a4d8f1c9b2e7'
down_revision: Union[str, Sequence[str], None] = 'fc87cc57423a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Una nota de devolución ahora puede traer varios productos (antes era un
    # solo detalle_compra_id por nota) -> se saca esa columna de notas_compra
    # y se reemplaza por la tabla notas_compra_detalle (uno-a-muchos).
    op.drop_column('notas_compra', 'detalle_compra_id')

    op.create_table(
        'notas_compra_detalle',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('nota_id', sa.Uuid(), nullable=False),
        sa.Column('detalle_compra_id', sa.Uuid(), nullable=True),
        sa.Column('cantidad', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('precio_unitario', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('fecha_actualizacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['nota_id'], ['notas_compra.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['detalle_compra_id'], ['detalle_compra.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'nota_compra_impuesto',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('nota_id', sa.Uuid(), nullable=False),
        sa.Column('impuesto_id', sa.Uuid(), nullable=False),
        sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('fecha_actualizacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['nota_id'], ['notas_compra.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['impuesto_id'], ['impuestos.id'], ondelete='RESTRICT'),
        sa.UniqueConstraint('nota_id', 'impuesto_id', name='uq_nota_compra_impuesto'),
        sa.PrimaryKeyConstraint('id'),
    )

    # tipo_factura pasa a ser SIEMPRE obligatorio en toda nota (crédito o
    # débito, cualquier origen) -- server_default solo para no romper filas
    # que ya existan; se saca el default después así los inserts nuevos
    # tienen que mandarlo sí o sí (igual que el resto de los campos NOT NULL).
    op.add_column('notas_compra', sa.Column('tipo_factura', sa.String(length=30), nullable=False, server_default='otros'))
    op.alter_column('notas_compra', 'tipo_factura', server_default=None)

    op.add_column('notas_cobro', sa.Column('tipo_factura', sa.String(length=30), nullable=False, server_default='otros'))
    op.alter_column('notas_cobro', 'tipo_factura', server_default=None)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('notas_cobro', 'tipo_factura')
    op.drop_column('notas_compra', 'tipo_factura')

    op.drop_table('nota_compra_impuesto')
    op.drop_table('notas_compra_detalle')

    op.add_column('notas_compra', sa.Column('detalle_compra_id', sa.Uuid(), nullable=True))
    op.create_foreign_key(
        'notas_compra_detalle_compra_id_fkey',
        'notas_compra', 'detalle_compra',
        ['detalle_compra_id'], ['id'],
        ondelete='SET NULL',
    )
