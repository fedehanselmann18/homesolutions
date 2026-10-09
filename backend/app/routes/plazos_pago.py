"""
Plazos de pago de compras y gastos (ver models.PlazoPago y app/plazos.py).

PUT /plazos-pago/{id}  -> requiere_admin. { pagado, fecha_pago? }: marca o
                          desmarca un plazo. Sin fecha, la de hoy. Devuelve
                          el plazo; el estado del movimiento se recalcula solo
                          (y lo pendiente se vuelve a repartir).

No hay alta ni baja sueltas: los plazos los arma la condición de pago de la
compra o el gasto.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import plazos
from app.audit import log_auditoria
from app.auth.oAuth2 import requiere_admin
from app.db import models
from app.db.db import get_db
from app.schemas import PlazoPagoOut, PlazoPagoUpdate

router = APIRouter(prefix="/plazos-pago", tags=["plazos_pago"])


@router.put("/{plazo_id}", response_model=PlazoPagoOut, status_code=status.HTTP_200_OK)
def marcar_plazo_pago(
    plazo_id: str,
    datos: PlazoPagoUpdate,
    db: Session = Depends(get_db),
    current_user: models.Usuario = Depends(requiere_admin),
):
    plazo = db.query(models.PlazoPago).filter(models.PlazoPago.id == plazo_id).first()
    if not plazo:
        raise HTTPException(status_code=404, detail="Plazo no encontrado")

    plazos.marcar_plazo(plazo, datos.pagado, datos.fecha_pago)
    db.commit()
    db.refresh(plazo)

    entidad, entidad_id = ("Compra", plazo.compra_id) if plazo.compra_id else ("Gasto", plazo.gasto_id)
    log_auditoria(db, current_user.id, "update", entidad, entidad_id)
    return plazo
