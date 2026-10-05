"""Tests de integración de los tres catálogos (impuestos, categorías de
producto y categorías de gasto): un nombre repetido tiene que devolver un
motivo que el usuario entienda -- es el error más probable en la pantalla de
catálogos -- y el borrado de algo en uso tiene que frenarse con su motivo."""

from datetime import date

import pytest

from app.db import models

CATALOGOS = [
    ("/impuestos", {}, "Ya existe un impuesto con ese nombre"),
    ("/categorias", {"tipo": "materiales"}, "Ya existe una categoría con ese nombre"),
    ("/categorias-gasto", {}, "Ya existe una categoría de gasto con ese nombre"),
]


@pytest.mark.parametrize("prefijo, extra, mensaje", CATALOGOS)
def test_crear_con_nombre_repetido_explica_el_motivo(client, headers_admin, prefijo, extra, mensaje):
    primera = client.post(f"{prefijo}/crear", json={"nombre": "Repetido", **extra}, headers=headers_admin)
    assert primera.status_code == 201

    segunda = client.post(f"{prefijo}/crear", json={"nombre": "Repetido", **extra}, headers=headers_admin)
    assert segunda.status_code == 400
    assert segunda.json()["detail"] == mensaje


@pytest.mark.parametrize("prefijo, extra, mensaje", CATALOGOS)
def test_renombrar_a_un_nombre_existente_explica_el_motivo(client, headers_admin, prefijo, extra, mensaje):
    client.post(f"{prefijo}/crear", json={"nombre": "Ocupado", **extra}, headers=headers_admin)
    otro = client.post(f"{prefijo}/crear", json={"nombre": "Libre", **extra}, headers=headers_admin).json()

    respuesta = client.put(f"{prefijo}/{otro['id']}", json={"nombre": "Ocupado"}, headers=headers_admin)
    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == mensaje


@pytest.mark.parametrize("prefijo, extra, _mensaje", CATALOGOS)
def test_escritura_requiere_admin(client, headers_lectura, prefijo, extra, _mensaje):
    respuesta = client.post(f"{prefijo}/crear", json={"nombre": "X", **extra}, headers=headers_lectura)
    assert respuesta.status_code == 403


def test_borrar_categoria_de_gasto_en_uso_explica_el_motivo(client, db_session, headers_admin, cotizacion):
    proyecto = models.Proyecto(
        nombre="Proyecto Test",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    categoria = client.post("/categorias-gasto/crear", json={"nombre": "Flete"}, headers=headers_admin).json()
    gasto = client.post(
        "/gastos/crear",
        json={
            "proyecto_id": str(proyecto.id),
            "monto_ars": 15000,
            **cotizacion,
            "descripcion": "Flete de materiales",
            "fecha": "2026-01-15",
            "tipo_factura": "factura_b",
            "categoria_gasto_ids": [categoria["id"]],
        },
        headers=headers_admin,
    )
    assert gasto.status_code == 201, gasto.text

    respuesta = client.delete(f"/categorias-gasto/{categoria['id']}", headers=headers_admin)
    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == (
        "No se puede eliminar la categoría de gasto porque tiene gastos asociados"
    )
    assert client.get(f"/categorias-gasto/{categoria['id']}", headers=headers_admin).status_code == 200
