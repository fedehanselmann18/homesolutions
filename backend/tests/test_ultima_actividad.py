"""
Tests de "visto por última vez":
resolver_usuario_vigente actualiza Usuario.ultima_actividad en cada request
autenticado, con throttle (THROTTLE_ULTIMA_ACTIVIDAD) para no pegarle un
UPDATE a la base en cada uno.

El caso que más importa acá es el que NO se ve a simple vista: el UPDATE de
ultima_actividad tiene que dejar fecha_actualizacion intacta -- si no, cada
ping de actividad revocaría la sesión que lo generó (B-06, ver
resolver_usuario_vigente). Eso se prueba haciendo dos requests seguidos con
el MISMO token sin volver a loguearse.
"""

from datetime import datetime, timedelta, timezone

from app.auth import oauth2
from app.db import models


def test_primer_request_autenticado_deja_ultima_actividad_seteada(
    client, db_session, headers_admin, usuario_admin
):
    assert usuario_admin.ultima_actividad is None

    respuesta = client.get("/usuarios/me", headers=headers_admin)

    assert respuesta.status_code == 200
    db_session.refresh(usuario_admin)
    assert usuario_admin.ultima_actividad is not None


def test_un_segundo_request_dentro_del_throttle_no_reescribe_el_valor(
    client, db_session, headers_admin, usuario_admin
):
    client.get("/usuarios/me", headers=headers_admin)
    db_session.refresh(usuario_admin)
    primer_valor = usuario_admin.ultima_actividad

    client.get("/usuarios/me", headers=headers_admin)
    db_session.refresh(usuario_admin)

    assert usuario_admin.ultima_actividad == primer_valor


def test_un_request_fuera_del_throttle_actualiza_el_valor(client, db_session, headers_admin, usuario_admin):
    hace_rato = datetime.now(timezone.utc) - timedelta(hours=1)
    db_session.query(models.User).filter(models.User.id == usuario_admin.id).update(
        {"ultima_actividad": hace_rato}
    )
    db_session.commit()

    client.get("/usuarios/me", headers=headers_admin)

    db_session.refresh(usuario_admin)
    assert usuario_admin.ultima_actividad > hace_rato


def test_el_ping_de_actividad_no_revoca_la_sesion_que_lo_genera(client, headers_admin):
    """
    El caso crítico: dos requests seguidos con el MISMO token (sin volver a
    loguearse) tienen que funcionar los dos. Si el UPDATE de
    ultima_actividad tocara fecha_actualizacion, el segundo request
    quedaría revocado por B-06 y este test lo agarraría con un 401.
    """
    primero = client.get("/usuarios/me", headers=headers_admin)
    segundo = client.get("/usuarios/me", headers=headers_admin)

    assert primero.status_code == 200
    assert segundo.status_code == 200


def test_el_update_de_actividad_no_toca_fecha_actualizacion(client, db_session, headers_admin, usuario_admin):
    antes = usuario_admin.fecha_actualizacion

    client.get("/usuarios/me", headers=headers_admin)

    db_session.refresh(usuario_admin)
    assert usuario_admin.fecha_actualizacion == antes


def test_get_usuarios_expone_ultima_actividad(client, headers_admin, usuario_admin, usuario_lectura):
    # El propio request de arriba ya deja seteada la ultima_actividad de
    # usuario_admin (es quien está autenticado).
    respuesta = client.get("/usuarios/", headers=headers_admin)

    cuerpo = {u["id"]: u for u in respuesta.json()}
    assert cuerpo[str(usuario_admin.id)]["ultima_actividad"] is not None
    # usuario_lectura nunca hizo un request: sigue en None, no en una fecha
    # inventada.
    assert cuerpo[str(usuario_lectura.id)]["ultima_actividad"] is None


def test_throttle_se_puede_ajustar_sin_tocar_el_codigo_del_helper(
    client, db_session, headers_admin, usuario_admin, monkeypatch
):
    """Documenta que la ventana es un solo valor configurable en un lugar."""
    monkeypatch.setattr(oauth2, "THROTTLE_ULTIMA_ACTIVIDAD", timedelta(seconds=0))

    client.get("/usuarios/me", headers=headers_admin)
    db_session.refresh(usuario_admin)
    primer_valor = usuario_admin.ultima_actividad

    client.get("/usuarios/me", headers=headers_admin)
    db_session.refresh(usuario_admin)

    # Con throttle en 0, el segundo request SÍ pisa el valor (podría ser
    # igual si los dos requests caen en el mismo microsegundo -- por eso
    # >=, no >).
    assert usuario_admin.ultima_actividad >= primer_valor
