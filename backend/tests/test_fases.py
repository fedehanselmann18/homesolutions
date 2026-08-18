"""
Tests del número de orden (`orden`) de Fase dentro de su Proyecto, y de
`fecha_en_curso_desde` (desde cuándo está en curso).

Reglas cubiertas sobre `orden`:
- Se asigna solo al crear (siguiente número libre para ESE proyecto, no
  global), nunca lo manda el cliente.
- GET /fases/proyectos/{id}/fases devuelve las fases ordenadas por `orden`.
- PATCH /fases/{id}/mover intercambia el número con la vecina (arriba/abajo)
  y no permite salirse de los bordes.
- DELETE reacomoda las fases que quedan para no dejar huecos (1..N).

Reglas cubiertas sobre `fecha_en_curso_desde`:
- Se pone al crear una fase directamente como en_curso, y al pasar a
  en_curso desde otro estado -- pero NO se pisa con una edición que deja el
  estado igual (ese era el bug: fecha_actualizacion se pisaba con cualquier
  cambio, por eso "en curso hace 0 días" aparecía de la nada).
- Se limpia (None) al salir de en_curso.
"""

from datetime import date

from app.db import models


def _crear_proyecto(db_session, nombre="Proyecto Fases"):
    proyecto = models.Proyecto(
        nombre=nombre,
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado=1000000,
    )
    db_session.add(proyecto)
    db_session.commit()
    db_session.refresh(proyecto)
    return proyecto


def _crear_fase_via_api(client, headers_admin, proyecto_id, nombre):
    respuesta = client.post(
        "/fases/crear",
        json={"proyecto_id": str(proyecto_id), "nombre": nombre, "estado": "por_empezar"},
        headers=headers_admin,
    )
    assert respuesta.status_code == 201
    return respuesta.json()


def test_crear_fases_asigna_orden_secuencial_por_proyecto(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)

    fase1 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    fase2 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Análisis de terreno")
    fase3 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Diseño")

    assert fase1["orden"] == 1
    assert fase2["orden"] == 2
    assert fase3["orden"] == 3


def test_orden_es_independiente_por_proyecto(client, db_session, headers_admin):
    proyecto_a = _crear_proyecto(db_session, "Proyecto A")
    proyecto_b = _crear_proyecto(db_session, "Proyecto B")

    fase_a1 = _crear_fase_via_api(client, headers_admin, proyecto_a.id, "Reunión cliente")
    fase_b1 = _crear_fase_via_api(client, headers_admin, proyecto_b.id, "Reunión cliente")

    # Cada proyecto arranca su propia numeración en 1, no comparten contador.
    assert fase_a1["orden"] == 1
    assert fase_b1["orden"] == 1


