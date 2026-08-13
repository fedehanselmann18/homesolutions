import json

from fastapi import APIRouter, Depends, HTTPException, Request, status, UploadFile, File, Form
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from app.db import models
from app.audit import log_auditoria
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db.db import get_db
from app.files.storage import subir_comprobante, eliminar_comprobante, ver_comprobante
from app.limiter import limiter
from datetime import date
from app.schemas import (
    CompraCreate, CompraUpdate, CompraOut,
    DetalleCompraCreate, DetalleCompraOut,
    CompraImpuestoCreate, CompraImpuestoOut,
    ComprobanteCompraOut, NotaCompraOut
)

router = APIRouter(
    prefix="/compras",
    tags=["compras"]
)

# ---------------------------------------------------------------------------
# GET (lista completa + anidados por proyecto/fase)
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[CompraOut], status_code=status.HTTP_200_OK)
def get_all_compras(proveedor_id: str | None = None,
                     db: Session = Depends(get_db),
                     current_user: models.Usuario = Depends(get_current_user)):
    query = db.query(models.Compra).options(
        joinedload(models.Compra.detalle).joinedload(models.DetalleCompra.producto).joinedload(models.Producto.categorias),
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.detalles),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.impuestos_aplicados).joinedload(models.NotaCompraImpuesto.impuesto),
    )
    if proveedor_id:
        query = query.filter(models.Compra.proveedor_id == proveedor_id)
    return query.all()


@router.get("/{compra_id}", response_model=CompraOut, status_code=status.HTTP_200_OK)
def get_compra_by_id(compra_id: str,
                      db: Session = Depends(get_db),
                      current_user: models.Usuario = Depends(get_current_user)):
    compra = db.query(models.Compra).options(
        joinedload(models.Compra.detalle).joinedload(models.DetalleCompra.producto).joinedload(models.Producto.categorias),
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.detalles),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.impuestos_aplicados).joinedload(models.NotaCompraImpuesto.impuesto),
    ).filter(models.Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")
    return compra


@router.get("/fases/{fase_id}/compras", response_model=list[CompraOut], status_code=status.HTTP_200_OK)
def get_compras_by_fase(fase_id: str,
                         db: Session = Depends(get_db),
                         current_user: models.Usuario = Depends(get_current_user)):
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    return db.query(models.Compra).options(
        joinedload(models.Compra.detalle).joinedload(models.DetalleCompra.producto).joinedload(models.Producto.categorias),
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.detalles),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.impuestos_aplicados).joinedload(models.NotaCompraImpuesto.impuesto),
    ).filter(models.Compra.fase_id == fase_id).all()


@router.get("/proyectos/{proyecto_id}/compras", response_model=list[CompraOut], status_code=status.HTTP_200_OK)
def get_compras_by_proyecto(proyecto_id: str,
                             db: Session = Depends(get_db),
                             current_user: models.Usuario = Depends(get_current_user)):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    # Compra no tiene FK directa a Proyecto, se llega vía Fase -> join necesario
    return db.query(models.Compra).join(models.Fase).options(
        joinedload(models.Compra.detalle).joinedload(models.DetalleCompra.producto).joinedload(models.Producto.categorias),
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.detalles),
        joinedload(models.Compra.notas).joinedload(models.NotaCompra.impuestos_aplicados).joinedload(models.NotaCompraImpuesto.impuesto),
    ).filter(models.Fase.proyecto_id == proyecto_id).all()


# ---------------------------------------------------------------------------
# POST : Crear compra (con detalle e impuestos anidados en el mismo body)
# ---------------------------------------------------------------------------

