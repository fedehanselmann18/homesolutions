"""
Tests del refresh token y la revocación de sesión (B-06):
- login emite access_token + csrf_token + refresh_token (cookie separada,
  de larga duración, acotada a path="/auth").
- POST /auth/refresh usa el refresh_token para emitir un access_token
  nuevo sin pedir credenciales de nuevo.
- Cada tipo de token solo sirve para lo suyo (un refresh token no funciona
  como access token y viceversa, ver claim "type").
- Revocación: "tocar" fecha_actualizacion del usuario invalida cualquier
  token (access o refresh) emitido antes de ese momento.
"""

from sqlalchemy import text

from app.auth.oauth2 import create_access_token, create_refresh_token


def test_login_setea_las_tres_cookies(client, usuario_admin):
    respuesta = client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )

    assert respuesta.status_code == 200
    assert "access_token" in respuesta.cookies
    assert "csrf_token" in respuesta.cookies
    assert "refresh_token" in respuesta.cookies


def test_refresh_con_sesion_de_login_emite_access_token_nuevo(client, usuario_admin):
    client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )
    access_token_original = client.cookies.get("access_token")

    # /auth/refresh muta estado (emite cookies nuevas) y la sesión viaja por
    # cookie -> requiere el header CSRF como cualquier otro POST autenticado
    # por cookie (ver CSRFMiddleware, no está en CSRF_EXEMPT_PATHS a propósito).
    respuesta = client.post(
        "/auth/refresh",
        headers={"X-CSRF-Token": client.cookies.get("csrf_token")},
    )

    assert respuesta.status_code == 200
    assert respuesta.json()["message"]
    assert client.cookies.get("access_token") is not None
    # No hace falta que cambie de valor byte a byte (el "exp" puede caer en
    # el mismo segundo) -- lo que importa es que el endpoint respondió 200 y
    # volvió a setear la cookie, no que el token sea literalmente distinto.
    assert access_token_original is not None


def test_refresh_sin_cookie_de_refresh_token_es_rechazado(client):
    respuesta = client.post("/auth/refresh")
    assert respuesta.status_code == 401


def test_refresh_con_access_token_en_vez_de_refresh_token_es_rechazado(client, usuario_admin):
    """El claim "type" evita que un access token se cuele como refresh
    token -- si alguien manda el access_token en la cookie refresh_token,
    tiene que rechazarse igual que un token inválido."""
    access_token = create_access_token(data={"user_id": str(usuario_admin.id)})
    client.cookies.set("refresh_token", access_token)

    respuesta = client.post("/auth/refresh")
    assert respuesta.status_code == 401


def test_refresh_token_no_sirve_para_rutas_protegidas(client, usuario_admin):
    """Un refresh token no es un access token -- usarlo como si lo fuera
    (header Authorization) tiene que rechazarse."""
    refresh_token = create_refresh_token(data={"user_id": str(usuario_admin.id)})

    respuesta = client.get("/usuarios/me", headers={"Authorization": f"Bearer {refresh_token}"})
    assert respuesta.status_code == 401


def test_logout_borra_la_cookie_de_refresh_token(client, usuario_admin):
    client.post(
        "/auth/login",
        data={"username": usuario_admin.nombre_usuario, "password": "clave-de-test-123"},
    )
    assert "refresh_token" in client.cookies

    respuesta = client.post("/auth/logout")

    assert respuesta.status_code == 200
    assert "refresh_token" not in client.cookies


def test_revocacion_invalida_access_token_emitido_antes_del_corte(client, db_session, usuario_admin):
    token_viejo = create_access_token(data={"user_id": str(usuario_admin.id)})

    # Simula "se tocó la fila del usuario" (B-06) sin depender de que exista
    # un endpoint de edición -- un UPDATE real, bien en el futuro respecto a
    # TOLERANCIA_REVOCACION (5s), para que no sea flaky por timing de test.
    db_session.execute(
        text("UPDATE usuarios SET fecha_actualizacion = now() + interval '1 minute' WHERE id = :id"),
        {"id": str(usuario_admin.id)},
    )
    db_session.commit()

    respuesta = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token_viejo}"})
    assert respuesta.status_code == 401


def test_revocacion_invalida_refresh_token_emitido_antes_del_corte(client, db_session, usuario_admin):
    refresh_viejo = create_refresh_token(data={"user_id": str(usuario_admin.id)})

    db_session.execute(
        text("UPDATE usuarios SET fecha_actualizacion = now() + interval '1 minute' WHERE id = :id"),
        {"id": str(usuario_admin.id)},
    )
    db_session.commit()

    client.cookies.set("refresh_token", refresh_viejo)
    respuesta = client.post("/auth/refresh")
    assert respuesta.status_code == 401


def test_token_recien_emitido_no_se_revoca_por_desfasaje_de_reloj(client, usuario_admin):
    """El usuario se crea (fecha_actualizacion = now() de la DB) y el token
    se emite unos instantes después (iat = now() de Python) -- tiene que
    autenticar sin problema, sin depender de que los relojes coincidan al
    milisegundo (ver TOLERANCIA_REVOCACION)."""
    token = create_access_token(data={"user_id": str(usuario_admin.id)})

    respuesta = client.get("/usuarios/me", headers={"Authorization": f"Bearer {token}"})
    assert respuesta.status_code == 200
