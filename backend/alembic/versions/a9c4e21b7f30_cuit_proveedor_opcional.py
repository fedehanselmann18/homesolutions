"""cuit de proveedor opcional

Revision ID: a9c4e21b7f30
Revises: e7b2f4c19a83
Create Date: 2026-08-20 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a9c4e21b7f30'
down_revision: Union[str, Sequence[str], None] = 'e7b2f4c19a83'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Hay proveedores (distribuidoras chicas, comercios) de los que no se
    # tiene el CUIT y no poder cargarlos por eso no tiene sentido.
    op.alter_column('proveedores', 'cuit', existing_type=sa.String(length=20), nullable=True)


def downgrade() -> None:
    """Downgrade schema."""
    # Para volver atrás hay que poder poner el NOT NULL: los proveedores que
    # quedaron sin CUIT no tienen un valor real con el que backfillear, así
    # que se marcan explícitamente en vez de inventar un número que parezca
    # un CUIT válido.
    op.execute("UPDATE proveedores SET cuit = 'SIN CUIT' WHERE cuit IS NULL")
    op.alter_column('proveedores', 'cuit', existing_type=sa.String(length=20), nullable=False)
