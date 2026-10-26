"""Tests de /fases-predeterminadas: las opciones del select del modal de
fase. Lo importante: salen en orden, una nueva va al final, el nombre no se
repite, y borrar o renombrar una no toca las fases ya creadas (la fase
guarda el nombre como texto)."""

from datetime import date

from app.db import models

PREFIJO = "/fases-predeterminadas"


def _crear(client, headers, nombre):
    respuesta = client.post(f"{PREFIJO}/crear", json={"nombre": nombre}, headers=headers)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def test_lista_en_orden_y_la_nueva_va_al_final(client, headers_admin, headers_lectura):
    _crear(client, headers_admin, "Relevamiento y anteproyecto")
    _crear(client, headers_admin, "Ingeniería de detalle")
    nueva = _crear(client, headers_admin, "Calefacción")
    assert nueva["orden"] == 3

    # El rol lectura también la necesita: el select del modal la usa.
    respuesta = client.get(f"{PREFIJO}/", headers=headers_lectura)
    assert respuesta.status_code == 200
    assert [f["nombre"] for f in respuesta.json()] == [
        "Relevamiento y anteproyecto",
        "Ingeniería de detalle",
        "Calefacción",
    ]


def test_nombre_repetido_explica_el_motivo(client, headers_admin):
    _crear(client, headers_admin, "Puesta en marcha y ensayos")
    respuesta = client.post(
        f"{PREFIJO}/crear", json={"nombre": "  Puesta en marcha   y ensayos "}, headers=headers_admin
    )
    assert respuesta.status_code == 400
    assert respuesta.json()["detail"] == "Ya existe una fase predeterminada con ese nombre"


def test_nombre_vacio_no_se_acepta(client, headers_admin):
    respuesta = client.post(f"{PREFIJO}/crear", json={"nombre": "   "}, headers=headers_admin)
    assert respuesta.status_code == 422


def test_escritura_requiere_admin(client, headers_admin, headers_lectura):
    fase = _crear(client, headers_admin, "Montaje de unidades interiores")
    assert client.post(f"{PREFIJO}/crear", json={"nombre": "X"}, headers=headers_lectura).status_code == 403
    assert (
        client.put(f"{PREFIJO}/{fase['id']}", json={"nombre": "Y"}, headers=headers_lectura).status_code
        == 403
    )
    assert client.delete(f"{PREFIJO}/{fase['id']}", headers=headers_lectura).status_code == 403


def test_renombrar_y_borrar_no_tocan_las_fases_creadas(client, db_session, headers_admin):
    predeterminada = _crear(client, headers_admin, "Calefacción")
    proyecto = models.Project(
        nombre="Proyecto Test",
        direccion="Calle Falsa 123",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    fase = client.post(
        "/fases/crear",
        json={"proyecto_id": str(proyecto.id), "nombre": "Calefacción", "estado": "por_empezar"},
        headers=headers_admin,
    )
    assert fase.status_code == 201, fase.text

    renombrada = client.put(
        f"{PREFIJO}/{predeterminada['id']}", json={"nombre": "Calefacción por losa"}, headers=headers_admin
    )
    assert renombrada.status_code == 200
    assert renombrada.json()["nombre"] == "Calefacción por losa"

    assert client.delete(f"{PREFIJO}/{predeterminada['id']}", headers=headers_admin).status_code == 200
    assert client.get(f"/fases/{fase.json()['id']}", headers=headers_admin).json()["nombre"] == "Calefacción"
    assert client.get(f"{PREFIJO}/", headers=headers_admin).json() == []


def test_editar_o_borrar_una_que_no_existe_da_404(client, headers_admin):
    inexistente = "00000000-0000-0000-0000-000000000000"
    assert (
        client.put(f"{PREFIJO}/{inexistente}", json={"nombre": "X"}, headers=headers_admin).status_code == 404
    )
    assert client.delete(f"{PREFIJO}/{inexistente}", headers=headers_admin).status_code == 404
