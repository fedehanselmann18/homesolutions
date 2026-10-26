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
from app.db.models.base import FrozenExchangeRateMixin, TimestampMixin, _ajuste_notas, uuid_pk
from app.db.models.payment import _condicion_contado

if TYPE_CHECKING:
    from app.db.models.category import Category
    from app.db.models.payment import PaymentCondition, PaymentInstallment
    from app.db.models.product import Product
    from app.db.models.project import Phase
    from app.db.models.purchase_note import PurchaseNote
    from app.db.models.supplier import Supplier
    from app.db.models.tax import Tax
    from app.db.models.user import User


class Purchase(FrozenExchangeRateMixin, TimestampMixin, Base):
    __tablename__ = "compras"

    id: Mapped[uuid.UUID] = uuid_pk()
    # CORREGIDO: la Compra siempre pertenece a una Fase (CompraCreate.fase_id es obligatorio,
    # así lo definiste con Agus) -> CASCADE + not nullable, no SET NULL.
    fase_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("fases.id", ondelete="CASCADE"), nullable=False, index=True
    )
    # RESTRICT: no se puede borrar un proveedor/usuario si tiene compras -> se pierde trazabilidad.
    proveedor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proveedores.id", ondelete="RESTRICT"), nullable=False, index=True
    )
    usuario_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("usuarios.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    descripcion: Mapped[str] = mapped_column(String(500), nullable=False)
    # Sin impuestos. Se carga en pesos; el USD lo congela el backend con
    # cotizacion_dolar (ver app/domain/exchange_rate.py).
    precio_neto_ars: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    precio_neto_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tipo_factura: Mapped[str] = mapped_column(
        String(30), ForeignKey("tipos_factura.codigo", ondelete="RESTRICT"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    # Cuándo se paga (Contado, 30/60 días...): arma los plazos (ver app/domain/payment_terms.py).
    condicion_pago_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("condiciones_pago.id", ondelete="RESTRICT"), nullable=False, default=_condicion_contado
    )
    # Cómo se paga, opcional: código de un MedioPago (se administra en Ajustes).
    medio_pago: Mapped[str | None] = mapped_column(
        String(30), ForeignKey("medios_pago.codigo", ondelete="RESTRICT"), nullable=True
    )
    # pendiente/pagado. DERIVADO de los plazos (pagado = todos pagados): se
    # guarda para que filtros, Panel y PDF no tengan que recorrer plazos.
    estado_pago: Mapped[str] = mapped_column(String(20), nullable=False)
    estado_envio: Mapped[str] = mapped_column(String(20), nullable=False)  # pedido/entregado

    condicion_pago: Mapped["PaymentCondition"] = relationship()
    plazos: Mapped[list["PaymentInstallment"]] = relationship(
        back_populates="compra", cascade="all, delete-orphan", order_by="PaymentInstallment.numero"
    )
    fase: Mapped["Phase"] = relationship(back_populates="compras")
    proveedor: Mapped["Supplier"] = relationship()
    usuario: Mapped["User"] = relationship()
    detalle: Mapped[list["PurchaseItem"]] = relationship(
        back_populates="compra",
        cascade="all, delete-orphan",
        # al leer, hacer selectinload(Compra.detalle).joinedload(DetalleCompra.producto).joinedload(Producto.categorias)
        # para que las properties de abajo no disparen N+1 queries
    )
    impuestos_aplicados: Mapped[list["PurchaseTax"]] = relationship(
        back_populates="compra", cascade="all, delete-orphan"
    )
    comprobantes: Mapped[list["PurchaseReceipt"]] = relationship(
        back_populates="compra", cascade="all, delete-orphan"
    )
    # Cuenta corriente de esta compra con el proveedor: notas de crédito/débito,
    # cada una opcionalmente atada a una línea puntual de producto devuelto
    # (ver NotaCompra más abajo). Comprobante* es SOLO el archivo (factura,
    # remito...); Nota* es un movimiento de plata con su propio motivo/origen.
    notas: Mapped[list["PurchaseNote"]] = relationship(back_populates="compra", cascade="all, delete-orphan")

    @property
    def impuestos_ars(self) -> float:
        return sum(float(ci.monto) for ci in self.impuestos_aplicados)

    @property
    def impuestos_usd(self) -> float:
        """Los impuestos no guardan USD propio: se pagan con la factura, así
        que heredan la cotización congelada de SU compra."""
        return sum(ci.monto_usd for ci in self.impuestos_aplicados)

    @property
    def precio_total_ars(self) -> float:
        """
        precio_neto_ars + impuestos - notas de crédito + notas de débito (ver
        NotaCompra). No se persiste.

        B-04: requiere que impuestos_aplicados y notas vengan eager-loaded
        (ver joinedload(Compra.impuestos_aplicados) y
        joinedload(Compra.notas) en app/api/purchases.py). Si no, cada acceso
        a self.impuestos_aplicados/self.notas dispara una query aparte por
        Compra (N+1) EN SILENCIO -- SQLAlchemy no avisa, simplemente hace
        lazy load fila por fila. detalle NO hace falta para ESTE cálculo
        (sí lo usan categorias/tipos_compra, más abajo).
        """
        return float(self.precio_neto_ars) + self.impuestos_ars + _ajuste_notas(self.notas, "monto_ars")

    @property
    def precio_total_usd(self) -> float:
        """
        Mismo criterio que precio_total_ars, pero cada nota suma con SU
        propio USD congelado: una nota tiene fecha propia, o sea otro dólar.
        Por eso esto NO es precio_total_ars / cotizacion_dolar.
        """
        return float(self.precio_neto_usd) + self.impuestos_usd + _ajuste_notas(self.notas, "monto_usd")

    @property
    def categorias(self) -> list["Category"]:
        """
        Categorías de la Compra, DERIVADAS de las categorías de sus productos
        (Compra -> DetalleCompra -> Producto -> Categoria). No se cargan a mano:
        si compraste aires y cafeteras en la misma Compra, esto devuelve ambas
        categorías sin que nadie tenga que tildarlas por separado.
        """
        vistas: dict[uuid.UUID, "Category"] = {}
        for linea in self.detalle:
            for cat in linea.producto.categorias:
                vistas[cat.id] = cat
        return list(vistas.values())

    @property
    def tipos_compra(self) -> list[str]:
        """
        Tipos (mano_obra/equipo/materiales) presentes en esta Compra, DERIVADOS
        del tipo de cada Producto en el detalle. Mismo principio que categorias:
        si en una misma Compra hay un producto de "equipo" y otro de "materiales",
        esto devuelve ambos en vez de forzarte a elegir uno solo para toda la Compra.
        """
        vistos: dict[str, None] = {}
        for linea in self.detalle:
            vistos[linea.producto.tipo] = None
        return list(vistos.keys())


class PurchaseItem(TimestampMixin, Base):
    """Línea de detalle: qué productos (y cantidad/precio) componen una Compra."""

    __tablename__ = "detalle_compra"

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    # RESTRICT: no se puede borrar un producto que ya fue comprado -> se pierde el historial.
    producto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("productos.id", ondelete="RESTRICT"), nullable=False
    )
    cantidad: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    precio_unitario: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    compra: Mapped["Purchase"] = relationship(back_populates="detalle")
    producto: Mapped["Product"] = relationship()


class PurchaseTax(TimestampMixin, Base):
    """
    Entidad asociativa Compra<->Impuesto: guarda cuánto de CADA impuesto se pagó.

    CORREGIDO:
    - PK simple (`id`) en vez de PK compuesta (id + compra_id + impuesto_id). Con las
      tres columnas como primary_key=True, `id` (UUID random) hacía que la restricción
      de unicidad nunca se cumpliera de verdad: se podía cargar el mismo impuesto dos
      veces en la misma Compra. Ahora la unicidad real se garantiza con el
      UniqueConstraint de abajo.
    - Se saca el campo `nombre`: es redundante con Impuesto.nombre (accedé vía la
      relación `impuesto.nombre`) y además rompía el insert, porque CompraImpuestoCreate
      nunca lo mandaba y la columna era NOT NULL sin default.
    """

    __tablename__ = "compra_impuesto"
    __table_args__ = (UniqueConstraint("compra_id", "impuesto_id", name="uq_compra_impuesto"),)

    id: Mapped[uuid.UUID] = uuid_pk()

    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    impuesto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("impuestos.id", ondelete="RESTRICT"), nullable=False
    )
    # Pesos (nombre pelado = una sola moneda).
    monto: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    compra: Mapped["Purchase"] = relationship(back_populates="impuestos_aplicados")
    impuesto: Mapped["Tax"] = relationship()

    @property
    def monto_usd(self) -> float:
        """Hereda la cotización congelada de su compra. Sin redondear: se
        redondea al mostrar, así la suma de varios impuestos no acumula
        error de centavos."""
        return float(self.monto) / float(self.compra.cotizacion_dolar)


class PurchaseReceipt(TimestampMixin, Base):
    """Archivo adjunto a una Compra (factura, remito...). Sin plata propia:
    para movimientos de cuenta corriente (nota de crédito/débito) ver NotaCompra."""

    __tablename__ = "comprobantes_compra"

    id: Mapped[uuid.UUID] = uuid_pk()
    compra_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    archivo_path: Mapped[str] = mapped_column(String(500), nullable=False)

    compra: Mapped["Purchase"] = relationship(back_populates="comprobantes")
