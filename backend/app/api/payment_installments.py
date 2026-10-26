"""
Plazos de pago de compras y gastos (ver models.PaymentInstallment y app/payment_terms.py).

PUT /plazos-pago/{id}  -> requiere_admin. { pagado, fecha_pago? }: marca o
                          desmarca un plazo. Sin fecha, la de hoy. Devuelve
                          el plazo; el estado del movimiento se recalcula solo
                          (y lo pendiente se vuelve a repartir).

No hay alta ni baja sueltas: los plazos los arma la condición de pago de la
compra o el gasto.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.oauth2 import requiere_admin
from app.core.audit import log_auditoria
from app.db import models
from app.db.database import get_db
from app.domain import payment_terms
from app.schemas import PaymentInstallmentOut, PaymentInstallmentUpdate

router = APIRouter(prefix="/plazos-pago", tags=["plazos_pago"])


@router.put("/{plazo_id}", response_model=PaymentInstallmentOut, status_code=status.HTTP_200_OK)
def marcar_plazo_pago(
    plazo_id: str,
    datos: PaymentInstallmentUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(requiere_admin),
):
    plazo = db.query(models.PaymentInstallment).filter(models.PaymentInstallment.id == plazo_id).first()
    if not plazo:
        raise HTTPException(status_code=404, detail="Plazo no encontrado")

    payment_terms.marcar_plazo(plazo, datos.pagado, datos.fecha_pago)
    db.commit()
    db.refresh(plazo)

    entidad, entidad_id = ("Compra", plazo.compra_id) if plazo.compra_id else ("Gasto", plazo.gasto_id)
    log_auditoria(db, current_user.id, "update", entidad, entidad_id)
    return plazo
