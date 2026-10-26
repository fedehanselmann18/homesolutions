"""
Tests de integración del CRUD de Proyecto. El caso más importante acá es el
DELETE: Proyecto tiene cascade="all, delete-orphan" hacia Fase/Gasto/Cobro
(y Fase hacia Compra), así que borrar un proyecto tiene que arrastrar todo
ese árbol Y limpiar los archivos físicos de los comprobantes (ver
app/api/projects.py: delete_project itera el árbol y llama a
eliminar_comprobante ANTES del db.delete). Acá se mockea eliminar_comprobante
(mismo patrón que test_ia.py con extraer_comprobante) para no depender de
disco/bucket y poder verificar con qué paths se la llamó.
"""

from datetime import date

from app.api import projects as ruta_proyectos
from app.db import models


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
    proyecto = models.Project(
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


def _armar_arbol_completo(db_session, usuario, proveedor, con_cobro=True):
    """Proyecto con una Fase (+ Compra con comprobante), un Gasto (con
    comprobante, sin fase) y, si `con_cobro`, un Cobro (con comprobante).

    El cobro es opcional porque una obra CON cobros ya no se puede borrar
    (ver delete_project): la plata que entró no se tira por un clic."""
    proyecto = models.Project(
        nombre="Proyecto Cascada",
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    fase = models.Phase(nombre="Fase 1", estado="en_curso", proyecto=proyecto)
    compra = models.Purchase(
        fase=fase,
        proveedor_id=proveedor.id,
        usuario_id=usuario.id,
        descripcion="Compra test",
        precio_neto_ars=100000,
        precio_neto_usd=100,
        cotizacion_dolar=1000,
        tipo_cambio="blue",
        tipo_factura="factura_a",
        fecha=date(2026, 1, 1),
        medio_pago="efectivo",
        estado_pago="pagado",
        estado_envio="entregado",
    )
    compra.comprobantes = [models.PurchaseReceipt(archivo_path="uploads/comprobantes_compra/c1/a.pdf")]

    gasto = models.Expense(
        proyecto=proyecto,
        usuario_id=usuario.id,
        monto_ars=5000,
        monto_usd=5,
        cotizacion_dolar=1000,
        tipo_cambio="blue",
        descripcion="Gasto test",
        fecha=date(2026, 1, 1),
        tipo_factura="factura_a",
    )
    gasto.comprobantes = [models.ExpenseReceipt(archivo_path="uploads/comprobantes_gasto/g1/b.pdf")]

    cobro = None
    if con_cobro:
        cobro = models.ClientPayment(
            proyecto=proyecto,
            usuario_id=usuario.id,
            monto_usd=200,
            monto_ars=200000,
            cotizacion_dolar=1000,
            tipo_cambio="blue",
            descripcion="Cobro test",
            fecha=date(2026, 1, 1),
            tipo_factura="factura_a",
        )
        cobro.comprobantes = [
            models.ClientPaymentReceipt(archivo_path="uploads/comprobantes_cobro/co1/c.pdf")
        ]

    objetos = [proyecto, fase, compra, gasto] + ([cobro] if con_cobro else [])
    db_session.add_all(objetos)
    db_session.commit()
    for obj in objetos:
        db_session.refresh(obj)
    return proyecto, fase, compra, gasto, cobro


def test_eliminar_proyecto_borra_en_cascada_y_limpia_comprobantes(
    client, db_session, headers_admin, usuario_admin, monkeypatch
):
    proveedor = models.Supplier(nombre="Proveedor Test", cuit="20-12345678-9")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)

    proyecto, fase, compra, gasto, _ = _armar_arbol_completo(
        db_session, usuario_admin, proveedor, con_cobro=False
    )

    rutas_borradas = []
    monkeypatch.setattr(ruta_proyectos, "eliminar_comprobante", lambda path: rutas_borradas.append(path))

    respuesta = client.delete(f"/proyectos/{proyecto.id}", headers=headers_admin)
    assert respuesta.status_code == 200

    # Los comprobantes (compra y gasto) tienen que haberse "borrado" (mock)
    # antes de que el CASCADE de la DB se lleve las filas.
    assert set(rutas_borradas) == {
        "uploads/comprobantes_compra/c1/a.pdf",
        "uploads/comprobantes_gasto/g1/b.pdf",
    }

    # El árbol entero desaparece de la DB, no solo el proyecto.
    assert db_session.query(models.Project).filter_by(id=proyecto.id).first() is None
    assert db_session.query(models.Phase).filter_by(id=fase.id).first() is None
    assert db_session.query(models.Purchase).filter_by(id=compra.id).first() is None
    assert db_session.query(models.Expense).filter_by(id=gasto.id).first() is None
    # El proveedor NO se toca (RESTRICT, y de todos modos no cuelga del proyecto).
    assert db_session.query(models.Supplier).filter_by(id=proveedor.id).first() is not None


def test_no_se_puede_eliminar_una_obra_con_cobros(
    client, db_session, headers_admin, usuario_admin, monkeypatch
):
    """Decisión de producto (25/10/2026): la plata que entró no se borra por un
    clic. Una obra con cobros se bloquea y el error dice cuántos hay, para
    poder borrarlos a mano si de verdad se quiere."""
    proveedor = models.Supplier(nombre="Proveedor Cobros", cuit="20-12345670-1")
    db_session.add(proveedor)
    db_session.commit()
    db_session.refresh(proveedor)
    proyecto, _, compra, gasto, cobro = _armar_arbol_completo(db_session, usuario_admin, proveedor)

    rutas_borradas = []
    monkeypatch.setattr(ruta_proyectos, "eliminar_comprobante", lambda path: rutas_borradas.append(path))

    respuesta = client.delete(f"/proyectos/{proyecto.id}", headers=headers_admin)

    assert respuesta.status_code == 409
    assert "1 cobro" in respuesta.json()["detail"]
    # Nada se tocó: ni la obra, ni sus movimientos, ni los archivos. El chequeo
    # va ANTES de la limpieza de comprobantes, que no tiene vuelta atrás.
    assert rutas_borradas == []
    assert db_session.query(models.Project).filter_by(id=proyecto.id).first() is not None
    assert db_session.query(models.ClientPayment).filter_by(id=cobro.id).first() is not None
    assert db_session.query(models.Purchase).filter_by(id=compra.id).first() is not None
    assert db_session.query(models.Expense).filter_by(id=gasto.id).first() is not None


def test_eliminar_proyecto_sin_ser_admin_es_rechazado(client, db_session, headers_lectura):
    proyecto = models.Project(
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
