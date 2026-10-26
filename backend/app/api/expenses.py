from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.auth.oauth2 import get_current_user, requiere_admin
from app.core.audit import log_auditoria
from app.core.limiter import limiter
from app.core.pagination import PaginationParams
from app.db import models
from app.db.database import get_db
from app.domain import payment_terms
from app.domain.exchange_rate import a_usd
from app.domain.invoice_types import validar_tipo_factura
from app.domain.payment_methods import validar_medio_pago
from app.domain.project_status import activar_por_movimiento
from app.file_management.storage import eliminar_comprobante, subir_comprobante, ver_comprobante
from app.schemas import ExpenseCreate, ExpenseOut, ExpenseReceiptOut, ExpenseUpdate

router = APIRouter(prefix="/gastos", tags=["gastos"])


@router.get("/", response_model=list[ExpenseOut], status_code=status.HTTP_200_OK)
def get_all_gastos(
    paginacion: PaginationParams = Depends(),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    query = (
        db.query(models.Expense)
        .options(
            joinedload(models.Expense.categorias),
            selectinload(models.Expense.plazos),
            joinedload(models.Expense.condicion_pago),
        )
        .order_by(models.Expense.fecha_creacion.desc())
        .offset(paginacion.offset)
    )
    if paginacion.limit is not None:
        query = query.limit(paginacion.limit)
    return query.all()


@router.get("/{gasto_id}", response_model=ExpenseOut, status_code=status.HTTP_200_OK)
def get_gasto_by_id(
    gasto_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    gasto = (
        db.query(models.Expense)
        .options(
            joinedload(models.Expense.categorias),
            selectinload(models.Expense.plazos),
            joinedload(models.Expense.condicion_pago),
        )
        .filter(models.Expense.id == gasto_id)
        .first()
    )
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")
    return gasto


@router.get(
    "/proyectos/{proyecto_id}/gastos", response_model=list[ExpenseOut], status_code=status.HTTP_200_OK
)
def get_gastos_by_proyecto(
    proyecto_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    proyecto = db.query(models.Project).filter(models.Project.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return (
        db.query(models.Expense)
        .options(
            joinedload(models.Expense.categorias),
            selectinload(models.Expense.plazos),
            joinedload(models.Expense.condicion_pago),
        )
        .filter(models.Expense.proyecto_id == proyecto_id)
        .all()
    )


@router.get("/fases/{fase_id}/gastos", response_model=list[ExpenseOut], status_code=status.HTTP_200_OK)
def get_gastos_by_fase(
    fase_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)
):
    fase = db.query(models.Phase).filter(models.Phase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    return (
        db.query(models.Expense)
        .options(
            joinedload(models.Expense.categorias),
            selectinload(models.Expense.plazos),
            joinedload(models.Expense.condicion_pago),
        )
        .filter(models.Expense.fase_id == fase_id)
        .all()
    )


@router.post("/crear", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
def create_gasto(
    request: Request,
    gasto: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    proyecto = db.query(models.Project).filter(models.Project.id == gasto.proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    fase = None
    if gasto.fase_id:
        fase = db.query(models.Phase).filter(models.Phase.id == gasto.fase_id).first()
        if not fase:
            raise HTTPException(status_code=404, detail="Fase no encontrada")

    validar_tipo_factura(db, gasto.tipo_factura)
    validar_medio_pago(db, gasto.medio_pago)

    categorias = []
    if gasto.categoria_gasto_ids:
        categorias = (
            db.query(models.ExpenseCategory)
            .filter(models.ExpenseCategory.id.in_(gasto.categoria_gasto_ids))
            .all()
        )
        if len(categorias) != len(gasto.categoria_gasto_ids):
            raise HTTPException(status_code=404, detail="Una o más categorías de gasto no existen")

    nuevo_gasto = models.Expense(
        proyecto_id=gasto.proyecto_id,
        fase_id=gasto.fase_id,
        usuario_id=current_user.id,  # del JWT, nunca del body
        monto_ars=gasto.monto_ars,
        # Congelado acá, siempre: el front no manda (ni puede pisar) el USD.
        monto_usd=a_usd(gasto.monto_ars, gasto.cotizacion_dolar),
        cotizacion_dolar=gasto.cotizacion_dolar,
        tipo_cambio=gasto.tipo_cambio,
        descripcion=gasto.descripcion,
        fecha=gasto.fecha,
        tipo_factura=gasto.tipo_factura,
        medio_pago=gasto.medio_pago,
        categorias=categorias,
    )
    # Default Contado y pagado: un flete se sigue cargando en un paso.
    condicion = payment_terms.buscar_condicion(db, gasto.condicion_pago_id)
    payment_terms.armar_plazos(nuevo_gasto, condicion, pagado=gasto.estado_pago == payment_terms.PAGADO)

    activar_por_movimiento(db, fase=fase, proyecto=proyecto, fecha=nuevo_gasto.fecha)

    try:
        db.add(nuevo_gasto)
        db.commit()
        db.refresh(nuevo_gasto)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el gasto: datos inválidos")

    log_auditoria(db, current_user.id, "create", "Gasto", nuevo_gasto.id)
    return nuevo_gasto


@router.put("/{gasto_id}", response_model=ExpenseOut, status_code=status.HTTP_200_OK)
def update_gasto(
    gasto_id: str,
    gasto: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    gasto_existente = db.query(models.Expense).filter(models.Expense.id == gasto_id).first()
    if not gasto_existente:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    datos = gasto.model_dump(exclude_unset=True)

    if "tipo_factura" in datos:
        validar_tipo_factura(db, datos["tipo_factura"])

    if "medio_pago" in datos:
        validar_medio_pago(db, datos["medio_pago"], actual=gasto_existente.medio_pago)

    if "fase_id" in datos and datos["fase_id"] is not None:
        fase = db.query(models.Phase).filter(models.Phase.id == datos["fase_id"]).first()
        if not fase:
            raise HTTPException(status_code=404, detail="Fase no encontrada")

    if "categoria_gasto_ids" in datos:
        ids = datos.pop("categoria_gasto_ids")
        categorias = db.query(models.ExpenseCategory).filter(models.ExpenseCategory.id.in_(ids)).all()
        if len(categorias) != len(ids):
            raise HTTPException(status_code=404, detail="Una o más categorías de gasto no existen")
        gasto_existente.categorias = categorias

    condicion_nueva, estado_nuevo = payment_terms.extraer_cambios_de_pago(db, datos)

    for key, value in datos.items():
        setattr(gasto_existente, key, value)

    # Si cambió el monto o la cotización, el USD congelado se recalcula con
    # los valores que quedaron (uno puede venir nuevo y el otro ser el de antes).
    if "monto_ars" in datos or "cotizacion_dolar" in datos:
        gasto_existente.monto_usd = a_usd(gasto_existente.monto_ars, gasto_existente.cotizacion_dolar)

    payment_terms.actualizar(gasto_existente, condicion_nueva, estado_nuevo, cambio_fecha="fecha" in datos)

    try:
        db.commit()
        db.refresh(gasto_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar el gasto: datos inválidos")

    log_auditoria(db, current_user.id, "update", "Gasto", gasto_existente.id)
    return gasto_existente


@router.delete("/{gasto_id}", response_model=ExpenseOut, status_code=status.HTTP_200_OK)
def delete_gasto(
    gasto_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(requiere_admin)
):
    gasto = db.query(models.Expense).filter(models.Expense.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    gasto_data = ExpenseOut.model_validate(gasto)

    for comprobante in gasto.comprobantes:
        eliminar_comprobante(comprobante.archivo_path)

    db.delete(gasto)
    db.commit()

    log_auditoria(db, current_user.id, "delete", "Gasto", gasto_data.id)
    return gasto_data


@router.post(
    "/{gasto_id}/comprobantes", response_model=ExpenseReceiptOut, status_code=status.HTTP_201_CREATED
)
@limiter.limit("20/minute")
def upload_comprobante_gasto(
    request: Request,
    gasto_id: str,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    gasto = db.query(models.Expense).filter(models.Expense.id == gasto_id).first()
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    path = subir_comprobante(archivo, "comprobantes_gasto", gasto_id)

    nuevo_comprobante = models.ExpenseReceipt(gasto_id=gasto_id, archivo_path=path)
    db.add(nuevo_comprobante)
    db.commit()
    db.refresh(nuevo_comprobante)

    return nuevo_comprobante


@router.get("/{gasto_id}/comprobantes/{comprobante_id}")
def get_comprobante_gasto(
    gasto_id: str,
    comprobante_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    comprobante = (
        db.query(models.ExpenseReceipt)
        .filter(models.ExpenseReceipt.id == comprobante_id, models.ExpenseReceipt.gasto_id == gasto_id)
        .first()
    )
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    return ver_comprobante(comprobante.archivo_path)


@router.delete("/{gasto_id}/comprobantes/{comprobante_id}", status_code=status.HTTP_200_OK)
def delete_comprobante_gasto(
    gasto_id: str,
    comprobante_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    comprobante = (
        db.query(models.ExpenseReceipt)
        .filter(models.ExpenseReceipt.id == comprobante_id, models.ExpenseReceipt.gasto_id == gasto_id)
        .first()
    )
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    eliminar_comprobante(comprobante.archivo_path)
    db.delete(comprobante)
    db.commit()

    return {"detail": "Comprobante eliminado"}
