"""doble moneda en los movimientos de plata (cotización congelada + ARS/USD)

Revision ID: c9e4a7b3d1f0
Revises: b5d2f8a1c6e3
Create Date: 2026-10-05 00:00:00.000000

Ver docs/PLAN_TIPO_CAMBIO.md §4.2. Compras, gastos, cobros y notas pasan a
guardar cotizacion_dolar + tipo_cambio y las dos cifras (ARS y USD).

Columnas NOT NULL y SIN backfill (decisión #7): la base de producción está
vacía y la local se resetea. Inventar el dólar histórico de un movimiento
ya cargado sería peor que no tenerlo (caveat 6.1). Por eso la migración
NO convierte datos: si encuentra movimientos cargados, frena con un mensaje
claro en vez de dejarlos con una cotización inventada.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c9e4a7b3d1f0"
down_revision: Union[str, Sequence[str], None] = "b5d2f8a1c6e3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLAS_CON_PLATA = ("compras", "gastos", "cobros", "notas_compra", "notas_cobro")


def _exigir_tablas_vacias() -> None:
    conexion = op.get_bind()
    con_filas = [
        tabla for tabla in _TABLAS_CON_PLATA if conexion.execute(sa.text(f"SELECT 1 FROM {tabla} LIMIT 1")).first()
    ]
    if con_filas:
        raise RuntimeError(
            "Esta migración necesita las tablas de movimientos vacías (sin backfill, ver "
            f"docs/PLAN_TIPO_CAMBIO.md decisión #7), y estas tienen filas: {', '.join(con_filas)}. "
            "Vacialas (o reseteá la base local) y volvé a correr alembic upgrade head."
        )


def _cotizacion_congelada(tabla: str) -> None:
    op.add_column(tabla, sa.Column("cotizacion_dolar", sa.Numeric(precision=12, scale=4), nullable=False))
    op.add_column(tabla, sa.Column("tipo_cambio", sa.String(length=20), nullable=False))


def upgrade() -> None:
    """Upgrade schema."""
    _exigir_tablas_vacias()

    # Proyecto: solo trazabilidad del dólar de la firma, nullable.
    op.add_column("proyectos", sa.Column("cotizacion_acordada", sa.Numeric(precision=12, scale=4), nullable=True))
    op.add_column("proyectos", sa.Column("tipo_cambio_acordado", sa.String(length=20), nullable=True))

    # Se tipea en ARS, el USD lo congela el backend.
    op.drop_column("compras", "precio_neto")
    op.add_column("compras", sa.Column("precio_neto_ars", sa.Numeric(precision=14, scale=2), nullable=False))
    op.add_column("compras", sa.Column("precio_neto_usd", sa.Numeric(precision=12, scale=2), nullable=False))
    _cotizacion_congelada("compras")

    for tabla in ("gastos", "notas_compra"):
        op.drop_column(tabla, "monto")
        op.add_column(tabla, sa.Column("monto_ars", sa.Numeric(precision=14, scale=2), nullable=False))
        op.add_column(tabla, sa.Column("monto_usd", sa.Numeric(precision=12, scale=2), nullable=False))
        _cotizacion_congelada(tabla)

    # Se tipea en USD, el ARS lo congela el backend.
    for tabla in ("cobros", "notas_cobro"):
        op.drop_column(tabla, "monto")
        op.add_column(tabla, sa.Column("monto_usd", sa.Numeric(precision=12, scale=2), nullable=False))
        op.add_column(tabla, sa.Column("monto_ars", sa.Numeric(precision=14, scale=2), nullable=False))
        _cotizacion_congelada(tabla)

    # Impuestos: siguen en pesos, con margen para montos grandes (6.6).
    for tabla in ("compra_impuesto", "nota_compra_impuesto"):
        op.alter_column(
            tabla,
            "monto",
            existing_type=sa.Numeric(precision=12, scale=2),
            type_=sa.Numeric(precision=14, scale=2),
            existing_nullable=False,
        )


def downgrade() -> None:
    """Downgrade schema."""
    _exigir_tablas_vacias()

    for tabla in ("compra_impuesto", "nota_compra_impuesto"):
        op.alter_column(
            tabla,
            "monto",
            existing_type=sa.Numeric(precision=14, scale=2),
            type_=sa.Numeric(precision=12, scale=2),
            existing_nullable=False,
        )

    for tabla in ("compras", "gastos", "notas_compra", "cobros", "notas_cobro"):
        op.drop_column(tabla, "tipo_cambio")
        op.drop_column(tabla, "cotizacion_dolar")

    for tabla in ("gastos", "notas_compra", "cobros", "notas_cobro"):
        op.drop_column(tabla, "monto_usd")
        op.drop_column(tabla, "monto_ars")
        op.add_column(tabla, sa.Column("monto", sa.Numeric(precision=12, scale=2), nullable=False))

    op.drop_column("compras", "precio_neto_usd")
    op.drop_column("compras", "precio_neto_ars")
    op.add_column("compras", sa.Column("precio_neto", sa.Numeric(precision=12, scale=2), nullable=False))

    op.drop_column("proyectos", "tipo_cambio_acordado")
    op.drop_column("proyectos", "cotizacion_acordada")
