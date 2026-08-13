"""
Tests de integración del login y de la protección por token. A diferencia de
test_compra_calculos.py, estos SÍ pegan contra la API real con la base de
test (ver conftest.py) -- sirven de ejemplo para escribir tests de rutas.
"""


def test_login_con_credenciales_correctas_setea_cookie_sin_exponer_el_token_en_el_body(client, usuario_admin):
    respuesta = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )

    assert respuesta.status_code == 200
    # B-05: el JWT viaja SOLO en la cookie httpOnly, nunca en el body.
    assert "access_token" not in respuesta.json()
    assert "access_token" in respuesta.cookies
    assert "csrf_token" in respuesta.cookies


def test_login_con_contrasena_incorrecta_es_rechazado(client, usuario_admin):
    respuesta = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "no-es-esta"},
    )

    assert respuesta.status_code == 401


def test_login_con_usuario_inexistente_es_rechazado(client):
    respuesta = client.post(
        "/auth/login",
        data={"username": "no-existe", "password": "lo-que-sea"},
    )

    assert respuesta.status_code == 401


def test_ruta_protegida_sin_token_es_rechazada(client):
    respuesta = client.get("/usuarios/me")
    assert respuesta.status_code == 401


def test_ruta_protegida_con_token_funciona(client, headers_admin, usuario_admin):
    respuesta = client.get("/usuarios/me", headers=headers_admin)

    assert respuesta.status_code == 200
    assert respuesta.json()["nombre_usuario"] == usuario_admin.nombre_usuario
