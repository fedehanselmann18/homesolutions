import json
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app import plazos
from app.audit import log_auditoria
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db import models
from app.db.db import get_db
from app.estados_obra import activar_por_movimiento
from app.files.storage import eliminar_comprobante, subir_comprobante, ver_comprobante
from app.limiter import limiter
from app.medios_pago import validar_medio_pago
from app.pagination import ParametrosPaginacion
from app.schemas import (
    CompraCreate,
    CompraOut,
    CompraUpdate,
    ComprobanteCompraOut,
    NotaCompraOut,
    TipoCambio,
)
from app.tipo_cambio import a_usd
from app.tipos_factura import validar_tipo_factura

router = APIRouter(prefix="/compras", tags=["compras"])

# ---------------------------------------------------------------------------
# GET (lista completa + anidados por proyecto/fase)
# ---------------------------------------------------------------------------


@router.get("/", response_model=list[CompraOut], status_code=status.HTTP_200_OK)
def get_all_compras(
    proveedor_id: str | None = None,
    paginacion: ParametrosPaginacion = Depends(),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    query = db.query(models.Compra).options(
        joinedload(models.Compra.detalle)
        .joinedload(models.DetalleCompra.producto)
        .joinedload(models.Producto.categorias),
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
        selectinload(models.Compra.plazos),
        joinedload(models.Compra.condicion_pago),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.detalles),
        joinedload(models.Compra.notas)
        .joinedload(models.NotaCompra.impuestos_aplicados)
        .joinedload(models.NotaCompraImpuesto.impuesto),
    )
    if proveedor_id:
        query = query.filter(models.Compra.proveedor_id == proveedor_id)
    # order_by explícito: sin esto, limit/offset no tienen un orden estable
    # entre llamadas (Postgres no garantiza nada sin ORDER BY).
    query = query.order_by(models.Compra.fecha_creacion.desc()).offset(paginacion.offset)
    if paginacion.limit is not None:
        query = query.limit(paginacion.limit)
    return query.all()


