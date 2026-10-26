"""Tests de integración de app/api/expenses.py: creación, edición y el chequeo
de que solo un admin puede escribir (mismo criterio que el resto de routers)."""

from datetime import date

from app.db import models


def _crear_proyecto(db_session):
    proyecto = models.Project(
        nombre="Proyecto Test",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)
    return proyecto


def _crear_categoria_gasto(db_session, nombre="Flete"):
    categoria = models.ExpenseCategory(nombre=nombre)
    db_session.add(categoria)
    db_session.commit()
    db_session.refresh(categoria)
    return categoria


def test_crear_gasto_con_categorias(client, db_session, headers_admin, cotizacion):
    proyecto = _crear_proyecto(db_session)
    categoria = _crear_categoria_gasto(db_session)

    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_ars": 15000,
            **cotizacion,
            "descripcion": "Flete de materiales",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_b",
            "categoria_gasto_ids": [str(categoria.id)],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["monto_ars"] == 15000.0
    assert cuerpo["monto_usd"] == 15.0  # 15000 / 1000, congelado por el backend
    assert cuerpo["cotizacion_dolar"] == 1000.0
    assert cuerpo["tipo_cambio"] == "blue"
    assert [c["nombre"] for c in cuerpo["categorias"]] == ["Flete"]
    assert cuerpo["fase_id"] is None


def test_crear_gasto_con_proyecto_inexistente_da_404(client, headers_admin, cotizacion):
    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": "00000000-0000-0000-0000-000000000000",
            "monto_ars": 1000,
            **cotizacion,
            "descripcion": "Gasto huérfano",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_b",
        },
        headers=headers_admin,
    )
    assert respuesta.status_code == 404


def test_crear_gasto_sin_ser_admin_es_rechazado(client, db_session, headers_lectura, cotizacion):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_ars": 1000,
            **cotizacion,
            "descripcion": "Gasto",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_b",
        },
        headers=headers_lectura,
    )
    assert respuesta.status_code == 403


def test_actualizar_gasto_reemplaza_categorias_no_las_suma(
    client, db_session, headers_admin, usuario_admin, cotizacion
):
    proyecto = _crear_proyecto(db_session)
    flete = _crear_categoria_gasto(db_session, "Flete")
    bancarios = _crear_categoria_gasto(db_session, "Gastos bancarios")

    gasto = models.Expense(
        proyecto=proyecto,
        usuario_id=usuario_admin.id,
        monto_ars=1000,
        monto_usd=1,
        **cotizacion,
        descripcion="Gasto",
        fecha=date(2026, 1, 1),
        tipo_factura="factura_b",
    )
    gasto.categorias = [flete]
    db_session.add(gasto)
    db_session.commit()
    db_session.refresh(gasto)

    respuesta = client.put(
        f"/gastos/{gasto.id}",
        json={"categoria_gasto_ids": [str(bancarios.id)]},
        headers=headers_admin,
    )

    assert respuesta.status_code == 200
    nombres = {c["nombre"] for c in respuesta.json()["categorias"]}
    assert nombres == {"Gastos bancarios"}


# ---------------------------------------------------------------------------
# Congelamiento del USD: lo calcula SIEMPRE el
# backend y recalcula ignorando lo que mande el front.
# ---------------------------------------------------------------------------


def _body_gasto(proyecto, cotizacion, **extra):
    return {
        "proyecto_id": str(proyecto.id),
        "monto_ars": 60000,
        **cotizacion,
        "descripcion": "Materiales",
        "fecha": "2026-03-10",
        "tipo_factura": "factura_b",
        **extra,
    }


def test_el_usd_que_manda_el_front_se_ignora(client, db_session, headers_admin, cotizacion):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/gastos/crear", json=_body_gasto(proyecto, cotizacion, monto_usd=999999), headers=headers_admin
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["monto_usd"] == 60.0  # 60000 / 1000, no lo que vino


def test_el_usd_se_redondea_al_centavo(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/gastos/crear",
        json=_body_gasto(proyecto, {"cotizacion_dolar": 1487.3456, "tipo_cambio": "oficial"}),
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    assert respuesta.json()["monto_usd"] == 40.34  # 60000 / 1487.3456 = 40.3401...
    assert respuesta.json()["cotizacion_dolar"] == 1487.3456


def test_cambiar_la_cotizacion_recongela_el_usd(client, db_session, headers_admin, cotizacion):
    proyecto = _crear_proyecto(db_session)
    gasto = client.post("/gastos/crear", json=_body_gasto(proyecto, cotizacion), headers=headers_admin).json()

    respuesta = client.put(f"/gastos/{gasto['id']}", json={"cotizacion_dolar": 1200}, headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.json()["monto_ars"] == 60000.0  # el monto no se toca
    assert respuesta.json()["monto_usd"] == 50.0  # 60000 / 1200


def test_editar_otro_campo_no_toca_el_usd_congelado(client, db_session, headers_admin, cotizacion):
    proyecto = _crear_proyecto(db_session)
    gasto = client.post("/gastos/crear", json=_body_gasto(proyecto, cotizacion), headers=headers_admin).json()

    respuesta = client.put(
        f"/gastos/{gasto['id']}", json={"descripcion": "Otra", "monto_usd": 1}, headers=headers_admin
    )

    assert respuesta.json()["monto_usd"] == 60.0


def test_cotizacion_cero_o_tipo_invalido_se_rechazan(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)

    sin_dolar = client.post(
        "/gastos/crear",
        json=_body_gasto(proyecto, {"cotizacion_dolar": 0, "tipo_cambio": "blue"}),
        headers=headers_admin,
    )
    assert sin_dolar.status_code == 422
    assert sin_dolar.json()["detail"] == "La cotización del dólar tiene que ser mayor a 0"

    tipo_raro = client.post(
        "/gastos/crear",
        json=_body_gasto(proyecto, {"cotizacion_dolar": 1000, "tipo_cambio": "cripto"}),
        headers=headers_admin,
    )
    assert tipo_raro.status_code == 422


def test_sin_cotizacion_no_se_puede_cargar(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    body = _body_gasto(proyecto, {})

    assert client.post("/gastos/crear", json=body, headers=headers_admin).status_code == 422


def test_editar_la_tabla_de_cotizaciones_no_reescribe_lo_cargado(
    client, db_session, headers_admin, cotizacion
):
    """La tabla cotizaciones es sugerencia, no la verdad del movimiento."""
    proyecto = _crear_proyecto(db_session)
    fila = client.post(
        "/cotizaciones/crear",
        json={"fecha": "2026-03-10", "tipo": "blue", "valor": 1000},
        headers=headers_admin,
    ).json()
    gasto = client.post("/gastos/crear", json=_body_gasto(proyecto, cotizacion), headers=headers_admin).json()

    client.put(f"/cotizaciones/{fila['id']}", json={"valor": 2000}, headers=headers_admin)

    despues = client.get(f"/gastos/{gasto['id']}", headers=headers_admin).json()
    assert despues["cotizacion_dolar"] == 1000.0
    assert despues["monto_usd"] == 60.0
