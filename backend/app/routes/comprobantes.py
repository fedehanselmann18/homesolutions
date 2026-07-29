"""
Router de comprobantes para Compra, Gasto y Cobro.

Se mantiene la misma filosofía que el resto de HomeSolutions v2: router-only,
sin capa de Service/Repository. Cada bloque (compra/gasto/cobro) es una
repetición explícita a propósito -- mismo criterio que ya usaste en schemas.py
con ComprobanteCompraOut/ComprobanteGastoOut/ComprobanteCobroOut.

AJUSTAR ANTES DE USAR:
- Los imports de `Compra`, `Gasto`, `Cobro`, `ComprobanteCompra`,
  `ComprobanteGasto`, `ComprobanteCobro` asumen esos nombres en tu models.py.
  Si los llamaste distinto, es un find-and-replace.
- `get_db` y `get_current_user` asumen los nombres de tus dependencias
  existentes (las mismas que ya usás en usuarios_router / auth).
- Los comprobantes son de solo admin (subir/eliminar) igual que el resto de
  las acciones de escritura -- ajustá `requiere_admin` si tu chequeo de rol
  vive en otro lado.
"""

import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session

from app.db.db import get_db  # AJUSTAR: el nombre real de tu dependencia de sesión
from app.auth.oAuth2 import get_current_user  # AJUSTAR: tu dependencia de JWT existente
from app.db.models import (  # AJUSTAR: nombres reales en models.py
    Compra,
    Gasto,
    Cobro,
    ComprobanteCompra,
    ComprobanteGasto,
    ComprobanteCobro,
)
from app.schemas import (
    ComprobanteCompraOut,
    ComprobanteGastoOut,
    ComprobanteCobroOut,
    DatosToken,
)
from app.files.storage import subir_comprobante, eliminar_comprobante, ver_comprobante

router = APIRouter()


def requiere_admin(usuario: DatosToken = Depends(get_current_user)) -> DatosToken:
    """Mismo criterio de permisos que ya usás para editar/eliminar movimientos."""
    # AJUSTAR: si el rol viaja en el token o hay que buscarlo en DB, adaptar acá.
    if getattr(usuario, "rol", None) != "admin":
        raise HTTPException(status_code=403, detail="Necesitás rol admin para esta acción")
    return usuario


# ---------------------------------------------------------------------------
# Compra
# ---------------------------------------------------------------------------

@router.post("/compras/{compra_id}/comprobantes", response_model=ComprobanteCompraOut)
def subir_comprobante_compra(
    compra_id: uuid.UUID,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: DatosToken = Depends(requiere_admin),
):
    compra = db.get(Compra, compra_id)
    if not compra:
        raise HTTPException(status_code=404, detail="Compra no encontrada")

    path = subir_comprobante(archivo, carpeta="comprobantes_compra", entidad_id=str(compra_id))

    comprobante = ComprobanteCompra(compra_id=compra_id, archivo_path=path)
    db.add(comprobante)
    db.commit()
    db.refresh(comprobante)
    return comprobante


@router.get("/comprobantes-compra/{comprobante_id}")
def ver_comprobante_compra(
    comprobante_id: uuid.UUID,
    db: Session = Depends(get_db),
    _usuario: DatosToken = Depends(get_current_user),
):
    comprobante = db.get(ComprobanteCompra, comprobante_id)
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    return ver_comprobante(comprobante.archivo_path)


@router.delete("/comprobantes-compra/{comprobante_id}", status_code=204)
def eliminar_comprobante_compra(
    comprobante_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: DatosToken = Depends(requiere_admin),
):
    comprobante = db.get(ComprobanteCompra, comprobante_id)
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    # Primero el archivo físico, después la fila. Si el borrado del archivo
    # fallara, preferís que la fila siga existiendo (podés reintentar) antes
    # que perder la referencia y dejar el archivo huérfano en disco.
    eliminar_comprobante(comprobante.archivo_path)
    db.delete(comprobante)
    db.commit()


# ---------------------------------------------------------------------------
# Gasto
# ---------------------------------------------------------------------------

@router.post("/gastos/{gasto_id}/comprobantes", response_model=ComprobanteGastoOut)
def subir_comprobante_gasto(
    gasto_id: uuid.UUID,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: DatosToken = Depends(requiere_admin),
):
    gasto = db.get(Gasto, gasto_id)
    if not gasto:
        raise HTTPException(status_code=404, detail="Gasto no encontrado")

    path = subir_comprobante(archivo, carpeta="comprobantes_gasto", entidad_id=str(gasto_id))

    comprobante = ComprobanteGasto(gasto_id=gasto_id, archivo_path=path)
    db.add(comprobante)
    db.commit()
    db.refresh(comprobante)
    return comprobante


@router.get("/comprobantes-gasto/{comprobante_id}")
def ver_comprobante_gasto(
    comprobante_id: uuid.UUID,
    db: Session = Depends(get_db),
    _usuario: DatosToken = Depends(get_current_user),
):
    comprobante = db.get(ComprobanteGasto, comprobante_id)
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    return ver_comprobante(comprobante.archivo_path)


@router.delete("/comprobantes-gasto/{comprobante_id}", status_code=204)
def eliminar_comprobante_gasto(
    comprobante_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: DatosToken = Depends(requiere_admin),
):
    comprobante = db.get(ComprobanteGasto, comprobante_id)
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    eliminar_comprobante(comprobante.archivo_path)
    db.delete(comprobante)
    db.commit()


# ---------------------------------------------------------------------------
# Cobro
# ---------------------------------------------------------------------------

@router.post("/cobros/{cobro_id}/comprobantes", response_model=ComprobanteCobroOut)
def subir_comprobante_cobro(
    cobro_id: uuid.UUID,
    archivo: UploadFile = File(...),
    db: Session = Depends(get_db),
    _admin: DatosToken = Depends(requiere_admin),
):
    cobro = db.get(Cobro, cobro_id)
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    path = subir_comprobante(archivo, carpeta="comprobantes_cobro", entidad_id=str(cobro_id))

    comprobante = ComprobanteCobro(cobro_id=cobro_id, archivo_path=path)
    db.add(comprobante)
    db.commit()
    db.refresh(comprobante)
    return comprobante


@router.get("/comprobantes-cobro/{comprobante_id}")
def ver_comprobante_cobro(
    comprobante_id: uuid.UUID,
    db: Session = Depends(get_db),
    _usuario: DatosToken = Depends(get_current_user),
):
    comprobante = db.get(ComprobanteCobro, comprobante_id)
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")
    return ver_comprobante(comprobante.archivo_path)


@router.delete("/comprobantes-cobro/{comprobante_id}", status_code=204)
def eliminar_comprobante_cobro(
    comprobante_id: uuid.UUID,
    db: Session = Depends(get_db),
    _admin: DatosToken = Depends(requiere_admin),
):
    comprobante = db.get(ComprobanteCobro, comprobante_id)
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    eliminar_comprobante(comprobante.archivo_path)
    db.delete(comprobante)
    db.commit()