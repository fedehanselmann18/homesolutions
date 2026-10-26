import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import (  # CORREGIDO: + UniqueConstraint
    ForeignKey,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base
from app.db.models.base import TimestampMixin, uuid_pk

if TYPE_CHECKING:
    from app.db.models.client_payment import ClientPayment
    from app.db.models.expense import Expense
    from app.db.models.purchase import Purchase


class Project(TimestampMixin, Base):
    __tablename__ = "proyectos"

    id: Mapped[uuid.UUID] = uuid_pk()
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    direccion: Mapped[str] = mapped_column(String(255), nullable=False)
    fecha_inicio: Mapped[date] = mapped_column(nullable=False)  # fecha de negocio, se carga a mano
    estado: Mapped[str] = mapped_column(String(20), nullable=False)  # a_iniciar/en_curso/terminado
    # El precio se acuerda con el cliente en dólares. Su equivalente en pesos
    # NO se persiste: se calcula al leer con la última cotización cargada
    # ("cuánto vale hoy el contrato").
    precio_acordado_usd: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    # El dólar del día de la firma, como trazabilidad. Nullable y fuera de
    # toda cuenta: un proyecto cargado tiempo después puede no tenerlo.
    cotizacion_acordada: Mapped[float | None] = mapped_column(Numeric(12, 4))
    tipo_cambio_acordado: Mapped[str | None] = mapped_column(String(20))

    fases: Mapped[list["Phase"]] = relationship(back_populates="proyecto", cascade="all, delete-orphan")
    gastos: Mapped[list["Expense"]] = relationship(back_populates="proyecto", cascade="all, delete-orphan")
    # Sin cascade de borrado, a diferencia de fases y gastos: una obra
    # con cobros no se borra (ver api/projects.py). Con `delete-orphan` el ORM
    # se adelantaba a borrarlos uno por uno y el RESTRICT de la base nunca
    # llegaba a saltar; passive_deletes deja que decida la base.
    cobros: Mapped[list["ClientPayment"]] = relationship(back_populates="proyecto", passive_deletes="all")


class Phase(TimestampMixin, Base):
    __tablename__ = "fases"

    id: Mapped[uuid.UUID] = uuid_pk()
    proyecto_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("proyectos.id", ondelete="CASCADE"), nullable=False
    )
    nombre: Mapped[str] = mapped_column(String(150), nullable=False)
    descripcion: Mapped[str | None] = mapped_column(String(500))
    estado: Mapped[str] = mapped_column(String(20), nullable=False)  # por_empezar/en_curso/terminada/auditada
    # Número de orden de la fase dentro de SU proyecto (1, 2, 3...) -- lo
    # asigna solo el backend al crear (siguiente número libre para ese
    # proyecto) y se reacomoda para no dejar huecos al borrar una fase del
    # medio. No es global: cada proyecto tiene su propia numeración 1..N.
    orden: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    # Desde cuándo está "en_curso" esta fase, para poder mostrar "hace X
    # días" de forma correcta. A propósito NO se usa fecha_actualizacion
    # para esto: ese campo se pisa con CUALQUIER edición de la fase (nombre,
    # descripción, etc.), no solo con el cambio de estado, así que "en curso
    # hace 0 días" aparecía cada vez que se tocaba algo de una fase que ya
    # estaba en curso. Se pone en None cuando la fase sale de en_curso.
    # Es una FECHA (oct 2026), no un instante: la elige el usuario al pasarla
    # a en curso, o es la del primer movimiento que la arrancó. Antes era el
    # momento en que se cargaba, y cargar una compra vieja dejaba la fase "en
    # curso desde hoy".
    fecha_en_curso_desde: Mapped[date | None] = mapped_column()

    proyecto: Mapped["Project"] = relationship(back_populates="fases")
    # Compra NO puede existir sin Fase -> se borra en cascada junto con ella (ver Compra.fase_id).
    compras: Mapped[list["Purchase"]] = relationship(back_populates="fase", cascade="all, delete-orphan")
    # Gasto SÍ puede existir sin Fase (sigue perteneciendo al Proyecto) -> no se borra, se desvincula.
    gastos: Mapped[list["Expense"]] = relationship(back_populates="fase")
