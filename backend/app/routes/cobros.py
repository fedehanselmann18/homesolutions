from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import models
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db.db import get_db
from app.files.storage import subir_comprobante, eliminar_comprobante, ver_comprobante
from app.schemas import CobroCreate, CobroUpdate, CobroOut, ComprobanteCobroOut

router = APIRouter(
    prefix="/cobros",
    tags=["cobros"]
)


@router.get("/", response_model=list[CobroOut], status_code=status.HTTP_200_OK)
def get_all_cobros(db: Session = Depends(get_db),
                    current_user: models.Usuario = Depends(get_current_user)):
    return db.query(models.Cobro).all()


@router.get("/{cobro_id}", response_model=CobroOut, status_code=status.HTTP_200_OK)
def get_cobro_by_id(cobro_id: str,
                     db: Session = Depends(get_db),
                     current_user: models.Usuario = Depends(get_current_user)):
    cobro = db.query(models.Cobro).filter(models.Cobro.id == cobro_id).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")
    return cobro


@router.get("/proyectos/{proyecto_id}/cobros", response_model=list[CobroOut], status_code=status.HTTP_200_OK)
def get_cobros_by_proyecto(proyecto_id: str,
                            db: Session = Depends(get_db),
                            current_user: models.Usuario = Depends(get_current_user)):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    return db.query(models.Cobro).filter(models.Cobro.proyecto_id == proyecto_id).all()


@router.post("/crear", response_model=CobroOut, status_code=status.HTTP_201_CREATED)
def create_cobro(cobro: CobroCreate,
                  db: Session = Depends(get_db),
                  current_user: models.Usuario = Depends(requiere_admin)):
    proyecto = db.query(models.Proyecto).filter(models.Proyecto.id == cobro.proyecto_id).first()
    if not proyecto:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado")

    nuevo_cobro = models.Cobro(
        proyecto_id=cobro.proyecto_id,
        usuario_id=current_user.id,  # del JWT, nunca del body
        monto=cobro.monto,
        descripcion=cobro.descripcion,
        fecha=cobro.fecha,
        tipo_factura=cobro.tipo_factura
    )

    try:
        db.add(nuevo_cobro)
        db.commit()
        db.refresh(nuevo_cobro)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear el cobro: datos inválidos")

    return nuevo_cobro


@router.put("/{cobro_id}", response_model=CobroOut, status_code=status.HTTP_200_OK)
def update_cobro(cobro_id: str,
                  cobro: CobroUpdate,
                  db: Session = Depends(get_db),
                  current_user: models.Usuario = Depends(requiere_admin)):
    cobro_existente = db.query(models.Cobro).filter(models.Cobro.id == cobro_id).first()
    if not cobro_existente:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    for key, value in cobro.model_dump(exclude_unset=True).items():
        setattr(cobro_existente, key, value)

    try:
        db.commit()
        db.refresh(cobro_existente)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al actualizar el cobro: datos inválidos")

    return cobro_existente


@router.delete("/{cobro_id}", response_model=CobroOut, status_code=status.HTTP_200_OK)
def delete_cobro(cobro_id: str,
                  db: Session = Depends(get_db),
                  current_user: models.Usuario = Depends(requiere_admin)):
    cobro = db.query(models.Cobro).filter(models.Cobro.id == cobro_id).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    cobro_data = CobroOut.model_validate(cobro)

    for comprobante in cobro.comprobantes:
        eliminar_comprobante(comprobante.archivo_path)

    db.delete(cobro)
    db.commit()

    return cobro_data


@router.post("/{cobro_id}/comprobantes", response_model=ComprobanteCobroOut, status_code=status.HTTP_201_CREATED)
def upload_comprobante_cobro(cobro_id: str,
                              archivo: UploadFile = File(...),
                              db: Session = Depends(get_db),
                              current_user: models.Usuario = Depends(requiere_admin)):
    cobro = db.query(models.Cobro).filter(models.Cobro.id == cobro_id).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    path = subir_comprobante(archivo, "comprobantes_cobro", cobro_id)

    nuevo_comprobante = models.ComprobanteCobro(
        cobro_id=cobro_id,
        archivo_path=path
    )
    db.add(nuevo_comprobante)
    db.commit()
    db.refresh(nuevo_comprobante)

    return nuevo_comprobante


@router.get("/{cobro_id}/comprobantes/{comprobante_id}")
def get_comprobante_cobro(cobro_id: str,
                           comprobante_id: str,
                           db: Session = Depends(get_db),
                           current_user: models.Usuario = Depends(get_current_user)):
    comprobante = db.query(models.ComprobanteCobro).filter(
        models.ComprobanteCobro.id == comprobante_id,
        models.ComprobanteCobro.cobro_id == cobro_id
    ).first()
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    return ver_comprobante(comprobante.archivo_path)


@router.delete("/{cobro_id}/comprobantes/{comprobante_id}", status_code=status.HTTP_200_OK)
def delete_comprobante_cobro(cobro_id: str,
                              comprobante_id: str,
                              db: Session = Depends(get_db),
                              current_user: models.Usuario = Depends(requiere_admin)):
    comprobante = db.query(models.ComprobanteCobro).filter(
        models.ComprobanteCobro.id == comprobante_id,
        models.ComprobanteCobro.cobro_id == cobro_id
    ).first()
    if not comprobante:
        raise HTTPException(status_code=404, detail="Comprobante no encontrado")

    eliminar_comprobante(comprobante.archivo_path)
    db.delete(comprobante)
    db.commit()

    return {"detail": "Comprobante eliminado"}