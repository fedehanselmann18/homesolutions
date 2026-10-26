"""
Tests de los arreglos del scan de seguridad de octubre 2026:
- bloqueo por cuenta con espera creciente en /auth/login (app/login_attempts.py),
- logins fallidos en la auditoría,
- logout que da de baja el refresh token en el servidor,
- CSRF que solo se saltea con un token Bearer,
- tope de tamaño del request y del .xlsx descomprimido,
- texto del usuario escapado en el PDF del proyecto.
"""

import io
import zipfile
from datetime import date, datetime, timedelta, timezone

import pytest

from app.auth import login_attempts
from app.auth.oauth2 import NOMBRE_USUARIO_MANAGER, create_access_token, create_refresh_token
from app.auth.verification import hash_password
from app.core.security_middleware import TAMANIO_MAXIMO_REQUEST
from app.db import models

CLAVE_CORRECTA = "clave-de-test-123"


@pytest.fixture()
def headers_manager(db_session):
    manager = models.User(
        nombre_usuario=NOMBRE_USUARIO_MANAGER, hashed_password=hash_password(CLAVE_CORRECTA), rol="lectura"
    )
    db_session.add(manager)
    db_session.commit()
    token = create_access_token(data={"user_id": str(manager.id)})
    return {"Authorization": f"Bearer {token}"}


def _login(client, usuario, password, ip):
    # Cada intento desde una IP distinta (último valor de X-Forwarded-For,
    # ver app/core/limiter.py): así el límite por IP de slowapi no se mete, y de
    # paso queda probado que el bloqueo es por cuenta y no por IP.
    return client.post(
        "/auth/login",
        data={"username": usuario.nombre_usuario, "password": password},
        headers={"X-Forwarded-For": ip},
    )


def _fallar(client, usuario, veces, desde=0):
    for i in range(desde, desde + veces):
        respuesta = _login(client, usuario, "no-es-esta", f"198.51.100.{i}")
        assert respuesta.status_code == 401


# ---------------------------------------------------------------------------
# Bloqueo por cuenta
# ---------------------------------------------------------------------------


def test_espera_creciente_con_techo():
    minutos = [login_attempts.espera_para(n) for n in range(1, 12)]
    assert minutos[:4] == [None] * 4
    assert [m.total_seconds() / 60 for m in minutos[4:]] == [1, 2, 4, 8, 16, 30, 30]


def test_despues_de_5_fallos_la_cuenta_queda_bloqueada_aunque_cambie_la_ip(client, usuario_admin):
    _fallar(client, usuario_admin, 5)

    respuesta = _login(client, usuario_admin, CLAVE_CORRECTA, "203.0.113.50")

    # Bloqueada: ni siquiera con la contraseña correcta, porque durante el
    # bloqueo no se chequea la contraseña.
    assert respuesta.status_code == 429
    assert "1 minuto" in respuesta.json()["detail"]
    assert "access_token" not in respuesta.cookies


def test_cuando_vence_el_bloqueo_vuelve_a_dejar_entrar_y_resetea_el_contador(
    client, db_session, usuario_admin
):
    _fallar(client, usuario_admin, 5)
    intento = db_session.get(models.LoginAttempt, usuario_admin.id)
    intento.bloqueado_hasta = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()

    respuesta = _login(client, usuario_admin, CLAVE_CORRECTA, "203.0.113.50")

    assert respuesta.status_code == 200
    db_session.expire_all()
    assert db_session.get(models.LoginAttempt, usuario_admin.id) is None


def test_fallos_durante_el_bloqueo_no_se_cuentan_y_el_siguiente_fallo_duplica_la_espera(
    client, db_session, usuario_admin
):
    _fallar(client, usuario_admin, 5)
    # Durante el bloqueo se rechaza sin contar.
    assert _login(client, usuario_admin, "otra-mala", "203.0.113.60").status_code == 429
    intento = db_session.get(models.LoginAttempt, usuario_admin.id)
    assert intento.fallidos == 5

    intento.bloqueado_hasta = datetime.now(timezone.utc) - timedelta(seconds=1)
    db_session.commit()
    assert _login(client, usuario_admin, "otra-mala", "203.0.113.61").status_code == 401

    respuesta = _login(client, usuario_admin, CLAVE_CORRECTA, "203.0.113.62")
    assert respuesta.status_code == 429
    assert "2 minutos" in respuesta.json()["detail"]


