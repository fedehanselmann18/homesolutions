"""
Tests del manejo de errores global (ver UnhandledExceptionMiddleware y el
exception_handler de RequestValidationError en app/main.py): el cliente
nunca debe recibir un traceback ni el nombre de una excepción de Python,
siempre un JSON {"detail": "..."} prolijo.
"""


def test_excepcion_no_controlada_devuelve_json_limpio_sin_traceback(client, db_session, headers_admin, monkeypatch):
    def _explota(*args, **kwargs):
        raise RuntimeError("boom: fallo simulado de base de datos")

    # Simula un fallo inesperado (ej. la DB se cae a mitad de un request):
    # cualquier query dentro de este test explota, incluidas las que hace
    # get_current_user para resolver la sesión.
    monkeypatch.setattr(db_session, "query", _explota)

    respuesta = client.get("/usuarios/", headers=headers_admin)

    assert respuesta.status_code == 500
    assert respuesta.json() == {"detail": "Ocurrió un error inesperado. Intentá de nuevo en unos minutos."}
    assert "RuntimeError" not in respuesta.text
    assert "boom" not in respuesta.text
    assert "Traceback" not in respuesta.text


def test_body_invalido_devuelve_mensaje_legible_en_espanol(client):
    # Falta "password" (requerido por UsuarioCreate) -- antes esto devolvía
    # el array técnico default de FastAPI/Pydantic.
    respuesta = client.post(
        "/usuarios/crear",
        json={"nombre_usuario": "Alejandro", "rol": "lectura"},
    )

    assert respuesta.status_code == 422
    detalle = respuesta.json()["detail"]
    assert isinstance(detalle, str)
    assert "password" in detalle
    assert "Revisá los datos ingresados" in detalle
