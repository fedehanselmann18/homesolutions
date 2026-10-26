"""
GET    /cotizaciones/          (?tipo=blue opcional)
GET    /cotizaciones/ultima    (?tipo=blue&fecha=2026-03-10, ambos opcionales)
GET    /cotizaciones/{id}
POST   /cotizaciones/crear   -> requiere_admin
PUT    /cotizaciones/{id}    -> requiere_admin
DELETE /cotizaciones/{id}    -> requiere_admin

Fuente de sugerencia para precargar el dólar en los forms (ver
models.ExchangeRate). Editar o borrar una fila no toca ningún movimiento ya
cargado: cada uno guarda su propia cotización congelada.
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oauth2 import get_current_user, requiere_admin
from app.db import models
from app.db.database import get_db
from app.db.errors import es_violacion_unicidad
from app.schemas import ExchangeRateCreate, ExchangeRateOut, ExchangeRateType, ExchangeRateUpdate

router = APIRouter(prefix="/cotizaciones", tags=["cotizaciones"])

_MENSAJE_REPETIDA = "Ya hay una cotización de ese tipo cargada para esa fecha"


def ultima_cotizacion(
    db: Session, tipo: str | None = None, hasta: date | None = None
) -> models.ExchangeRate | None:
    """
    La cotización más reciente con fecha <= `hasta` (hoy si no viene),
    opcionalmente de un tipo. None si no hay ninguna -- no es un error: la
    tabla puede estar vacía y el form igual se puede cargar tipeando el valor.

    Vive acá (y no adentro del endpoint) porque también la usa el reporte PDF
    para pasar a pesos el precio acordado (ver app/api/projects.py).
    """
    query = db.query(models.ExchangeRate).filter(models.ExchangeRate.fecha <= (hasta or date.today()))
    if tipo:
        query = query.filter(models.ExchangeRate.tipo == tipo)
    # fecha_creacion desempata entre tipos distintos del mismo día: gana la
    # última que se cargó.
    return query.order_by(models.ExchangeRate.fecha.desc(), models.ExchangeRate.fecha_creacion.desc()).first()


@router.get("/", response_model=list[ExchangeRateOut], status_code=status.HTTP_200_OK)
def get_all_cotizaciones(
    tipo: ExchangeRateType | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.ExchangeRate)
    if tipo:
        query = query.filter(models.ExchangeRate.tipo == tipo)
    return query.order_by(models.ExchangeRate.fecha.desc(), models.ExchangeRate.tipo).all()


# Declarada antes de /{cotizacion_id}: si no, "ultima" se tomaría como un id.
@router.get("/ultima", response_model=ExchangeRateOut | None, status_code=status.HTTP_200_OK)
def get_ultima_cotizacion(
    tipo: ExchangeRateType | None = None,
    fecha: date | None = None,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    # null (200) y no 404 cuando no hay: para el form "todavía no cargaste
    # ninguna" es un estado normal, no un error que mostrar.
    return ultima_cotizacion(db, tipo, fecha)


@router.get("/{cotizacion_id}", response_model=ExchangeRateOut, status_code=status.HTTP_200_OK)
def get_cotizacion_by_id(
    cotizacion_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    cotizacion = db.query(models.ExchangeRate).filter(models.ExchangeRate.id == cotizacion_id).first()
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")
    return cotizacion


@router.post("/crear", response_model=ExchangeRateOut, status_code=status.HTTP_201_CREATED)
def create_cotizacion(
    cotizacion: ExchangeRateCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    nueva = models.ExchangeRate(fecha=cotizacion.fecha, tipo=cotizacion.tipo, valor=cotizacion.valor)
    try:
        db.add(nueva)
        db.commit()
        db.refresh(nueva)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=_MENSAJE_REPETIDA)
        raise HTTPException(status_code=400, detail="Error al crear la cotización: datos inválidos")

    return nueva


@router.put("/{cotizacion_id}", response_model=ExchangeRateOut, status_code=status.HTTP_200_OK)
def update_cotizacion(
    cotizacion_id: str,
    cotizacion: ExchangeRateUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    existente = db.query(models.ExchangeRate).filter(models.ExchangeRate.id == cotizacion_id).first()
    if not existente:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    for key, value in cotizacion.model_dump(exclude_unset=True).items():
        setattr(existente, key, value)

    try:
        db.commit()
        db.refresh(existente)
    except IntegrityError as e:
        db.rollback()
        if es_violacion_unicidad(e):
            raise HTTPException(status_code=400, detail=_MENSAJE_REPETIDA)
        raise HTTPException(status_code=400, detail="Error al actualizar la cotización: datos inválidos")

    return existente


@router.delete("/{cotizacion_id}", response_model=ExchangeRateOut, status_code=status.HTTP_200_OK)
def delete_cotizacion(
    cotizacion_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    cotizacion = db.query(models.ExchangeRate).filter(models.ExchangeRate.id == cotizacion_id).first()
    if not cotizacion:
        raise HTTPException(status_code=404, detail="Cotización no encontrada")

    cotizacion_data = ExchangeRateOut.model_validate(cotizacion)
    # Sin chequeo de "en uso": ningún movimiento apunta a esta tabla (cada uno
    # copió el valor al cargarse), así que borrarla no rompe nada.
    db.delete(cotizacion)
    db.commit()

    return cotizacion_data
