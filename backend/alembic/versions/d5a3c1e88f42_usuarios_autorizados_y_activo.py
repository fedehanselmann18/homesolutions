"""usuarios_autorizados (whitelist en la base) y usuarios.activo

Revision ID: d5a3c1e88f42
Revises: c391f0a2e6b1
Create Date: 2026-08-18 00:00:00.000000

Dos cambios para que la cuenta "Manager" pueda gestionar el equipo desde la
app en vez de por consola/DB directa:

1. usuarios_autorizados: reemplaza a la env var ROLES_PERMITIDOS_JSON. Se
   siembra con el equipo actual que estaba hardcodeado en el default de esa
   variable, así nadie pierde la posibilidad de registrarse por este cambio.
   "Manager" NO va en la semilla a propósito -- esa cuenta se crea solo con
   scripts/crear_usuario_manager.py, nunca por autoregistro.

2. usuarios.activo: baja temporal de una cuenta sin borrarla. server_default
   "true" para que las cuentas que ya existen queden activas.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d5a3c1e88f42"
down_revision: Union[str, Sequence[str], None] = "c391f0a2e6b1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "usuarios_autorizados",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("nombre_usuario", sa.String(length=50), nullable=False),
        sa.Column("rol", sa.String(length=20), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            "fecha_actualizacion", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre_usuario"),
    )

    # Semilla: el equipo que hasta ahora vivía en el default de
    # ROLES_PERMITIDOS_JSON. gen_random_uuid() es nativa de Postgres 13+.
    op.execute("""
        INSERT INTO usuarios_autorizados (id, nombre_usuario, rol)
        VALUES
            (gen_random_uuid(), 'Agustin', 'admin'),
            (gen_random_uuid(), 'Aldana', 'admin'),
            (gen_random_uuid(), 'Alejandro', 'lectura')
        """)

    op.add_column(
        "usuarios",
        sa.Column("activo", sa.Boolean(), server_default="true", nullable=False),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column("usuarios", "activo")
    op.drop_table("usuarios_autorizados")
