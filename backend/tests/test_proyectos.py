"""
Tests de integración del CRUD de Proyecto. El caso más importante acá es el
DELETE: Proyecto tiene cascade="all, delete-orphan" hacia Fase/Gasto/Cobro
(y Fase hacia Compra), así que borrar un proyecto tiene que arrastrar todo
ese árbol Y limpiar los archivos físicos de los comprobantes (ver
routes/proyectos.py: delete_project itera el árbol y llama a
eliminar_comprobante ANTES del db.delete). Acá se mockea eliminar_comprobante
(mismo patrón que test_ia.py con extraer_comprobante) para no depender de
disco/R2 y poder verificar con qué paths se la llamó.
"""

from datetime import date

from app.db import models
from app.routes import proyectos as ruta_proyectos


def _proyecto_payload(**overrides):
    payload = {
        "nombre": "Casa Rivadavia",
        "direccion": "Rivadavia 1234",
        "fecha_inicio": "2026-01-01",
        "estado": "en_curso",
        "precio_acordado_usd": 5000000,
    }
    payload.update(overrides)
    return payload


def test_crear_proyecto_como_admin(client, headers_admin):
    respuesta = client.post("/proyectos/crear", json=_proyecto_payload(), headers=headers_admin)

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["nombre"] == "Casa Rivadavia"
    assert cuerpo["estado"] == "en_curso"


def test_crear_proyecto_sin_ser_admin_es_rechazado(client, headers_lectura):
    respuesta = client.post("/proyectos/crear", json=_proyecto_payload(), headers=headers_lectura)
    assert respuesta.status_code == 403


def test_actualizar_proyecto_solo_pisa_los_campos_enviados(client, db_session, headers_admin):
    proyecto = models.Proyecto(
        nombre="Casa Vieja",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="a_iniciar",
        precio_acordado_usd=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)

    respuesta = client.put(
        f"/proyectos/{proyecto.id}",
        json={"estado": "en_curso"},
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["estado"] == "en_curso"
    assert cuerpo["nombre"] == "Casa Vieja"  # no pisado por el PUT parcial


def _armar_arbol_completo(db_session, usuario, proveedor):
    """Proyecto con una Fase (+ Compra con comprobante), un Gasto (con
    comprobante, sin fase) y un Cobro (con comprobante) -- las tres ramas
    que delete_project tiene que recorrer y limpiar."""
    proyecto = models.Proyecto(
        nombre="Proyecto Cascada",
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    fase = models.Fase(nombre="Fase 1", estado="en_curso", proyecto=proyecto)
    compra = models.Compra(
        fase=fase,
        proveedor_id=proveedor.id,
        usuario_id=usuario.id,
        descripcion="Compra test",
        precio_neto=100000,
        tipo_factura="A",
        fecha=date(2026, 1, 1),
        condicion_pago="contado",
        estado_pago="pagado",
        estado_envio="entregado",
    )
    compra.comprobantes = [models.ComprobanteCompra(archivo_path="uploads/comprobantes_compra/c1/a.pdf")]

    gasto = models.Gasto(
        proyecto=proyecto,
        usuario_id=usuario.id,
        monto=5000,
        descripcion="Gasto test",
        fecha=date(2026, 1, 1),
        tipo_factura="A",
    )
    gasto.comprobantes = [models.ComprobanteGasto(archivo_path="uploads/comprobantes_gasto/g1/b.pdf")]

    cobro = models.Cobro(
        proyecto=proyecto,
        usuario_id=usuario.id,
        monto=200000,
        descripcion="Cobro test",
        fecha=date(2026, 1, 1),
        tipo_factura="A",
    )
    cobro.comprobantes = [models.ComprobanteCobro(archivo_path="uploads/comprobantes_cobro/co1/c.pdf")]

    db_session.add_all([proyecto, fase, compra, gasto, cobro])
    db_session.commit()
    for obj in (proyecto, fase, compra, gasto, cobro):
        db_session.refresh(obj)
    return proyecto, fase, compra, gasto, cobro


def test_eliminar_proyecto_borra_en_cascada_y_limpia_comprobantes(
    client, db_session, headers_admin, usuario_admin, monkeypatch
):
    proveedor = models.Proveedor(nombre="Proveedor Test", cuit="20-12345678-9")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)

    proyecto, fase, compra, gasto, cobro = _armar_arbol_completo(db_session, usuario_admin, proveedor)

    rutas_borradas = []
    monkeypatch.setattr(ruta_proyectos, "eliminar_comprobante", lambda path: rutas_borradas.append(path))

    respuesta = client.delete(f"/proyectos/{proyecto.id}", headers=headers_admin)
    assert respuesta.status_code == 200

    # Los tres comprobantes (compra/gasto/cobro) tienen que haberse "borrado"
    # (mock) antes de que el CASCADE de la DB se lleve las filas.
    assert set(rutas_borradas) == {
        "uploads/comprobantes_compra/c1/a.pdf",
        "uploads/comprobantes_gasto/g1/b.pdf",
        "uploads/comprobantes_cobro/co1/c.pdf",
    }

    # El árbol entero desaparece de la DB, no solo el proyecto.
    assert db_session.query(models.Proyecto).filter_by(id=proyecto.id).first() is None
    assert db_session.query(models.Fase).filter_by(id=fase.id).first() is None
    assert db_session.query(models.Compra).filter_by(id=compra.id).first() is None
    assert db_session.query(models.Gasto).filter_by(id=gasto.id).first() is None
    assert db_session.query(models.Cobro).filter_by(id=cobro.id).first() is None
    # El proveedor NO se toca (RESTRICT, y de todos modos no cuelga del proyecto).
    assert db_session.query(models.Proveedor).filter_by(id=proveedor.id).first() is not None


def test_eliminar_proyecto_sin_ser_admin_es_rechazado(client, db_session, headers_lectura):
    proyecto = models.Proyecto(
        nombre="Proyecto Protegido",
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="a_iniciar",
        precio_acordado_usd=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)

    respuesta = client.delete(f"/proyectos/{proyecto.id}", headers=headers_lectura)
    assert respuesta.status_code == 403