def test_get_fases_por_proyecto_devuelve_ordenadas_por_orden(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    _crear_fase_via_api(client, headers_admin, proyecto.id, "Análisis de terreno")
    _crear_fase_via_api(client, headers_admin, proyecto.id, "Diseño")

    respuesta = client.get(f"/fases/proyectos/{proyecto.id}/fases", headers=headers_admin)
    assert respuesta.status_code == 200
    nombres = [f["nombre"] for f in respuesta.json()]
    assert nombres == ["Reunión cliente", "Análisis de terreno", "Diseño"]


def test_mover_fase_hacia_arriba_intercambia_con_la_anterior(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    fase1 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    fase2 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Análisis de terreno")

    respuesta = client.patch(
        f"/fases/{fase2['id']}/mover", json={"direccion": "arriba"}, headers=headers_admin
    )
    assert respuesta.status_code == 200
    fases = {f["id"]: f["orden"] for f in respuesta.json()}
    assert fases[fase2["id"]] == 1
    assert fases[fase1["id"]] == 2


def test_mover_primera_fase_hacia_arriba_es_rechazado(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    fase1 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    _crear_fase_via_api(client, headers_admin, proyecto.id, "Análisis de terreno")

    respuesta = client.patch(
        f"/fases/{fase1['id']}/mover", json={"direccion": "arriba"}, headers=headers_admin
    )
    assert respuesta.status_code == 400


def test_mover_ultima_fase_hacia_abajo_es_rechazado(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    fase2 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Análisis de terreno")

    respuesta = client.patch(
        f"/fases/{fase2['id']}/mover", json={"direccion": "abajo"}, headers=headers_admin
    )
    assert respuesta.status_code == 400


def test_eliminar_fase_del_medio_reacomoda_las_restantes(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    fase1 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    fase2 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Análisis de terreno")
    fase3 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Diseño")

    respuesta = client.delete(f"/fases/{fase2['id']}", headers=headers_admin)
    assert respuesta.status_code == 200

    restantes = client.get(f"/fases/proyectos/{proyecto.id}/fases", headers=headers_admin).json()
    ordenes = {f["id"]: f["orden"] for f in restantes}
    assert ordenes[fase1["id"]] == 1
    assert ordenes[fase3["id"]] == 2  # bajó de 3 a 2, no queda hueco


def test_mover_fase_sin_ser_admin_es_rechazado(client, db_session, headers_admin, headers_lectura):
    proyecto = _crear_proyecto(db_session)
    _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    fase2 = _crear_fase_via_api(client, headers_admin, proyecto.id, "Análisis de terreno")

    respuesta = client.patch(
        f"/fases/{fase2['id']}/mover", json={"direccion": "arriba"}, headers=headers_lectura
    )
    assert respuesta.status_code == 403


# --- fecha_en_curso_desde --------------------------------------------------


def test_crear_fase_en_curso_asigna_fecha_en_curso_desde(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)

    respuesta = client.post(
        "/fases/crear",
        json={"proyecto_id": str(proyecto.id), "nombre": "Reunión cliente", "estado": "en_curso"},
        headers=headers_admin,
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["fecha_en_curso_desde"] is not None


def test_crear_fase_por_empezar_no_asigna_fecha_en_curso_desde(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    fase = _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    assert fase["fecha_en_curso_desde"] is None


def test_pasar_a_en_curso_asigna_fecha_en_curso_desde(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    fase = _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    assert fase["fecha_en_curso_desde"] is None

    respuesta = client.put(
        f"/fases/{fase['id']}", json={"estado": "en_curso"}, headers=headers_admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["fecha_en_curso_desde"] is not None


def test_editar_otro_campo_no_pisa_fecha_en_curso_desde(client, db_session, headers_admin):
    """El bug reportado: editar la descripción (o cualquier otro campo) de
    una fase que ya está en curso NO tiene que resetear hace cuántos días
    está en curso."""
    proyecto = _crear_proyecto(db_session)
    fase = _crear_fase_via_api(client, headers_admin, proyecto.id, "Montaje")

    respuesta = client.put(
        f"/fases/{fase['id']}", json={"estado": "en_curso"}, headers=headers_admin
    )
    fecha_original = respuesta.json()["fecha_en_curso_desde"]
    assert fecha_original is not None

    # Como en el fixture de tests todo corre "al mismo instante", se fuerza
    # a mano la fecha bien atrás para poder distinguir "se mantuvo" de "se
    # pisó con la hora actual" sin depender de que pase tiempo real.
    fase_db = db_session.query(models.Fase).filter_by(id=fase["id"]).first()
    from datetime import datetime, timedelta, timezone

    fecha_vieja = datetime.now(timezone.utc) - timedelta(days=10)
    fase_db.fecha_en_curso_desde = fecha_vieja
    db_session.commit()

    respuesta = client.put(
        f"/fases/{fase['id']}", json={"descripcion": "Instalación de equipos"}, headers=headers_admin
    )
    assert respuesta.status_code == 200
    cuerpo = respuesta.json()
    assert cuerpo["descripcion"] == "Instalación de equipos"
    # La fecha de "entró en curso" no se movió por editar la descripción.
    assert cuerpo["fecha_en_curso_desde"] is not None
    assert abs(
        (datetime.fromisoformat(cuerpo["fecha_en_curso_desde"]) - fecha_vieja).total_seconds()
    ) < 1


def test_salir_de_en_curso_limpia_fecha_en_curso_desde(client, db_session, headers_admin):
    proyecto = _crear_proyecto(db_session)
    fase = _crear_fase_via_api(client, headers_admin, proyecto.id, "Reunión cliente")
    client.put(f"/fases/{fase['id']}", json={"estado": "en_curso"}, headers=headers_admin)

    respuesta = client.put(
        f"/fases/{fase['id']}", json={"estado": "terminada"}, headers=headers_admin
    )
    assert respuesta.status_code == 200
    assert respuesta.json()["fecha_en_curso_desde"] is None
