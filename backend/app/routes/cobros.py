from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Form
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.db import models
from app.auth.oAuth2 import get_current_user, requiere_admin
from app.db.db import get_db
from app.files.storage import subir_comprobante, eliminar_comprobante, ver_comprobante
from datetime import date
from app.schemas import CobroCreate, CobroUpdate, CobroOut, ComprobanteCobroOut, NotaCobroOut

router = APIRouter(
    prefix="/cobros",
    tags=["cobros"]
)


@router.get("/", response_model=list[CobroOut], status_code=status.HTTP_200_OK)
def get_all_cobros(proyecto_id: str | None = None,  # "cliente": Cobro cuelga de Proyecto, no hay entidad Cliente propia
                    db: Session = Depends(get_db),
                    current_user: models.Usuario = Depends(get_current_user)):
    query = db.query(models.Cobro)
    if proyecto_id:
        query = query.filter(models.Cobro.proyecto_id == proyecto_id)
    return query.all()


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
    for nota in cobro.notas:
        eliminar_comprobante(nota.archivo_path)

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


# ---------------------------------------------------------------------------
# Notas (cuenta corriente: nota de crédito / nota de débito)
# ---------------------------------------------------------------------------

@router.post("/{cobro_id}/notas", response_model=NotaCobroOut, status_code=status.HTTP_201_CREATED)
def crear_nota_cobro(cobro_id: str,
                      archivo: UploadFile = File(...),
                      tipo: str = Form(...),  # "nota_credito" | "nota_debito"
                      tipo_factura: str = Form(...),  # SIEMPRE obligatorio (factura A/B/C, remito, recibo, otro)
                      monto: float = Form(...),
                      descripcion: str = Form(...),
                      fecha: date = Form(...),
                      origen: str | None = Form(None),  # "ajuste_precio" | "acuerdo_comercial" | "otro"
                      db: Session = Depends(get_db),
                      current_user: models.Usuario = Depends(requiere_admin)):
    cobro = db.query(models.Cobro).filter(models.Cobro.id == cobro_id).first()
    if not cobro:
        raise HTTPException(status_code=404, detail="Cobro no encontrado")

    if tipo not in ("nota_credito", "nota_debito"):
        raise HTTPException(status_code=400, detail="tipo debe ser 'nota_credito' o 'nota_debito'")

    path = subir_comprobante(archivo, "notas_cobro", cobro_id)

    nueva_nota = models.NotaCobro(
        cobro_id=cobro_id,
        proyecto_id=cobro.proyecto_id,  # denormalizado desde el cobro
        usuario_id=current_user.id,
        tipo=tipo,
        origen=origen,
        tipo_factura=tipo_factura,
        monto=monto,
        descripcion=descripcion,
        fecha=fecha,
        archivo_path=path
    )
    db.add(nueva_nota)
    db.commit()
    db.refresh(nueva_nota)

    return nueva_nota


@router.get("/{cobro_id}/notas/{nota_id}")
def ver_nota_cobro(cobro_id: str,
                    nota_id: str,
                    db: Session = Depends(get_db),
                    current_user: models.Usuario = Depends(get_current_user)):
    nota = db.query(models.NotaCobro).filter(
        models.NotaCobro.id == nota_id,
        models.NotaCobro.cobro_id == cobro_id
    ).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    return ver_comprobante(nota.archivo_path)


@router.delete("/{cobro_id}/notas/{nota_id}", status_code=status.HTTP_200_OK)
def eliminar_nota_cobro(cobro_id: str,
                         nota_id: str,
                         db: Session = Depends(get_db),
                         current_user: models.Usuario = Depends(requiere_admin)):
    nota = db.query(models.NotaCobro).filter(
        models.NotaCobro.id == nota_id,
        models.NotaCobro.cobro_id == cobro_id
    ).first()
    if not nota:
        raise HTTPException(status_code=404, detail="Nota no encontrada")

    eliminar_comprobante(nota.archivo_path)
    db.delete(nota)
    db.commit()

    return {"detail": "Nota eliminada"}