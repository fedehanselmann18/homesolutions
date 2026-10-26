import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import FrozenExchangeRateMixin, TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.db.models.purchase import Purchase, PurchaseItem
    from app.db.models.supplier import Supplier
    from app.db.models.tax import Tax
    from app.db.models.user import User


class PurchaseNote(FrozenExchangeRateMixin, TimestampMixin, Base):
    """
    Movimiento de cuenta corriente con un Proveedor: nota de crédito o de
    débito. Por ahora siempre nace de adentro de una Compra puntual (CASCADE +
    not nullable), aunque proveedor_id queda denormalizado acá mismo (copiado
    de compra.proveedor_id al crearla) para el día que haya notas "sueltas"
    (acuerdo comercial sin compra de origen) -- ese día compra_id pasa a
    nullable/SET NULL y esta columna ya está lista.

    - tipo: "nota_credito" (a favor nuestro, resta de precio_total) |
      "nota_debito" (en contra nuestro, suma a precio_total).
    - origen: "devolucion_producto" | "acuerdo_comercial" | "otro" -- string
      libre, se valida en el front. Solo
      nota_credito admite "devolucion_producto".
    - tipo_factura: SIEMPRE obligatorio (código de un TipoFactura),
      sin importar tipo/origen -- el usuario pidió que toda nota, sea crédito
      o débito, quede etiquetada con el tipo de comprobante que la respalda.
    - detalles: líneas de producto devuelto, SOLO si origen="devolucion_producto"
      (ver NotaCompraDetalle). Una nota puede devolver varios productos de la
      misma compra a la vez.
    - impuestos_aplicados: impuestos que se suman a la devolución (ver
      NotaCompraImpuesto), mismo criterio que CompraImpuesto.
    - monto_ars: totalizador FROZEN calculado en el momento de creación (suma de
      detalles + impuestos, o tipeado a mano si es acuerdo_comercial/otro/débito).
      No se recalcula después: si se borra un detalle o cambia el precio del
      producto, esta nota sigue reflejando lo que efectivamente se acreditó.
    - monto_usd: monto_ars con la cotización de LA NOTA (no la de su compra:
      tiene fecha propia, o sea otro dólar). Lo congela el backend.
    """

    __tablename__ = "notas_compra"

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    proveedor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proveedores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    tipo: Mapped[str] = mapped_column(String(20), nullable=False)  # nota_credito | nota_debito
    origen: Mapped[str | None] = mapped_column(String(30), nullable=True)
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )
    monto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    monto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)  # motivo
    fecha: Mapped[date] = mapped_column(nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)  # el comprobante que te dan

    compra: Mapped["Purchase"] = relationship(back_populates="notas")
    proveedor: Mapped["Supplier"] = relationship()
    usuario: Mapped["User"] = relationship()
    detalles: Mapped[list["PurchaseNoteItem"]] = relationship(
        back_populates="nota", cascade="all, delete-orphan"
    )
    impuestos_aplicados: Mapped[list["PurchaseNoteTax"]] = relationship(
        back_populates="nota", cascade="all, delete-orphan"
    )


class PurchaseNoteItem(TimestampMixin, Base):
    """
    Línea de producto devuelto dentro de una NotaCompra (origen="devolucion_producto").
    Varias líneas por nota = varios productos devueltos en un mismo movimiento.

    SET NULL en detalle_compra_id: si se borra la línea de compra original, la
    nota y su monto ya frozen siguen existiendo, solo se pierde la referencia
    exacta al producto (igual criterio que el detalle_compra_id anterior en NotaCompra).
    """

    __tablename__ = "notas_compra_detalle"

    id: Mapped[uuid.UUID] = uuid_pk()
    nota_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notas_compra.id", ondelete="CASCADE"), nullable=False
    )
    detalle_compra_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("detalle_compra.id", ondelete="SET NULL"), nullable=True
    )
    cantidad: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    # precio_unitario frozen al momento de crear la nota (copiado de
    # DetalleCompra.precio_unitario): si el producto cambia de precio de
    # catálogo después, esta línea sigue reflejando lo que se acreditó.
    precio_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    nota: Mapped["PurchaseNote"] = relationship(back_populates="detalles")
    detalle: Mapped["PurchaseItem | None"] = relationship()


def validar_integridad_nota_compra(nota: "PurchaseNote", compra: "Purchase") -> None:
    """
    NotaCompra.proveedor_id se denormaliza desde Compra.proveedor_id al
    crearla (ver app/api/purchases.py: crear_nota_compra) -- hasta acá era una
    copia implícita, sin nada que garantice que de verdad coincidan si algún
    código nuevo arma la nota distinto. Este chequeo lo hace explícito:
    levanta ValueError (el caller la traduce a 400) si por lo que sea no
    matchean, en vez de dejar que una nota quede asociada al proveedor
    equivocado en la cuenta corriente.
    """
    if nota.proveedor_id != compra.proveedor_id:
        raise ValueError(
            "La nota no puede quedar asociada a un proveedor distinto al de la compra que la originó"
        )


class PurchaseNoteTax(TimestampMixin, Base):
    """Entidad asociativa NotaCompra<->Impuesto, mismo criterio que CompraImpuesto:
    impuestos que se suman al monto de una devolución de productos."""

    __tablename__ = "nota_compra_impuesto"
    __table_args__ = (UniqueConstraint("nota_id", "impuesto_id", name="uq_nota_compra_impuesto"),)

    id: Mapped[uuid.UUID] = uuid_pk()
    nota_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("notas_compra.id", ondelete="CASCADE"), nullable=False
    )
    impuesto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("impuestos.id", ondelete="RESTRICT"), nullable=False
    )
    # Pesos. Ya está sumado dentro de NotaCompra.monto_ars/monto_usd, así que
    # no necesita USD propio: si hiciera falta, hereda la cotización de su nota.
    monto: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    nota: Mapped["PurchaseNote"] = relationship(back_populates="impuestos_aplicados")
    impuesto: Mapped["Tax"] = relationship()
