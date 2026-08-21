"""auditoria persistida (tabla consultable desde la app)

Revision ID: c8a1f6d20b45
Revises: a9c4e21b7f30
Create Date: 2026-08-21 00:00:00.000000

Hasta acá la auditoría (app/audit.py y _log_accion_manager en
routes/usuarios.py) solo escribía al logger del servidor: para saber quién
borró un proyecto había que entrar a los logs de Railway. Esta tabla es lo
que hace esa pregunta contestable desde la app (GET /auditoria, solo la
cuenta "Manager").

No hay backfill posible: lo anterior a esta migración vive únicamente en los
logs del servidor.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "c8a1f6d20b45"
down_revision: Union[str, Sequence[str], None] = "a9c4e21b7f30"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "auditoria",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("usuario_id", sa.Uuid(), nullable=False),
        sa.Column("accion", sa.String(length=50), nullable=False),
        sa.Column("tipo_recurso", sa.String(length=50), nullable=False),
        # Sin FK a propósito (ver models.Auditoria): la mitad de estas filas
        # registran un borrado, así que el recurso ya no existe.
        sa.Column("recurso_id", sa.String(length=100), nullable=True),
        sa.Column("detalle", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["usuarios.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    # Los tres filtros del listado de Manager: por usuario, por tipo de
    # recurso y por rango de fechas (que además es el orden por default).
    op.create_index(op.f("ix_auditoria_usuario_id"), "auditoria", ["usuario_id"])
    op.create_index(op.f("ix_auditoria_tipo_recurso"), "auditoria", ["tipo_recurso"])
    op.create_index(op.f("ix_auditoria_creado_en"), "auditoria", ["creado_en"])


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_auditoria_creado_en"), table_name="auditoria")
    op.drop_index(op.f("ix_auditoria_tipo_recurso"), table_name="auditoria")
    op.drop_index(op.f("ix_auditoria_usuario_id"), table_name="auditoria")
    op.drop_table("auditoria")