@router.get("/{compra_id}", response_model=CompraOut, status_code=status.HTTP_200_OK)
def get_compra_by_id(
    compra_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    compra = (
        db.query(models.Compra)
        .options(
            joinedload(models.Compra.detalle)
            .joinedload(models.DetalleCompra.producto)
            .joinedload(models.Producto.categorias),
            joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
            selectinload(models.Compra.plazos),
            joinedload(models.Compra.condicion_pago),
            joinedload(models.Compra.notas).joinedload(models.NotaCompra.detalles),
            joinedload(models.Compra.notas)
            .joinedload(models.NotaCompra.impuestos_aplicados)
            .joinedload(models.NotaCompraImpuesto.impuesto),
        )
        .filter(models.Compra.id == compra_id)
        .first()
    )
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


@router.get("/fases/{fase_id}/compras", response_model=list[CompraOut], status_code=status.HTTP_200_OK)
def get_compras_by_fase(
    fase_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    return (
        db.query(models.Compra)
        .options(
            joinedload(models.Compra.detalle)
            .joinedload(models.DetalleCompra.producto)
            .joinedload(models.Producto.categorias),
            joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
            selectinload(models.Compra.plazos),
            joinedload(models.Compra.condicion_pago),
            joinedload(models.Compra.notas).joinedload(models.NotaCompra.detalles),
            joinedload(models.Compra.notas)
            .joinedload(models.NotaCompra.impuestos_aplicados)
            .joinedload(models.NotaCompraImpuesto.impuesto),
        )
        .filter(models.Compra.fase_id == fase_id)
        .all()
    )


@router.get(
    "/proyectos/{proyecto_id}/compras", response_model=list[CompraOut], status_code=status.HTTP_200_OK
)
def get_compras_by_proyecto(
    proyecto_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(get_current_user)
):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # Compra no tiene FK directa a Proyecto, se llega vía Fase -> join necesario
    return (
        db.query(models.Compra)
        .join(models.Fase)
        .options(
            joinedload(models.Compra.detalle)
            .joinedload(models.DetalleCompra.producto)
            .joinedload(models.Producto.categorias),
            joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
            selectinload(models.Compra.plazos),
            joinedload(models.Compra.condicion_pago),
            joinedload(models.Compra.notas).joinedload(models.NotaCompra.detalles),
            joinedload(models.Compra.notas)
            .joinedload(models.NotaCompra.impuestos_aplicados)
            .joinedload(models.NotaCompraImpuesto.impuesto),
        )
        .filter(models.Fase.proyecto_id == proyecto_id)
        .all()
    )


# ---------------------------------------------------------------------------
# POST : Crear compra (con detalle e impuestos anidados en el mismo body)
# ---------------------------------------------------------------------------


@router.post("/crear", response_model=CompraOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
def create_compra(
    request: Request,
    compra: CompraCreate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    fase = db.query(models.Fase).filter(models.Fase.id == compra.fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    proveedor = db.query(models.Proveedor).filter(models.Proveedor.id == compra.proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    validar_tipo_factura(db, compra.tipo_factura)
    validar_medio_pago(db, compra.medio_pago)

    nueva_compra = models.Compra(
        fase_id=compra.fase_id,
        proveedor_id=compra.proveedor_id,
        usuario_id=current_user.id,  # del JWT, nunca del body
        descripcion=compra.descripcion,
        precio_neto_ars=compra.precio_neto_ars,
        # Congelado acá, siempre: el front no manda (ni puede pisar) el USD.
        # Los impuestos no guardan USD propio: heredan esta cotización.
        precio_neto_usd=a_usd(compra.precio_neto_ars, compra.cotizacion_dolar),
        cotizacion_dolar=compra.cotizacion_dolar,
        tipo_cambio=compra.tipo_cambio,
        tipo_factura=compra.tipo_factura,
        fecha=compra.fecha,
        medio_pago=compra.medio_pago,
        estado_pago=compra.estado_pago,  # lo vuelve a derivar armar_plazos
        estado_envio=compra.estado_envio,
    )

    for linea in compra.detalle:
        producto = db.query(models.Producto).filter(models.Producto.id == linea.producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {linea.producto_id} no encontrado")
        nueva_compra.detalle.append(
            models.DetalleCompra(
                producto_id=linea.producto_id, cantidad=linea.cantidad, precio_unitario=linea.precio_unitario
            )
        )

    _validar_un_impuesto_por_grupo(db, [imp.impuesto_id for imp in compra.impuestos])
    for imp in compra.impuestos:
        impuesto = db.query(models.Impuesto).filter(models.Impuesto.id == imp.impuesto_id).first()
        if not impuesto:
            raise HTTPException(status_code=404, detail=f"Impuesto {imp.impuesto_id} no encontrado")
        nueva_compra.impuestos_aplicados.append(
            models.CompraImpuesto(impuesto_id=imp.impuesto_id, monto=imp.monto)
        )

    # Los plazos salen de la condición, sobre el total con impuestos.
    condicion = plazos.buscar_condicion(db, compra.condicion_pago_id)
    plazos.armar_plazos(nueva_compra, condicion, pagado=compra.estado_pago == plazos.PAGADO)

    activar_por_movimiento(db, fase=fase, fecha=nueva_compra.fecha)

    try:
        db.add(nueva_compra)
        db.commit()
        db.refresh(nueva_compra)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear la compra: datos inválidos")

    log_auditoria(db, current_user.id, "create", "Compra", nueva_compra.id)
    return nueva_compra


# ---------------------------------------------------------------------------
# PUT : Actualizar compra (campos propios + detalle/impuestos si vienen)
# ---------------------------------------------------------------------------


def _reconciliar_detalle(db: Session, compra: models.Compra, lineas) -> None:
    """
    Deja el detalle igual a lo que mandó el formulario, pero reusando las filas
    que ya existían en vez de borrar todo y recrear.

    Importa por qué: NotaCompraDetalle.detalle_compra_id apunta a estas filas
    con ON DELETE SET NULL. Si cada guardado las recreara, editar cualquier
    campo de la compra dejaría a sus notas de crédito sin saber qué producto
    se devolvió -- y sin forma de recuperarlo. Emparejando por producto_id, la
    línea que no cambió conserva su id y las notas siguen apuntando a algo.

    Las que sobran se borran solas: la relación es cascade delete-orphan.
    """
    disponibles: dict[str, list[models.DetalleCompra]] = {}
    for fila in compra.detalle:
        disponibles.setdefault(str(fila.producto_id), []).append(fila)

    resultado = []
    for linea in lineas:
        producto = db.query(models.Producto).filter(models.Producto.id == linea.producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {linea.producto_id} no encontrado")

        pool = disponibles.get(str(linea.producto_id))
        if pool:
            fila = pool.pop(0)
            fila.cantidad = linea.cantidad
            fila.precio_unitario = linea.precio_unitario
        else:
            fila = models.DetalleCompra(
                producto_id=linea.producto_id,
                cantidad=linea.cantidad,
                precio_unitario=linea.precio_unitario,
            )
        resultado.append(fila)

    compra.detalle = resultado


UN_IMPUESTO_POR_GRUPO = "Una factura lleva un solo impuesto de cada grupo: elegí una sola alícuota de {grupo}"


def _validar_un_impuesto_por_grupo(db: Session, impuesto_ids) -> None:
    """Una alícuota de IVA por factura: no puede haber dos impuestos del mismo
    grupo (IVA 21 + IVA 10,5) en una compra o nota. Los que no tienen grupo
    (percepciones sueltas) no cuentan. Los ids inexistentes los rechaza el
    alta después con su 404."""
    if not impuesto_ids:
        return
    grupos = [
        grupo
        for (grupo,) in db.query(models.Impuesto.grupo).filter(models.Impuesto.id.in_(impuesto_ids)).all()
        if grupo
    ]
    vistos = set()
    for grupo in grupos:
        clave = grupo.casefold()
        if clave in vistos:
            raise HTTPException(status_code=400, detail=UN_IMPUESTO_POR_GRUPO.format(grupo=grupo))
        vistos.add(clave)


def _reconciliar_impuestos(db: Session, compra: models.Compra, lineas) -> None:
    """
    Mismo criterio que _reconciliar_detalle. Acá no hay notas apuntando a
    estas filas, pero sí un UniqueConstraint (compra_id, impuesto_id): reusar
    la fila del mismo impuesto evita chocar contra él al cambiarle el monto.
    """
    disponibles: dict[str, list[models.CompraImpuesto]] = {}
    for fila in compra.impuestos_aplicados:
        disponibles.setdefault(str(fila.impuesto_id), []).append(fila)

    resultado = []
    for linea in lineas:
        impuesto = db.query(models.Impuesto).filter(models.Impuesto.id == linea.impuesto_id).first()
        if not impuesto:
            raise HTTPException(status_code=404, detail=f"Impuesto {linea.impuesto_id} no encontrado")

        pool = disponibles.get(str(linea.impuesto_id))
        if pool:
            fila = pool.pop(0)
            fila.monto = linea.monto
        else:
            fila = models.CompraImpuesto(impuesto_id=linea.impuesto_id, monto=linea.monto)
        resultado.append(fila)

    compra.impuestos_aplicados = resultado


@router.put("/{compra_id}", response_model=CompraOut, status_code=status.HTTP_200_OK)
def update_compra(
    compra_id: str,
    compra: CompraUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    compra_existente = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra_existente:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    datos = compra.model_dump(exclude_unset=True)

    if "tipo_factura" in datos:
        validar_tipo_factura(db, datos["tipo_factura"])

    if "medio_pago" in datos:
        validar_medio_pago(db, datos["medio_pago"], actual=compra_existente.medio_pago)

    if "fase_id" in datos:
        fase = db.query(models.Fase).filter(models.Fase.id == datos["fase_id"]).first()
        if not fase:
            raise HTTPException(status_code=404, detail="Fase no encontrada")

    if "proveedor_id" in datos:
        proveedor = db.query(models.Proveedor).filter(models.Proveedor.id == datos["proveedor_id"]).first()
        if not proveedor:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    # Se sacan del dict antes del setattr: no son columnas sino relaciones, y
    # asignarles la lista de dicts cruda rompería el mapeo. `exclude_unset`
    # arriba garantiza que sólo estén acá si el cliente los mandó de verdad.
    lineas_detalle = datos.pop("detalle", None)
    lineas_impuestos = datos.pop("impuestos", None)
    # Pago: la condición rearma los plazos, el estado los marca todos. Se
    # aplican después de los montos (ver plazos.actualizar).
    condicion_nueva, estado_nuevo = plazos.extraer_cambios_de_pago(db, datos)

    for key, value in datos.items():
        setattr(compra_existente, key, value)

    # Neto o cotización nuevos -> se recongela el USD del neto. Sus notas NO
    # se tocan: cada una quedó con la cotización de su propia fecha.
    if "precio_neto_ars" in datos or "cotizacion_dolar" in datos:
        compra_existente.precio_neto_usd = a_usd(
            compra_existente.precio_neto_ars, compra_existente.cotizacion_dolar
        )

    if lineas_detalle is not None:
        _reconciliar_detalle(db, compra_existente, compra.detalle)
    if lineas_impuestos is not None:
        _validar_un_impuesto_por_grupo(db, [linea.impuesto_id for linea in compra.impuestos])
        _reconciliar_impuestos(db, compra_existente, compra.impuestos)

    plazos.actualizar(compra_existente, condicion_nueva, estado_nuevo, cambio_fecha="fecha" in datos)

    try:
        db.commit()
        db.refresh(compra_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar la compra: datos inválidos")

    log_auditoria(db, current_user.id, "update", "Compra", compra_existente.id)
    return compra_existente


# ---------------------------------------------------------------------------
# DELETE : Eliminar compra
# ---------------------------------------------------------------------------


@router.delete("/{compra_id}", response_model=CompraOut, status_code=status.HTTP_200_OK)
def delete_compra(
    compra_id: str, db: Session = Depends(get_db), current_user: models.Usuario = Depends(requiere_admin)
):
    compra = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    compra_data = CompraOut.model_validate(compra)

    # Borrar archivos físicos de los comprobantes y las notas antes de que el CASCADE se lleve las filas
    for comprobante in compra.comprobantes:
        eliminar_comprobante(comprobante.archivo_path)
    for nota in compra.notas:
        eliminar_comprobante(nota.archivo_path)

    db.delete(compra)
    db.commit()

    log_auditoria(db, current_user.id, "delete", "Compra", compra_data.id)
    return compra_data


# ---------------------------------------------------------------------------
# Comprobantes
# ---------------------------------------------------------------------------


@router.post(
    "/{compra_id}/comprobantes", response_model=ComprobanteCompraOut, status_code=status.HTTP_201_CREATED
)
@limiter.limit("20/minute")
def upload_comprobante_compra(
    request: Request,
    compra_id: str,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    compra = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    path = subir_comprobante(archivo, "comprobantes_compra", compra_id)

    nuevo_comprobante = models.ComprobanteCompra(compra_id=compra_id, archivo_path=path)
    db.add(nuevo_comprobante)
    db.commit()
    db.refresh(nuevo_comprobante)

    return nuevo_comprobante


@router.get("/{compra_id}/comprobantes/{comprobante_id}")
def get_comprobante_compra(
    compra_id: str,
    comprobante_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    comprobante = (
        db.query(models.ComprobanteCompra)
        .filter(
            models.ComprobanteCompra.id == comprobante_id, models.ComprobanteCompra.compra_id == compra_id
        )
        .first()
    )
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    return ver_comprobante(comprobante.archivo_path)


@router.delete("/{compra_id}/comprobantes/{comprobante_id}", status_code=status.HTTP_200_OK)
def delete_comprobante_compra(
    compra_id: str,
    comprobante_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    comprobante = (
        db.query(models.ComprobanteCompra)
        .filter(
            models.ComprobanteCompra.id == comprobante_id, models.ComprobanteCompra.compra_id == compra_id
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


def _restante_detalle_compra(db: Session, detalle_compra_id: str, cantidad_comprada: float) -> float:
    """Cuánto de una línea de compra queda disponible para devolver: lo
    comprado menos lo ya acreditado en TODAS las notas de devolución previas
    que referencian esa misma línea (no solo las de la nota que se está
    creando ahora)."""
    ya_devuelto = (
        db.query(func.coalesce(func.sum(models.NotaCompraDetalle.cantidad), 0))
        .filter(models.NotaCompraDetalle.detalle_compra_id == detalle_compra_id)
        .scalar()
    )
    return float(cantidad_comprada) - float(ya_devuelto or 0)


@router.post("/{compra_id}/notas", response_model=NotaCompraOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def crear_nota_compra(
    request: Request,
    compra_id: str,
    archivo: UploadFile = File(...),
    tipo: str = Form(...),  # "nota_credito" | "nota_debito"
    tipo_factura: str = Form(...),  # SIEMPRE obligatorio: código de un TipoFactura
    descripcion: str = Form(...),
    fecha: date = Form(...),
    # La de la fecha de la nota, no la de su compra: es otro día, otro dólar.
    cotizacion_dolar: float = Form(..., gt=0),
    tipo_cambio: TipoCambio = Form(...),
    origen: str | None = Form(
        None
    ),  # "devolucion_producto" | "reposicion_producto" | "acuerdo_comercial" | "otro"
    monto_ars: float | None = Form(
        None
    ),  # obligatorio salvo devolucion_producto/reposicion_producto (se calcula solo)
    detalles_json: str | None = Form(
        None
    ),  # JSON [{detalle_compra_id, cantidad}], solo devolucion_producto/reposicion_producto
    impuestos_json: str | None = Form(None),  # JSON [{impuesto_id, monto}], opcional junto a detalles_json
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    compra = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    if tipo not in ("nota_credito", "nota_debito"):
        raise HTTPException(status_code=400, detail="tipo debe ser 'nota_credito' o 'nota_debito'")

    if origen == "devolucion_producto" and tipo != "nota_credito":
        raise HTTPException(status_code=400, detail="'devolucion_producto' solo aplica a nota_credito")
    if origen == "reposicion_producto" and tipo != "nota_debito":
        raise HTTPException(status_code=400, detail="'reposicion_producto' solo aplica a nota_debito")

    # Antes de subir el archivo: si no, un tipo inválido deja un comprobante huérfano.
    validar_tipo_factura(db, tipo_factura)

    usa_lineas_producto = origen in ("devolucion_producto", "reposicion_producto")

    # Una alícuota de IVA por nota, también antes de subir el archivo. El JSON
    # malformado lo sigue rechazando el parseo de abajo.
    if usa_lineas_producto and impuestos_json:
        try:
            ids_impuestos = [i.get("impuesto_id") for i in json.loads(impuestos_json) if i.get("impuesto_id")]
        except (json.JSONDecodeError, TypeError, AttributeError):
            ids_impuestos = []
        _validar_un_impuesto_por_grupo(db, ids_impuestos)

    path = subir_comprobante(archivo, "notas_compra", compra_id)

    nueva_nota = models.NotaCompra(
        compra_id=compra_id,
        proveedor_id=compra.proveedor_id,  # denormalizado desde la compra
        usuario_id=current_user.id,
        tipo=tipo,
        origen=origen,
        tipo_factura=tipo_factura,
        monto_ars=0,  # se pisan más abajo (calculado o manual)
        monto_usd=0,
        cotizacion_dolar=cotizacion_dolar,
        tipo_cambio=tipo_cambio,
        descripcion=descripcion,
        fecha=fecha,
        archivo_path=path,
    )

    try:
        models.validar_integridad_nota_compra(nueva_nota, compra)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if usa_lineas_producto:
        # Devolución de producto (nota_credito) o reposición de producto
        # (nota_debito, ej: te cambian 3 aires fallados por 3 nuevos y esos 3
        # nuevos se facturan acá) -- en ambos casos el monto NO se tipea a
        # mano, se calcula a partir de las líneas elegidas (cantidad *
        # precio_unitario frozen de la compra original) + impuestos opcionales.
        try:
            lineas = json.loads(detalles_json) if detalles_json else []
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(status_code=400, detail="detalles_json inválido")
        if not lineas:
            raise HTTPException(status_code=400, detail="Tenés que elegir al menos un producto")

        total_lineas = 0.0
        for linea in lineas:
            detalle_compra_id = linea.get("detalle_compra_id")
            cantidad = linea.get("cantidad")
            if not detalle_compra_id or cantidad is None or float(cantidad) <= 0:
                raise HTTPException(
                    status_code=400, detail="Cada línea necesita producto y cantidad mayor a 0"
                )

            detalle = (
                db.query(models.DetalleCompra)
                .filter(
                    models.DetalleCompra.id == detalle_compra_id, models.DetalleCompra.compra_id == compra_id
                )
                .first()
            )
            if not detalle:
                raise HTTPException(
                    status_code=404, detail="Esa línea de producto no pertenece a esta compra"
                )

            # El tope de "cuánto queda disponible" SOLO aplica a la devolución
            # (no podés acreditar más de lo que compraste). La reposición
            # (nota_debito) queda libre: no se valida contra lo devuelto,
            # puede llegar en otro momento/otra nota.
            if origen == "devolucion_producto":
                restante = _restante_detalle_compra(db, detalle_compra_id, detalle.cantidad)
                if float(cantidad) > restante:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Solo podés devolver hasta {restante:g} unidades de esa línea (ya devuelto en notas anteriores)",
                    )

            nueva_nota.detalles.append(
                models.NotaCompraDetalle(
                    detalle_compra_id=detalle_compra_id,
                    cantidad=cantidad,
                    precio_unitario=detalle.precio_unitario,
                )
            )
            total_lineas += float(cantidad) * float(detalle.precio_unitario)

        total_impuestos = 0.0
        try:
            impuestos = json.loads(impuestos_json) if impuestos_json else []
        except (json.JSONDecodeError, TypeError):
            raise HTTPException(status_code=400, detail="impuestos_json inválido")
        for imp in impuestos:
            impuesto_id = imp.get("impuesto_id")
            monto_imp = imp.get("monto")
            if not impuesto_id or monto_imp is None:
                raise HTTPException(status_code=400, detail="Cada impuesto necesita impuesto_id y monto")
            impuesto = db.query(models.Impuesto).filter(models.Impuesto.id == impuesto_id).first()
            if not impuesto:
                raise HTTPException(status_code=404, detail=f"Impuesto {impuesto_id} no encontrado")
            nueva_nota.impuestos_aplicados.append(
                models.NotaCompraImpuesto(impuesto_id=impuesto_id, monto=monto_imp)
            )
            total_impuestos += float(monto_imp)

        nueva_nota.monto_ars = total_lineas + total_impuestos
    else:
        # acuerdo_comercial / otro (crédito o débito, sin producto puntual): monto tipeado a mano.
        if monto_ars is None:
            raise HTTPException(status_code=400, detail="El monto es obligatorio para este origen")
        nueva_nota.monto_ars = monto_ars

    # Los productos devueltos salen a precio de la compra original (pesos
    # congelados), pero el USD de la nota es con SU cotización.
    nueva_nota.monto_usd = a_usd(nueva_nota.monto_ars, cotizacion_dolar)

    db.add(nueva_nota)
    # La nota cambia el total: lo que falta pagar se reparte de nuevo entre
    # los plazos pendientes (o, si estaba todo pagado y es de débito, queda
    # un plazo de ajuste que vence el día de la nota).
    db.flush()
    db.expire(compra, ["notas"])
    plazos.repartir_pendientes(compra, fecha_ajuste=fecha)
    db.commit()
    db.refresh(nueva_nota)

    return nueva_nota


@router.get("/{compra_id}/notas/{nota_id}")
def ver_nota_compra(
    compra_id: str,
    nota_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(get_current_user),
):
    nota = (
        db.query(models.NotaCompra)
        .filter(models.NotaCompra.id == nota_id, models.NotaCompra.compra_id == compra_id)
        .first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    return ver_comprobante(nota.archivo_path)


@router.delete("/{compra_id}/notas/{nota_id}", status_code=status.HTTP_200_OK)
def eliminar_nota_compra(
    compra_id: str,
    nota_id: str,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    nota = (
        db.query(models.NotaCompra)
        .filter(models.NotaCompra.id == nota_id, models.NotaCompra.compra_id == compra_id)
        .first()
    )
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    compra = nota.compra
    eliminar_comprobante(nota.archivo_path)
    db.delete(nota)
    # Sin la nota cambia el total: se reparte de nuevo lo que falta pagar.
    db.flush()
    db.expire(compra, ["notas"])
    plazos.repartir_pendientes(compra)
    db.commit()

    return {"detail": "Nota eliminada"}
