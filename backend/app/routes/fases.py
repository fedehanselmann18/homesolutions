from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import models
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db.db import get_db
from app.files.storage import eliminar_comprobante
from app.schemas import FaseCreate, FaseUpdate, FaseOut

router = APIRouter(
    prefix="/fases",
    tags=["fases"]
)


@router.get("/", response_model=list[FaseOut], status_code=status.HTTP_200_OK)
def get_all_fases(db: Session = Depends(get_db),
                   current_user: models.Usuario = Depends(get_current_user)):
    return db.query(models.Fase).all()


@router.get("/{fase_id}", response_model=FaseOut, status_code=status.HTTP_200_OK)
def get_fase_by_id(fase_id: str,
                    db: Session = Depends(get_db),
                    current_user: models.Usuario = Depends(get_current_user)):
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")
    return fase


@router.get("/proyectos/{proyecto_id}/fases", response_model=list[FaseOut], status_code=status.HTTP_200_OK)
def get_fases_by_proyecto(proyecto_id: str,
                           db: Session = Depends(get_db),
                           current_user: models.Usuario = Depends(get_current_user)):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return db.query(models.Fase).filter(models.Fase.proyecto_id == proyecto_id).all()


@router.post("/crear", response_model=FaseOut, status_code=status.HTTP_201_CREATED)
def create_fase(fase: FaseCreate,
                 db: Session = Depends(get_db),
                 current_user: models.Usuario = Depends(requiere_admin)):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == fase.proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    nueva_fase = models.Fase(
        proyecto_id=fase.proyecto_id,
        nombre=fase.nombre,
        descripcion=fase.descripcion,
        estado=fase.estado
    )

    try:
        db.add(nueva_fase)
        db.commit()
        db.refresh(nueva_fase)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear la fase: datos inválidos")

    return nueva_fase


@router.put("/{fase_id}", response_model=FaseOut, status_code=status.HTTP_200_OK)
def update_fase(fase_id: str,
                 fase: FaseUpdate,
                 db: Session = Depends(get_db),
                 current_user: models.Usuario = Depends(requiere_admin)):
    fase_existente = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase_existente:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    for key, value in fase.model_dump(exclude_unset=True).items():
        setattr(fase_existente, key, value)

    try:
        db.commit()
        db.refresh(fase_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar la fase: datos inválidos")

    return fase_existente


@router.delete("/{fase_id}", response_model=FaseOut, status_code=status.HTTP_200_OK)
def delete_fase(fase_id: str,
                 db: Session = Depends(get_db),
                 current_user: models.Usuario = Depends(requiere_admin)):
    fase = db.query(models.Fase).filter(models.Fase.id == fase_id).first()
    if not fase:
        raise HTTPException(status_code=404, detail="Fase no encontrada")

    fase_data = FaseOut.model_validate(fase)

    # CASCADE se lleva las Compras de esta Fase (con sus detalle/impuestos/comprobantes en DB),
    # pero NO borra los archivos físicos de los comprobantes -> hay que limpiarlos a mano antes.
    for compra in fase.compras:
        for comprobante in compra.comprobantes:
            eliminar_comprobante(comprobante.archivo_path)

    db.delete(fase)
    db.commit()

    return fase_data