def test_fallos_viejos_no_se_suman(client, db_session, usuario_admin):
    _fallar(client, usuario_admin, 4)
    intento = db_session.get(models.LoginAttempt, usuario_admin.id)
    intento.ultimo_fallo = datetime.now(timezone.utc) - timedelta(days=2)
    db_session.commit()

    _fallar(client, usuario_admin, 1, desde=10)

    db_session.expire_all()
    assert db_session.get(models.LoginAttempt, usuario_admin.id).fallidos == 1
    assert _login(client, usuario_admin, CLAVE_CORRECTA, "203.0.113.70").status_code == 200


def test_login_correcto_antes_del_bloqueo_resetea_el_contador(client, db_session, usuario_admin):
    _fallar(client, usuario_admin, 4)
    assert _login(client, usuario_admin, CLAVE_CORRECTA, "203.0.113.80").status_code == 200

    _fallar(client, usuario_admin, 4, desde=20)
    assert _login(client, usuario_admin, CLAVE_CORRECTA, "203.0.113.81").status_code == 200


def test_resetear_password_destraba_la_cuenta(client, db_session, usuario_admin, headers_manager):
    _fallar(client, usuario_admin, 5)

    respuesta = client.post(
        f"/usuarios/{usuario_admin.id}/resetear-password",
        json={"password": "clave-nueva-456"},
        headers=headers_manager,
    )
    assert respuesta.status_code == 200

    assert _login(client, usuario_admin, "clave-nueva-456", "203.0.113.90").status_code == 200


def test_usuario_inexistente_no_crea_filas(client, db_session):
    respuesta = client.post("/auth/login", data={"username": "no-existe", "password": "lo-que-sea"})

    assert respuesta.status_code == 401
    assert db_session.query(models.LoginAttempt).count() == 0


def test_login_fallido_queda_en_la_auditoria(client, db_session, usuario_admin):
    _login(client, usuario_admin, "no-es-esta", "198.51.100.7")

    fila = db_session.query(models.AuditLog).filter(models.AuditLog.accion == "login fallido").one()
    assert fila.usuario_id == usuario_admin.id
    assert fila.tipo_recurso == "Sesion"
    assert fila.detalle == {"ip": "198.51.100.7", "fallidos": 1, "bloqueo_minutos": None}


# ---------------------------------------------------------------------------
# Logout revoca el refresh token
# ---------------------------------------------------------------------------


def test_despues_del_logout_el_refresh_token_viejo_no_sirve(client, usuario_admin):
    client.post("/auth/login", data={"username": usuario_admin.nombre_usuario, "password": CLAVE_CORRECTA})
    refresh_token = client.cookies.get("refresh_token", path="/auth")

    assert client.post("/auth/logout").status_code == 200

    # Alguien que se haya copiado la cookie antes del logout:
    client.cookies.set("refresh_token", refresh_token, path="/auth")
    assert client.post("/auth/refresh").status_code == 401


def test_logout_solo_revoca_su_propio_refresh_token(client, usuario_admin):
    # Otra sesión de la misma persona (ej. la compu) sigue viva.
    otra_sesion = create_refresh_token(data={"user_id": str(usuario_admin.id)})

    client.post("/auth/login", data={"username": usuario_admin.nombre_usuario, "password": CLAVE_CORRECTA})
    client.post("/auth/logout")

    client.cookies.set("refresh_token", otra_sesion, path="/auth")
    assert client.post("/auth/refresh").status_code == 200


def test_logout_con_cookie_rota_igual_borra_las_cookies(client):
    client.cookies.set("refresh_token", "esto-no-es-un-jwt", path="/auth")
    assert client.post("/auth/logout").status_code == 200


def test_refresh_token_sin_jti_se_rechaza(client, usuario_admin):
    # Refresh tokens emitidos antes de que existiera el claim: no hay forma de
    # revocarlos, así que dejan de servir.
    from app.auth.oauth2 import _crear_token

    viejo = _crear_token({"user_id": str(usuario_admin.id)}, timedelta(days=7), "refresh")
    client.cookies.set("refresh_token", viejo, path="/auth")

    assert client.post("/auth/refresh").status_code == 401


# ---------------------------------------------------------------------------
# CSRF
# ---------------------------------------------------------------------------


def test_authorization_que_no_es_bearer_no_saltea_el_csrf(client, usuario_admin):
    token = create_access_token(data={"user_id": str(usuario_admin.id)})
    client.cookies.set("access_token", token)
    client.cookies.set("csrf_token", "un-valor-cualquiera")

    respuesta = client.post(
        "/productos/crear",
        json={"proveedor_id": "no-existe", "marca": "x", "modelo": "x", "tipo": "x", "precio": 1},
        headers={"Authorization": "Basic dXN1YXJpbzpjbGF2ZQ=="},
    )

    assert respuesta.status_code == 403
    assert "csrf" in respuesta.json()["detail"].lower()


