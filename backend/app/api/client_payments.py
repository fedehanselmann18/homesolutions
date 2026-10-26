from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.oauth2 import get_current_user, requiere_admin
from app.core.audit import log_auditoria
from app.core.limiter import limiter
from app.core.pagination import PaginationParams
from app.db import models
from app.db.database import get_db
from app.domain.exchange_rate import a_ars
from app.domain.invoice_types import validar_tipo_factura
from app.file_management.storage import eliminar_comprobante, subir_comprobante, ver_comprobante
from app.schemas import (
    ClientPaymentCreate,
    ClientPaymentNoteOut,
    ClientPaymentOut,
    ClientPaymentReceiptOut,
    ClientPaymentUpdate,
    ExchangeRateType,
)

router = APIRouter(prefix="/cobros", tags=["cobros"])


@router.get("/", response_model=list[ClientPaymentOut], status_code=status.HTTP_200_OK)
def get_all_cobros(
    proyecto_id: str | None = None,  # "cliente": Cobro cuelga de Proyecto, no hay entidad Cliente propia
    paginacion: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = db.query(models.ClientPayment)
    if proyecto_id:
        query = query.filter(models.ClientPayment.proyecto_id == proyecto_id)
    query = query.order_by(models.ClientPayment.fecha_creacion.desc()).offset(paginacion.offset)
    if paginacion.limit is not None:
        query = query.limit(paginacion.limit)
    return query.all()


@router.get("/{cobro_id}", response_model=ClientPaymentOut, status_code=status.HTTP_200_OK)
def get_cobro_by_id(
    cobro_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    cobro = db.query(models.ClientPayment).filter(models.ClientPayment.id == cobro_id).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")
    return cobro


@router.get(
    "/proyectos/{proyecto_id}/cobros", response_model=list[ClientPaymentOut], status_code=status.HTTP_200_OK
)
def get_cobros_by_proyecto(
    proyecto_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    proyecto = db.query(models.Project).filter(models.Project.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return db.query(models.ClientPayment).filter(models.ClientPayment.proyecto_id == proyecto_id).all()


@router.post("/crear", response_model=ClientPaymentOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
def create_cobro(
    request: Request,
    cobro: ClientPaymentCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    proyecto = db.query(models.Project).filter(models.Project.id == cobro.proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    validar_tipo_factura(db, cobro.tipo_factura)

    nuevo_cobro = models.ClientPayment(
        proyecto_id=cobro.proyecto_id,
        usuario_id=current_user.id,  # del JWT, nunca del body
        monto_usd=cobro.monto_usd,
        # Al revés que gasto/compra: se cobra en USD y el ARS se congela acá.
        monto_ars=a_ars(cobro.monto_usd, cobro.cotizacion_dolar),
        cotizacion_dolar=cobro.cotizacion_dolar,
        tipo_cambio=cobro.tipo_cambio,
        descripcion=cobro.descripcion,
        fecha=cobro.fecha,
        tipo_factura=cobro.tipo_factura,
    )

    try:
        db.add(nuevo_cobro)
        db.commit()
        db.refresh(nuevo_cobro)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el cobro: datos inválidos")

    log_auditoria(db, current_user.id, "create", "Cobro", nuevo_cobro.id)
    return nuevo_cobro


@router.put("/{cobro_id}", response_model=ClientPaymentOut, status_code=status.HTTP_200_OK)
def update_cobro(
    cobro_id: str,
    cobro: ClientPaymentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    cobro_existente = db.query(models.ClientPayment).filter(models.ClientPayment.id == cobro_id).first()
    if not cobro_existente:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    datos = cobro.model_dump(exclude_unset=True)
    if "tipo_factura" in datos:
        validar_tipo_factura(db, datos["tipo_factura"])
    for key, value in datos.items():
        setattr(cobro_existente, key, value)

    if "monto_usd" in datos or "cotizacion_dolar" in datos:
        cobro_existente.monto_ars = a_ars(cobro_existente.monto_usd, cobro_existente.cotizacion_dolar)

    try:
        db.commit()
        db.refresh(cobro_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar el cobro: datos inválidos")

    log_auditoria(db, current_user.id, "update", "Cobro", cobro_existente.id)
    return cobro_existente


@router.delete("/{cobro_id}", response_model=ClientPaymentOut, status_code=status.HTTP_200_OK)
def delete_cobro(
    cobro_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    cobro = db.query(models.ClientPayment).filter(models.ClientPayment.id == cobro_id).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    cobro_data = ClientPaymentOut.model_validate(cobro)

    for comprobante in cobro.comprobantes:
        eliminar_comprobante(comprobante.archivo_path)
    for nota in cobro.notas:
        eliminar_comprobante(nota.archivo_path)

    db.delete(cobro)
    db.commit()

    log_auditoria(db, current_user.id, "delete", "Cobro", cobro_data.id)
    return cobro_data


@router.post(
    "/{cobro_id}/comprobantes", response_model=ClientPaymentReceiptOut, status_code=status.HTTP_201_CREATED
)
@limiter.limit("20/minute")
def upload_comprobante_cobro(
    request: Request,
    cobro_id: str,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    cobro = db.query(models.ClientPayment).filter(models.ClientPayment.id == cobro_id).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    path = subir_comprobante(archivo, "comprobantes_cobro", cobro_id)

    nuevo_comprobante = models.ClientPaymentReceipt(cobro_id=cobro_id, archivo_path=path)
    db.add(nuevo_comprobante)
    db.commit()
    db.refresh(nuevo_comprobante)

    return nuevo_comprobante


@router.get("/{cobro_id}/comprobantes/{comprobante_id}")
def get_comprobante_cobro(
    cobro_id: str,
    comprobante_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comprobante = (
        db.query(models.ClientPaymentReceipt)
        .filter(
            models.ClientPaymentReceipt.id == comprobante_id, models.ClientPaymentReceipt.cobro_id == cobro_id
        )
        .first()
    )
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    return ver_comprobante(comprobante.archivo_path)


@router.delete("/{cobro_id}/comprobantes/{comprobante_id}", status_code=status.HTTP_200_OK)
def delete_comprobante_cobro(
    cobro_id: str,
    comprobante_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    comprobante = (
        db.query(models.ClientPaymentReceipt)
        .filter(
            models.ClientPaymentReceipt.id == comprobante_id, models.ClientPaymentReceipt.cobro_id == cobro_id
        )
        .first()
    )
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    eliminar_comprobante(comprobante.archivo_path)
    db.delete(comprobante)
    db.commit()

    return {"detail": "Comprobante eliminado"}


# ---------------------------------------------------------------------------
# Notas (cuenta corriente: nota de crédito / nota de débito)
# ---------------------------------------------------------------------------


@router.post("/{cobro_id}/notas", response_model=ClientPaymentNoteOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def crear_nota_cobro(
    request: Request,
    cobro_id: str,
    archivo: UploadFile = File(...),
    tipo: str = Form(...),  # "nota_credito" | "nota_debito"
    tipo_factura: str = Form(...),  # SIEMPRE obligatorio: código de un TipoFactura
    monto_usd: float = Form(...),  # en dólares, como el cobro; el ARS se congela acá
    cotizacion_dolar: float = Form(..., gt=0),  # la de la fecha de la nota, no la del cobro
    tipo_cambio: ExchangeRateType = Form(...),
    descripcion: str = Form(...),
    fecha: date = Form(...),
    origen: str | None = Form(None),  # "ajuste_precio" | "acuerdo_comercial" | "otro"
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    cobro = db.query(models.ClientPayment).filter(models.ClientPayment.id == cobro_id).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    if tipo not in ("nota_credito", "nota_debito"):
        raise HTTPException(status_code=400, detail="tipo debe ser 'nota_credito' o 'nota_debito'")

    # Antes de subir el archivo: si no, un tipo inválido deja un comprobante huérfano.
    validar_tipo_factura(db, tipo_factura)

    path = subir_comprobante(archivo, "notas_cobro", cobro_id)

    nueva_nota = models.ClientPaymentNote(
        cobro_id=cobro_id,
        proyecto_id=cobro.proyecto_id,  # denormalizado desde el cobro
        usuario_id=current_user.id,
        tipo=tipo,
        origen=origen,
        tipo_factura=tipo_factura,
        monto_usd=monto_usd,
        monto_ars=a_ars(monto_usd, cotizacion_dolar),
        cotizacion_dolar=cotizacion_dolar,
        tipo_cambio=tipo_cambio,
        descripcion=descripcion,
        fecha=fecha,
        archivo_path=path,
    )
    db.add(nueva_nota)
    db.commit()
    db.refresh(nueva_nota)

    return nueva_nota


@router.get("/{cobro_id}/notas/{nota_id}")
def ver_nota_cobro(
    cobro_id: str,
    nota_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    nota = (
        db.query(models.ClientPaymentNote)
        .filter(models.ClientPaymentNote.id == nota_id, models.ClientPaymentNote.cobro_id == cobro_id)
        .first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    return ver_comprobante(nota.archivo_path)


@router.delete("/{cobro_id}/notas/{nota_id}", status_code=status.HTTP_200_OK)
def eliminar_nota_cobro(
    cobro_id: str,
    nota_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    nota = (
        db.query(models.ClientPaymentNote)
        .filter(models.ClientPaymentNote.id == nota_id, models.ClientPaymentNote.cobro_id == cobro_id)
        .first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    eliminar_comprobante(nota.archivo_path)
    db.delete(nota)
    db.commit()

    return {"detail": "Nota eliminada"}
