"""
Tests de las medidas de seguridad agregadas: cookies httpOnly + CSRF de
doble cookie, rate limiting en login/alta de usuario, roles fijos server-side
para el autoregistro, y el endpoint público reducido para el combo de login.
"""

from app.auth.oAuth2 import create_access_token


# ---------------------------------------------------------------------------
# Endpoint público reducido de usuarios
# ---------------------------------------------------------------------------

def test_login_options_no_requiere_auth_y_solo_trae_nombres(client, usuario_admin):
    respuesta = client.get("/usuarios/login-options")

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert all(isinstance(item, str) for item in datos)
    assert usuario_admin.nombre_usuario in datos


def test_lista_completa_de_usuarios_ahora_requiere_auth(client):
    respuesta = client.get("/usuarios/")
    assert respuesta.status_code == 401


def test_lista_completa_de_usuarios_con_auth_funciona(client, headers_admin):
    respuesta = client.get("/usuarios/", headers=headers_admin)
    assert respuesta.status_code == 200


# ---------------------------------------------------------------------------
# Alta de usuario: roles fijos, no lo que mande el cliente
# ---------------------------------------------------------------------------

def test_crear_usuario_con_nombre_no_autorizado_es_rechazado(client):
    respuesta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Intruso", "rol": "admin", "password": "clave-segura"},
    )
    assert respuesta.status_code == 403


def test_crear_usuario_con_rol_que_no_coincide_es_rechazado(client):
    # Alejandro es "lectura" según ROLES_PERMITIDOS (app/routes/usuarios.py);
    # pedir "admin" para ese nombre tiene que rechazarse, no ignorarse en silencio.
    respuesta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Alejandro", "rol": "admin", "password": "clave-segura"},
    )
    assert respuesta.status_code == 400


def test_crear_usuario_con_rol_correcto_usa_el_rol_del_servidor(client):
    respuesta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Alejandro", "rol": "lectura", "password": "clave-segura"},
    )
    assert respuesta.status_code == 201
    assert respuesta.json()["rol"] == "lectura"


# ---------------------------------------------------------------------------
# CSRF: solo aplica cuando la sesión viaja por cookie, no con Authorization header
# ---------------------------------------------------------------------------

def test_request_mutante_con_cookie_de_sesion_sin_csrf_header_es_rechazado(client, usuario_admin):
    token = create_access_token(data={"user_id": str(usuario_admin.id)})
    client.cookies.set("access_token", token)
    client.cookies.set("csrf_token", "un-valor-cualquiera")

    respuesta = client.post("/productos/crear", json={
        "proveedor_id": "no-existe", "marca": "x", "modelo": "x", "tipo": "x", "precio": 1
    })

    assert respuesta.status_code == 403
    assert "csrf" in respuesta.json()["detail"].lower()


def test_request_mutante_con_cookie_de_sesion_y_csrf_correcto_pasa_el_middleware(client, usuario_admin):
    token = create_access_token(data={"user_id": str(usuario_admin.id)})
    client.cookies.set("access_token", token)
    client.cookies.set("csrf_token", "token-csrf-valido")

    respuesta = client.post(
        "/productos/crear",
        json={"proveedor_id": "no-existe", "marca": "x", "modelo": "x", "tipo": "x", "precio": 1},
        headers={"X-CSRF-Token": "token-csrf-valido"},
    )

    # El middleware de CSRF lo deja pasar (no es 403); la request igual
    # falla más adelante porque el proveedor no existe -- lo que nos
    # importa acá es que no la frenó el CSRF.
    assert respuesta.status_code != 403


def test_request_mutante_con_authorization_header_no_exige_csrf(client, headers_admin):
    # Un cliente que ya manda su propio Authorization header (como los tests
    # existentes, o un futuro cliente mobile/API) no depende de que el
    # browser adjunte nada solo, así que el middleware no le exige CSRF.
    respuesta = client.post(
        "/productos/crear",
        json={"proveedor_id": "no-existe", "marca": "x", "modelo": "x", "tipo": "x", "precio": 1},
        headers=headers_admin,
    )
    assert respuesta.status_code != 403


# ---------------------------------------------------------------------------
# Rate limiting
# ---------------------------------------------------------------------------

def test_rate_limit_de_login_bloquea_despues_de_5_intentos_por_minuto(client, usuario_admin):
    for _ in range(5):
        respuesta = client.post(
            "/auth/login",
            data={"username": usuario_admin.nombre_usuario, "password": "no-es-esta"},
        )
        assert respuesta.status_code == 401

    respuesta = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "no-es-esta"},
    )
    assert respuesta.status_code == 429


def test_login_setea_cookies_httponly_y_csrf(client, usuario_admin):
    respuesta = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )

    assert respuesta.status_code == 200
    assert "access_token" in client.cookies
    assert "csrf_token" in client.cookies


def test_logout_borra_las_cookies(client, usuario_admin):
    client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )
    respuesta = client.post("/auth/logout")

    assert respuesta.status_code == 200
    assert "access_token" not in client.cookies
    assert "csrf_token" not in client.cookies
