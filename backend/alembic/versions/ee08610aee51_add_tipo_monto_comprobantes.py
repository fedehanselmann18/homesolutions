"""Add tipo/monto a comprobantes_compra y comprobantes_cobro (notas de credito)

Revision ID: ee08610aee51
Revises: 1d4d35c07792
Create Date: 2026-07-30 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ee08610aee51'
down_revision: Union[str, Sequence[str], None] = '1d4d35c07792'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # comprobantes_compra: tipo ("factura" | "nota_credito") + monto (solo si nota_credito)
    op.add_column(
        'comprobantes_compra',
        sa.Column('tipo', sa.String(length=20), nullable=False, server_default='factura'),
    )
    op.add_column(
        'comprobantes_compra',
        sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=True),
    )

    # comprobantes_cobro: mismos campos, mismo criterio
    op.add_column(
        'comprobantes_cobro',
        sa.Column('tipo', sa.String(length=20), nullable=False, server_default='factura'),
    )
    op.add_column(
        'comprobantes_cobro',
        sa.Column('monto', sa.Numeric(precision=12, scale=2), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('comprobantes_cobro', 'monto')
    op.drop_column('comprobantes_cobro', 'tipo')
    op.drop_column('comprobantes_compra', 'monto')
    op.drop_column('comprobantes_compra', 'tipo')
