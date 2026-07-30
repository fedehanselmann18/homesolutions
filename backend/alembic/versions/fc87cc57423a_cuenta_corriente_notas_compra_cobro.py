"""Cuenta corriente: notas_compra / notas_cobro (revierte tipo/monto de comprobantes)

Revision ID: fc87cc57423a
Revises: ee08610aee51
Create Date: 2026-07-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fc87cc57423a'
down_revision: Union[str, Sequence[str], None] = 'ee08610aee51'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # comprobantes_compra/comprobantes_cobro vuelven a ser solo el archivo --
    # el tipo/monto de nota de crédito pasa a vivir en las tablas nuevas.
    op.drop_column('comprobantes_compra', 'monto')
    op.drop_column('comprobantes_compra', 'tipo')
    op.drop_column('comprobantes_cobro', 'monto')
    op.drop_column('comprobantes_cobro', 'tipo')

    op.create_table(
        'notas_compra',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('compra_id', sa.Uuid(), nullable=False),
        sa.Column('proveedor_id', sa.Uuid(), nullable=False),
        sa.Column('detalle_compra_id', sa.Uuid(), nullable=True),
        sa.Column('usuario_id', sa.Uuid(), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('origen', sa.String(length=30), nullable=True),
        sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('descripcion', sa.String(length=500), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('archivo_path', sa.String(length=500), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('fecha_actualizacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['compra_id'], ['compras.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['proveedor_id'], ['proveedores.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['detalle_compra_id'], ['detalle_compra.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )

    op.create_table(
        'notas_cobro',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('cobro_id', sa.Uuid(), nullable=False),
        sa.Column('proyecto_id', sa.Uuid(), nullable=False),
        sa.Column('usuario_id', sa.Uuid(), nullable=False),
        sa.Column('tipo', sa.String(length=20), nullable=False),
        sa.Column('origen', sa.String(length=30), nullable=True),
        sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('descripcion', sa.String(length=500), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('archivo_path', sa.String(length=500), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('fecha_actualizacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['cobro_id'], ['cobros.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['proyecto_id'], ['proyectos.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('notas_cobro')
    op.drop_table('notas_compra')

    op.add_column('comprobantes_cobro', sa.Column('tipo', sa.String(length=20), nullable=False, server_default='factura'))
    op.add_column('comprobantes_cobro', sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=True))
    op.add_column('comprobantes_compra', sa.Column('tipo', sa.String(length=20), nullable=False, server_default='factura'))
    op.add_column('comprobantes_compra', sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=True))