# ---------------------------------------------------------------------------
# Tamaños
# ---------------------------------------------------------------------------


def test_request_con_content_length_gigante_se_corta_antes_de_leerlo(client, headers_admin):
    respuesta = client.post(
        "/ia/leer-catalogo",
        content=b"x",
        headers={
            **headers_admin,
            "Content-Type": "multipart/form-data; boundary=x",
            "Content-Length": str(TAMANIO_MAXIMO_REQUEST + 1),
        },
    )
    assert respuesta.status_code == 413


def _xlsx(entradas: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_xlsx:
        for nombre, contenido in entradas.items():
            zip_xlsx.writestr(nombre, contenido)
    return buffer.getvalue()


def _leer_catalogo(client, headers, contenido: bytes):
    return client.post(
        "/ia/leer-catalogo",
        data={"contexto": "{}"},
        files={"archivo": ("catalogo.xlsx", io.BytesIO(contenido), "application/vnd.ms-excel")},
        headers=headers,
    )


def test_xlsx_que_descomprimido_es_enorme_se_rechaza(client, headers_admin, monkeypatch):
    import app.api.ai as ruta_ia

    monkeypatch.setattr(ruta_ia, "TAMANIO_MAXIMO_XLSX_DESCOMPRIMIDO", 1024)
    # 2KB de ceros: se comprime a casi nada, pero descomprimido pasa el tope.
    respuesta = _leer_catalogo(client, headers_admin, _xlsx({"xl/sheet1.xml": b"0" * 2048}))

    assert respuesta.status_code == 400
    assert "demasiado grande" in respuesta.json()["detail"]


def test_xlsx_con_demasiadas_entradas_se_rechaza(client, headers_admin, monkeypatch):
    import app.api.ai as ruta_ia

    monkeypatch.setattr(ruta_ia, "ENTRADAS_MAXIMAS_XLSX", 3)
    respuesta = _leer_catalogo(client, headers_admin, _xlsx({f"x{i}.xml": b"a" for i in range(4)}))

    assert respuesta.status_code == 400


def test_xlsx_que_no_es_un_zip_valido_se_rechaza(client, headers_admin):
    respuesta = _leer_catalogo(client, headers_admin, b"PK\x03\x04 no es un zip de verdad")

    assert respuesta.status_code == 400
    assert "Excel válido" in respuesta.json()["detail"]


# ---------------------------------------------------------------------------
# PDF
# ---------------------------------------------------------------------------


def test_pdf_con_marcado_en_el_nombre_y_la_direccion_se_genera(client, db_session, headers_admin):
    # Sin escapar, "<3" rompía el parser de reportlab (500) y el <img> hacía
    # que el backend intentara bajar esa URL.
    proyecto = models.Project(
        nombre='Lote <3 & Cía <img src="http://127.0.0.1:9/x.png" width="10" height="10"/>',
        direccion="Av. <b>Siempre</b> Viva 742 & <font color='red'>",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=100000,
    )
    db_session.add(proyecto)
    db_session.commit()

    respuesta = client.get(f"/proyectos/{proyecto.id}/reporte-pdf", headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.content.startswith(b"%PDF")


def test_pdf_con_caracteres_fuera_de_latin1_y_comillas_en_el_nombre(client, db_session, headers_admin):
    # Antes: "—" o "€" no entran en latin-1 (el encoding de los headers) y el
    # Content-Disposition tiraba un 500; unas comillas cortaban el header.
    proyecto = models.Project(
        nombre='Casa "Pérez" — Nordelta €',
        direccion="Calle 1",
        fecha_inicio=date(2026, 1, 1),
        estado="en_curso",
        precio_acordado_usd=100000,
    )
    db_session.add(proyecto)
    db_session.commit()

    respuesta = client.get(f"/proyectos/{proyecto.id}/reporte-pdf", headers=headers_admin)

    assert respuesta.status_code == 200
    disposicion = respuesta.headers["content-disposition"]
    assert 'filename="reporte-Casa-Perez--Nordelta-.pdf"' in disposicion
    assert "filename*=UTF-8''reporte-Casa-%22P%C3%A9rez%22-%E2%80%94-Nordelta-%E2%82%AC.pdf" in disposicion
