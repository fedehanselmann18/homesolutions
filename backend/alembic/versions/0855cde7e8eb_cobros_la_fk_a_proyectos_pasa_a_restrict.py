"""cobros: la FK a proyectos pasa a RESTRICT

Borrar una obra con cobros deja de borrarlos en cascada y pasa a fallar
(decisión de Fede, 25/10/2026): compras y gastos se rehacen, pero la
plata que entró del cliente no se tira por un clic. El error lindo lo da
api/projects.py con un 409; esto es el failsafe de la base.

No toca datos: sólo rehace la constraint (drop + add). Reversible con el
downgrade, que la deja en CASCADE como estaba.

Revision ID: 0855cde7e8eb
Revises: c3f8a2d6e1b7
Create Date: 2026-10-25 22:26:57.196211

"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0855cde7e8eb"
down_revision: Union[str, Sequence[str], None] = "c3f8a2d6e1b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONSTRAINT = "cobros_proyecto_id_fkey"


def upgrade() -> None:
    op.drop_constraint(CONSTRAINT, "cobros", type_="foreignkey")
    op.create_foreign_key(CONSTRAINT, "cobros", "proyectos", ["proyecto_id"], ["id"], ondelete="RESTRICT")


def downgrade() -> None:
    op.drop_constraint(CONSTRAINT, "cobros", type_="foreignkey")
    op.create_foreign_key(CONSTRAINT, "cobros", "proyectos", ["proyecto_id"], ["id"], ondelete="CASCADE")
