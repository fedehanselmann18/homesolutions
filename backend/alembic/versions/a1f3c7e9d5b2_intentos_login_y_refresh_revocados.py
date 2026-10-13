"""intentos_login (bloqueo por cuenta) y refresh_tokens_revocados (logout)

Revision ID: a1f3c7e9d5b2
Revises: d8b1f4a7c2e9
Create Date: 2026-10-13 00:00:00.000000

Dos tablas nuevas, sin tocar nada existente (migración aditiva):
- intentos_login: logins fallidos seguidos por cuenta, para el bloqueo con
  espera creciente (ver app/intentos_login.py).
- refresh_tokens_revocados: jti de los refresh tokens dados de baja con
  /auth/logout (ver routes/login.py).
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1f3c7e9d5b2"
down_revision: Union[str, Sequence[str], None] = "d8b1f4a7c2e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "intentos_login",
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("fallidos", sa.Integer(), server_default="0", nullable=False),
        sa.Column("ultimo_fallo", sa.DateTime(timezone=True), nullable=True),
        sa.Column("bloqueado_hasta", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("usuario_id"),
    )
    op.create_table(
        "refresh_tokens_revocados",
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index(
        op.f("ix_refresh_tokens_revocados_expira_en"),
        "refresh_tokens_revocados",
        ["expira_en"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_refresh_tokens_revocados_expira_en"), table_name="refresh_tokens_revocados")
    op.drop_table("refresh_tokens_revocados")
    op.drop_table("intentos_login")
