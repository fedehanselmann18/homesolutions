"""
Transición automática a "en curso" con el primer movimiento
(app/domain/project_status.py): una compra o un gasto arrancan la fase y la obra; un
cobro (anticipo) no; y nunca se reabre algo terminado.
"""

from datetime import date

from app.db import models

COTIZACION = {"cotizacion_dolar": 1000, "tipo_cambio": "blue"}


def _obra(db_session, estado_proyecto="a_iniciar", estado_fase="por_empezar"):
    proyecto = models.Project(
        nombre="Terravista",
        direccion="Lote 514",
        fecha_inicio=date(2026, 10, 1),
        estado=estado_proyecto,
        precio_acordado_usd=103000,
    )
    fase = models.Phase(nombre="Instalación", estado=estado_fase, proyecto=proyecto)
    proveedor = models.Supplier(nombre="Proveedor Test", cuit="20-12345678-9")
    db_session.add_all([proyecto, fase, proveedor])
    db_session.commit()
    return proyecto, fase, proveedor


def _crear_compra(client, headers, fase, proveedor, fecha="2026-10-08"):
    return client.post(
        "/compras/crear",
        json={
            "fase_id": str(fase.id),
            "proveedor_id": str(proveedor.id),
            "descripcion": "Compre aires",
            "precio_neto_ars": 100000,
            **COTIZACION,
            "tipo_factura": "factura_a",
            "fecha": fecha,
            "medio_pago": "efectivo",
            "estado_pago": "pagado",
            "estado_envio": "entregado",
            "detalle": [],
            "impuestos": [],
        },
        headers=headers,
    )


def test_primera_compra_pasa_fase_y_obra_a_en_curso(client, db_session, headers_admin):
    proyecto, fase, proveedor = _obra(db_session)

    assert _crear_compra(client, headers_admin, fase, proveedor).status_code == 201

    db_session.refresh(fase)
    db_session.refresh(proyecto)
    assert fase.estado == "en_curso"
    # En curso desde la fecha de la compra, no desde el día en que se cargó.
    assert fase.fecha_en_curso_desde == date(2026, 10, 8)
    assert proyecto.estado == "en_curso"


def test_compra_vieja_arranca_la_fase_en_su_fecha(client, db_session, headers_admin):
    """Cargar hoy una compra de agosto deja la fase en curso desde agosto."""
    _, fase, proveedor = _obra(db_session)

    assert _crear_compra(client, headers_admin, fase, proveedor, fecha="2026-08-03").status_code == 201

    db_session.refresh(fase)
    assert fase.fecha_en_curso_desde == date(2026, 8, 3)


def test_compra_anterior_a_la_fecha_de_en_curso_la_retrocede(client, db_session, headers_admin):
    """Si después se carga algo más viejo, la fase arrancó con eso."""
    _, fase, proveedor = _obra(db_session)
    _crear_compra(client, headers_admin, fase, proveedor, fecha="2026-09-10")
    _crear_compra(client, headers_admin, fase, proveedor, fecha="2026-07-01")
    _crear_compra(client, headers_admin, fase, proveedor, fecha="2026-09-30")

    db_session.refresh(fase)
    assert fase.fecha_en_curso_desde == date(2026, 7, 1)


def test_gasto_sin_fase_pasa_solo_la_obra(client, db_session, headers_admin):
    proyecto, fase, _ = _obra(db_session)

    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_ars": 5000,
            **COTIZACION,
            "descripcion": "Flete",
            "fecha": "2026-10-08",
            "tipo_factura": "factura_b",
        },
        headers=headers_admin,
    )
    assert respuesta.status_code == 201, respuesta.text

    db_session.refresh(fase)
    db_session.refresh(proyecto)
    assert proyecto.estado == "en_curso"
    assert fase.estado == "por_empezar"


def test_un_cobro_anticipo_no_arranca_la_obra(client, db_session, headers_admin):
    proyecto, _, _ = _obra(db_session)

    respuesta = client.post(
        "/cobros/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_usd": 30000,
            **COTIZACION,
            "descripcion": "Anticipo",
            "fecha": "2026-10-01",
            "tipo_factura": "factura_a",
        },
        headers=headers_admin,
    )
    assert respuesta.status_code == 201

    db_session.refresh(proyecto)
    assert proyecto.estado == "a_iniciar"


def test_no_reabre_una_fase_terminada_ni_una_obra_terminada(client, db_session, headers_admin):
    proyecto, fase, proveedor = _obra(db_session, estado_proyecto="terminado", estado_fase="terminada")

    assert _crear_compra(client, headers_admin, fase, proveedor).status_code == 201

    db_session.refresh(fase)
    db_session.refresh(proyecto)
    assert fase.estado == "terminada"
    assert proyecto.estado == "terminado"
