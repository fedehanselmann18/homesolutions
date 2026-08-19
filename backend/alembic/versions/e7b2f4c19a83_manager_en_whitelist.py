"""Manager entra a la whitelist de autoregistro

Revision ID: e7b2f4c19a83
Revises: d5a3c1e88f42
Create Date: 2026-08-19 00:00:00.000000

Hasta esta migración la cuenta "Manager" se creaba únicamente por consola
(scripts/crear_usuario_manager.py) y quedaba fuera de los dos combos
públicos. Decisión del dueño del proyecto: crearla desde /registro como
cualquier otra cuenta, para no depender de tener acceso a la base.

Esto abre una ventana: mientras "Manager" esté autorizado y todavía sin
cuenta, aparece en el combo público de /registro y CUALQUIERA puede
quedársela poniéndole la contraseña que quiera (POST /usuarios/crear no
pide login). La ventana se cierra sola en cuanto la cuenta existe --
get_opciones_registro solo lista autorizados sin cuenta -- así que hay que
registrarla apenas termine el deploy que aplica esta migración.

La fila NO se borra al registrarse (igual que el resto de la whitelist) y
revocar_autorizacion la protege: es lo que permite recrear la cuenta si se
pierde la contraseña, borrando la fila de "usuarios" y volviendo a
registrarse desde el navegador.
"""

from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e7b2f4c19a83"
down_revision: Union[str, Sequence[str], None] = "d5a3c1e88f42"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # ON CONFLICT DO NOTHING: la fila puede existir ya si alguien la cargó a
    # mano antes de este deploy -- reaplicar la migración no tiene que
    # explotar por eso.
    op.execute("""
        INSERT INTO usuarios_autorizados (id, nombre_usuario, rol)
        VALUES (gen_random_uuid(), 'Manager', 'lectura')
        ON CONFLICT (nombre_usuario) DO NOTHING
        """)


def downgrade() -> None:
    """Downgrade schema."""
    # Solo saca la autorización: si la cuenta ya se creó, sigue existiendo y
    # funcionando (esta migración nunca tocó la tabla "usuarios").
    op.execute("DELETE FROM usuarios_autorizados WHERE nombre_usuario = 'Manager'")
