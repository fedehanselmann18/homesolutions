"""renombrar proyectos.precio_acordado a precio_acordado_usd

Revision ID: a3c7e1f9b204
Revises: f4b83c2e910a
Create Date: 2026-10-05 00:00:00.000000

Solo el nombre, sin tocar los datos: el campo nunca dijo su moneda y eso es
lo que originó el plan de tipo de cambio. El precio se acuerda en dólares, así que el nombre lo dice.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3c7e1f9b204"
down_revision: Union[str, Sequence[str], None] = "f4b83c2e910a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.alter_column("proyectos", "precio_acordado", new_column_name="precio_acordado_usd")


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column("proyectos", "precio_acordado_usd", new_column_name="precio_acordado")