@router.post("/crear", response_model=CompraOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("100/minute")
def create_compra(request: Request,
                   compra: CompraCreate,
                   db: Session = Depends(get_db),
                   current_user: models.Usuario = Depends(requiere_admin)):
    fase = db.query(models.Fase).filter(models.Fase.id == compra.fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    proveedor = db.query(models.Proveedor).filter(models.Proveedor.id == compra.proveedor_id).first()
    if not proveedor:
        raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    nueva_compra = models.Compra(
        fase_id=compra.fase_id,
        proveedor_id=compra.proveedor_id,
        usuario_id=current_user.id,  # del JWT, nunca del body
        descripcion=compra.descripcion,
        precio_neto=compra.precio_neto,
        tipo_factura=compra.tipo_factura,
        fecha=compra.fecha,
        condicion_pago=compra.condicion_pago,
        estado_pago=compra.estado_pago,
        estado_envio=compra.estado_envio
    )

    for linea in compra.detalle:
        producto = db.query(models.Producto).filter(models.Producto.id == linea.producto_id).first()
        if not producto:
            raise HTTPException(status_code=404, detail=f"Producto {linea.producto_id} no encontrado")
        nueva_compra.detalle.append(models.DetalleCompra(
            producto_id=linea.producto_id,
            cantidad=linea.cantidad,
            precio_unitario=linea.precio_unitario
        ))

    for imp in compra.impuestos:
        impuesto = db.query(models.Impuesto).filter(models.Impuesto.id == imp.impuesto_id).first()
        if not impuesto:
            raise HTTPException(status_code=404, detail=f"Impuesto {imp.impuesto_id} no encontrado")
        nueva_compra.impuestos_aplicados.append(models.CompraImpuesto(
            impuesto_id=imp.impuesto_id,
            monto=imp.monto
        ))

    try:
        db.add(nueva_compra)
        db.commit()
        db.refresh(nueva_compra)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear la compra: datos inválidos")

    log_auditoria(current_user.id, "create", "Compra", nueva_compra.id)
    return nueva_compra


# ---------------------------------------------------------------------------
# PUT : Actualizar compra (solo campos propios, no detalle/impuestos)
# ---------------------------------------------------------------------------

@router.put("/{compra_id}", response_model=CompraOut, status_code=status.HTTP_200_OK)
def update_compra(compra_id: str,
                   compra: CompraUpdate,
                   db: Session = Depends(get_db),
                   current_user: models.Usuario = Depends(requiere_admin)):
    compra_existente = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra_existente:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    datos = compra.model_dump(exclude_unset=True)

    if "fase_id" in datos:
        fase = db.query(models.Fase).filter(models.Fase.id == datos["fase_id"]).first()
        if not fase:
            raise HTTPException(status_code=404, detail="Fase no encontrada")

    if "proveedor_id" in datos:
        proveedor = db.query(models.Proveedor).filter(models.Proveedor.id == datos["proveedor_id"]).first()
        if not proveedor:
            raise HTTPException(status_code=404, detail="Proveedor no encontrado")

    for key, value in datos.items():
        setattr(compra_existente, key, value)

    try:
        db.commit()
        db.refresh(compra_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar la compra: datos inválidos")

    log_auditoria(current_user.id, "update", "Compra", compra_existente.id)
    return compra_existente


# ---------------------------------------------------------------------------
# DELETE : Eliminar compra
# ---------------------------------------------------------------------------

@router.delete("/{compra_id}", response_model=CompraOut, status_code=status.HTTP_200_OK)
def delete_compra(compra_id: str,
                   db: Session = Depends(get_db),
                   current_user: models.Usuario = Depends(requiere_admin)):
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

    log_auditoria(current_user.id, "delete", "Compra", compra_data.id)
    return compra_data


# ---------------------------------------------------------------------------
# Sub-recurso: Detalle de Compra
# ---------------------------------------------------------------------------

@router.post("/{compra_id}/detalle", response_model=DetalleCompraOut, status_code=status.HTTP_201_CREATED)
def add_detalle_compra(compra_id: str,
                        detalle: DetalleCompraCreate,
                        db: Session = Depends(get_db),
                        current_user: models.Usuario = Depends(requiere_admin)):
    compra = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    producto = db.query(models.Producto).filter(models.Producto.id == detalle.producto_id).first()
    if not producto:
        raise HTTPException(status_code=404, detail="Producto no encontrado")

    nueva_linea = models.DetalleCompra(
        compra_id=compra_id,
        producto_id=detalle.producto_id,
        cantidad=detalle.cantidad,
        precio_unitario=detalle.precio_unitario
    )
    db.add(nueva_linea)
    db.commit()
    db.refresh(nueva_linea)

    return nueva_linea


@router.delete("/{compra_id}/detalle/{detalle_id}", status_code=status.HTTP_200_OK)
def delete_detalle_compra(compra_id: str,
                           detalle_id: str,
                           db: Session = Depends(get_db),
                           current_user: models.Usuario = Depends(requiere_admin)):
    linea = db.query(models.DetalleCompra).filter(
        models.DetalleCompra.id == detalle_id,
        models.DetalleCompra.compra_id == compra_id
    ).first()
    if not linea:
        raise HTTPException(status_code=404, detail="Línea de detalle no encontrada")

    db.delete(linea)
    db.commit()

    return {"detail": "Línea de detalle eliminada"}


# ---------------------------------------------------------------------------
# Sub-recurso: Impuestos aplicados a la Compra
# ---------------------------------------------------------------------------

@router.post("/{compra_id}/impuestos", response_model=CompraImpuestoOut, status_code=status.HTTP_201_CREATED)
def add_impuesto_compra(compra_id: str,
                         impuesto_data: CompraImpuestoCreate,
                         db: Session = Depends(get_db),
                         current_user: models.Usuario = Depends(requiere_admin)):
    compra = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    impuesto = db.query(models.Impuesto).filter(models.Impuesto.id == impuesto_data.impuesto_id).first()
    if not impuesto:
        raise HTTPException(status_code=404, detail="Impuesto no encontrado")

    nuevo_impuesto_aplicado = models.CompraImpuesto(
        compra_id=compra_id,
        impuesto_id=impuesto_data.impuesto_id,
        monto=impuesto_data.monto
    )

    try:
        db.add(nuevo_impuesto_aplicado)
        db.commit()
        db.refresh(nuevo_impuesto_aplicado)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ese impuesto ya fue cargado en esta compra")

    return nuevo_impuesto_aplicado


@router.delete("/{compra_id}/impuestos/{impuesto_aplicado_id}", status_code=status.HTTP_200_OK)
def delete_impuesto_compra(compra_id: str,
                            impuesto_aplicado_id: str,
                            db: Session = Depends(get_db),
                            current_user: models.Usuario = Depends(requiere_admin)):
    impuesto_aplicado = db.query(models.CompraImpuesto).filter(
        models.CompraImpuesto.id == impuesto_aplicado_id,
        models.CompraImpuesto.compra_id == compra_id
    ).first()
    if not impuesto_aplicado:
        raise HTTPException(status_code=404, detail="Impuesto aplicado no encontrado")

    db.delete(impuesto_aplicado)
    db.commit()

    return {"detail": "Impuesto eliminado de la compra"}


# ---------------------------------------------------------------------------
# Comprobantes
# ---------------------------------------------------------------------------

@router.post("/{compra_id}/comprobantes", response_model=ComprobanteCompraOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def upload_comprobante_compra(request: Request,
                               compra_id: str,
                               archivo: UploadFile = File(...),
                               db: Session = Depends(get_db),
                               current_user: models.Usuario = Depends(requiere_admin)):
    compra = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    path = subir_comprobante(archivo, "comprobantes_compra", compra_id)

    nuevo_comprobante = models.ComprobanteCompra(
        compra_id=compra_id,
        archivo_path=path
    )
    db.add(nuevo_comprobante)
    db.commit()
    db.refresh(nuevo_comprobante)

    return nuevo_comprobante


@router.get("/{compra_id}/comprobantes/{comprobante_id}")
def get_comprobante_compra(compra_id: str,
                            comprobante_id: str,
                            db: Session = Depends(get_db),
                            current_user: models.Usuario = Depends(get_current_user)):
    comprobante = db.query(models.ComprobanteCompra).filter(
        models.ComprobanteCompra.id == comprobante_id,
        models.ComprobanteCompra.compra_id == compra_id
    ).first()
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    return ver_comprobante(comprobante.archivo_path)


@router.delete("/{compra_id}/comprobantes/{comprobante_id}", status_code=status.HTTP_200_OK)
def delete_comprobante_compra(compra_id: str,
                               comprobante_id: str,
                               db: Session = Depends(get_db),
                               current_user: models.Usuario = Depends(requiere_admin)):
    comprobante = db.query(models.ComprobanteCompra).filter(
        models.ComprobanteCompra.id == comprobante_id,
        models.ComprobanteCompra.compra_id == compra_id
    ).first()
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
    ya_devuelto = db.query(func.coalesce(func.sum(models.NotaCompraDetalle.cantidad), 0)).filter(
        models.NotaCompraDetalle.detalle_compra_id == detalle_compra_id
    ).scalar()
    return float(cantidad_comprada) - float(ya_devuelto or 0)


@router.post("/{compra_id}/notas", response_model=NotaCompraOut, status_code=status.HTTP_201_CREATED)
@limiter.limit("20/minute")
def crear_nota_compra(request: Request,
                       compra_id: str,
                       archivo: UploadFile = File(...),
                       tipo: str = Form(...),  # "nota_credito" | "nota_debito"
                       tipo_factura: str = Form(...),  # SIEMPRE obligatorio (factura A/B/C, remito, recibo, otro)
                       descripcion: str = Form(...),
                       fecha: date = Form(...),
                       origen: str | None = Form(None),  # "devolucion_producto" | "reposicion_producto" | "acuerdo_comercial" | "otro"
                       monto: float | None = Form(None),  # obligatorio salvo devolucion_producto/reposicion_producto (se calcula solo)
                       detalles_json: str | None = Form(None),  # JSON [{detalle_compra_id, cantidad}], solo devolucion_producto/reposicion_producto
                       impuestos_json: str | None = Form(None),  # JSON [{impuesto_id, monto}], opcional junto a detalles_json
                       db: Session = Depends(get_db),
                       current_user: models.Usuario = Depends(requiere_admin)):
    compra = db.query(models.Compra).filter(models.Compra.id == compra_id).first()
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    if tipo not in ("nota_credito", "nota_debito"):
        raise HTTPException(status_code=400, detail="tipo debe ser 'nota_credito' o 'nota_debito'")

    if origen == "devolucion_producto" and tipo != "nota_credito":
        raise HTTPException(status_code=400, detail="'devolucion_producto' solo aplica a nota_credito")
    if origen == "reposicion_producto" and tipo != "nota_debito":
        raise HTTPException(status_code=400, detail="'reposicion_producto' solo aplica a nota_debito")

    usa_lineas_producto = origen in ("devolucion_producto", "reposicion_producto")

    path = subir_comprobante(archivo, "notas_compra", compra_id)

    nueva_nota = models.NotaCompra(
        compra_id=compra_id,
        proveedor_id=compra.proveedor_id,  # denormalizado desde la compra
        usuario_id=current_user.id,
        tipo=tipo,
        origen=origen,
        tipo_factura=tipo_factura,
        monto=0,  # se pisa más abajo (calculado o manual)
        descripcion=descripcion,
        fecha=fecha,
        archivo_path=path
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
                raise HTTPException(status_code=400, detail="Cada línea necesita producto y cantidad mayor a 0")

            detalle = db.query(models.DetalleCompra).filter(
                models.DetalleCompra.id == detalle_compra_id,
                models.DetalleCompra.compra_id == compra_id
            ).first()
            if not detalle:
                raise HTTPException(status_code=404, detail="Esa línea de producto no pertenece a esta compra")

            # El tope de "cuánto queda disponible" SOLO aplica a la devolución
            # (no podés acreditar más de lo que compraste). La reposición
            # (nota_debito) queda libre: no se valida contra lo devuelto,
            # puede llegar en otro momento/otra nota.
            if origen == "devolucion_producto":
                restante = _restante_detalle_compra(db, detalle_compra_id, detalle.cantidad)
                if float(cantidad) > restante:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Solo podés devolver hasta {restante:g} unidades de esa línea (ya devuelto en notas anteriores)"
                    )

            nueva_nota.detalles.append(models.NotaCompraDetalle(
                detalle_compra_id=detalle_compra_id,
                cantidad=cantidad,
                precio_unitario=detalle.precio_unitario
            ))
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
            nueva_nota.impuestos_aplicados.append(models.NotaCompraImpuesto(
                impuesto_id=impuesto_id,
                monto=monto_imp
            ))
            total_impuestos += float(monto_imp)

        nueva_nota.monto = total_lineas + total_impuestos
    else:
        # acuerdo_comercial / otro (crédito o débito, sin producto puntual): monto tipeado a mano.
        if monto is None:
            raise HTTPException(status_code=400, detail="monto es obligatorio para este origen")
        nueva_nota.monto = monto

    db.add(nueva_nota)
    db.commit()
    db.refresh(nueva_nota)

    return nueva_nota


@router.get("/{compra_id}/notas/{nota_id}")
def ver_nota_compra(compra_id: str,
                     nota_id: str,
                     db: Session = Depends(get_db),
                     current_user: models.Usuario = Depends(get_current_user)):
    nota = db.query(models.NotaCompra).filter(
        models.NotaCompra.id == nota_id,
        models.NotaCompra.compra_id == compra_id
    ).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    return ver_comprobante(nota.archivo_path)


@router.delete("/{compra_id}/notas/{nota_id}", status_code=status.HTTP_200_OK)
def eliminar_nota_compra(compra_id: str,
                          nota_id: str,
                          db: Session = Depends(get_db),
                          current_user: models.Usuario = Depends(requiere_admin)):
    nota = db.query(models.NotaCompra).filter(
        models.NotaCompra.id == nota_id,
        models.NotaCompra.compra_id == compra_id
    ).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    eliminar_comprobante(nota.archivo_path)
    db.delete(nota)
    db.commit()

    return {"detail": "Nota eliminada"}