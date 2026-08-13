"""Tests de app/config.py: ROLES_PERMITIDOS_JSON (B-11) es la única pieza
de config con parsing/validación propia además de SECRET_KEY, así que vale
la pena cubrirla directo (sin pegarle a un endpoint)."""

import pytest
from pydantic import ValidationError

from app.config import Settings

_BASE_KWARGS = dict(
    database_host="localhost",
    database_port=5432,
    database_user="postgres",
    database_password="x",
    database_name="db",
    SECRET_KEY="x" * 32,
    ALGORITHM="HS256",
)


def test_roles_permitidos_default_trae_el_equipo_actual():
    settings = Settings(_env_file=None, **_BASE_KWARGS)
    assert settings.roles_permitidos == {"Agustin": "admin", "Aldana": "admin", "Alejandro": "lectura"}


def test_roles_permitidos_se_puede_override_por_env():
    settings = Settings(_env_file=None, ROLES_PERMITIDOS_JSON='{"Nuevo": "lectura"}', **_BASE_KWARGS)
    assert settings.roles_permitidos == {"Nuevo": "lectura"}


def test_roles_permitidos_json_invalido_falla_al_arrancar():
    with pytest.raises(ValidationError, match="JSON válido"):
        Settings(_env_file=None, ROLES_PERMITIDOS_JSON="esto no es json", **_BASE_KWARGS)


def test_roles_permitidos_json_que_no_es_objeto_falla_al_arrancar():
    with pytest.raises(ValidationError, match="objeto JSON"):
        Settings(_env_file=None, ROLES_PERMITIDOS_JSON="[1, 2, 3]", **_BASE_KWARGS)
