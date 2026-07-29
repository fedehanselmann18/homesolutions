from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload
from app.db import models
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db.db import get_db
from app.files.storage import subir_comprobante, eliminar_comprobante, ver_comprobante
from app.schemas import (
    CompraCreate, CompraUpdate, CompraOut,
    DetalleCompraCreate, DetalleCompraOut,
    CompraImpuestoCreate, CompraImpuestoOut,
    ComprobanteCompraOut
)

router = APIRouter(
    prefix="/compras",
    tags=["compras"]
)

# ---------------------------------------------------------------------------
# GET (lista completa + anidados por proyecto/fase)
# ---------------------------------------------------------------------------

@router.get("/", response_model=list[CompraOut], status_code=status.HTTP_200_OK)
def get_all_compras(db: Session = Depends(get_db),
                     current_user: models.Usuario = Depends(get_current_user)):
    return db.query(models.Compra).options(
        joinedload(models.Compra.detalle).joinedload(models.DetalleCompra.producto).joinedload(models.Producto.categorias),
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto)
    ).all()


@router.get("/{compra_id}", response_model=CompraOut, status_code=status.HTTP_200_OK)
def get_compra_by_id(compra_id: str,
                      db: Session = Depends(get_db),
                      current_user: models.Usuario = Depends(get_current_user)):
    compra = db.query(models.Compra).options(
        joinedload(models.Compra.detalle).joinedload(models.DetalleCompra.producto).joinedload(models.Producto.categorias),
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto)
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
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto)
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
        joinedload(models.Compra.impuestos_aplicados).joinedload(models.CompraImpuesto.impuesto)
    ).filter(models.Fase.proyecto_id == proyecto_id).all()


# ---------------------------------------------------------------------------
# POST : Crear compra (con detalle e impuestos anidados en el mismo body)
# ---------------------------------------------------------------------------

@router.post("/crear", response_model=CompraOut, status_code=status.HTTP_201_CREATED)
def create_compra(compra: CompraCreate,
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

    # Borrar archivos físicos de los comprobantes antes de que el CASCADE se lleve las filas
    for comprobante in compra.comprobantes:
        eliminar_comprobante(comprobante.archivo_path)

    db.delete(compra)
    db.commit()

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
def upload_comprobante_compra(compra_id: str,
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