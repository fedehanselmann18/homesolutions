"""Tests de integración de routes/gastos.py: creación, edición y el chequeo
de que solo un admin puede escribir (mismo criterio que el resto de routers)."""

from datetime import date

from app.db import models


def _crear_proyecto(db_session):
    proyecto = models.Proyecto(
        nombre="Proyecto Test", direccion="Calle Falsa 123", fecha_inicio=date(2026, 1, 1),
        estado="en_curso", precio_acordado=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)
    return proyecto


def _crear_categoria_gasto(db_session, nombre="Flete"):
    categoria = models.CategoriaGasto(nombre=nombre)
    db_session.add(categoria)
    db_session.commit()
    db_session.refresh(categoria)
    return categoria


def test_crear_gasto_con_categorias(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    categoria = _crear_categoria_gasto(db_session)

    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto": 15000,
            "descripcion": "Flete de materiales",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_b",
            "categoria_gasto_ids": [str(categoria.id)],
        },
        headers=headers_admin,
    )

    assert respuesta.status_code == 201
    cuerpo = respuesta.json()
    assert cuerpo["monto"] == 15000.0
    assert [c["nombre"] for c in cuerpo["categorias"]] == ["Flete"]
    assert cuerpo["fase_id"] is None


def test_crear_gasto_con_proyecto_inexistente_da_404(client, headers_admin):
    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": "00000000-0000-0000-0000-000000000000",
            "monto": 1000,
            "descripcion": "Gasto huérfano",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_b",
        },
        headers=headers_admin,
    )
    assert respuesta.status_code == 404


def test_crear_gasto_sin_ser_admin_es_rechazado(client, db_session, headers_lectura):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto": 1000,
            "descripcion": "Gasto",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_b",
        },
        headers=headers_lectura,
    )
    assert respuesta.status_code == 403


def test_actualizar_gasto_reemplaza_categorias_no_las_suma(client, db_session, headers_admin, usuario_admin):
    proyecto = _crear_proyecto(db_session)
    flete = _crear_categoria_gasto(db_session, "Flete")
    bancarios = _crear_categoria_gasto(db_session, "Gastos bancarios")

    gasto = models.Gasto(
        proyecto=proyecto, usuario_id=usuario_admin.id, monto=1000, descripcion="Gasto",
        fecha=date(2026, 1, 1), tipo_factura="factura_b",
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
