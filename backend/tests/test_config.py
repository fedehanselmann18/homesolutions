"""
Tests de app/core/config.py. Desde que la whitelist de autoregistro pasó a la
tabla usuarios_autorizados (ver models.AuthorizedUser), SECRET_KEY es la
única pieza de config con validación propia, así que es lo que queda para
cubrir directo, sin pegarle a un endpoint.

Los tests de la whitelist en sí viven ahora en test_equipo_autorizado.py
(pegan contra los endpoints, porque la fuente de verdad es la base).
"""

import pytest
from pydantic import ValidationError

from app.core.config import Settings

_BASE_KWARGS = dict(
    database_host="localhost",
    database_port=5432,
    database_user="postgres",
    database_password="x",
    database_name="db",
    ALGORITHM="HS256",
)


def test_secret_key_valida_pasa():
    settings = Settings(_env_file=None, SECRET_KEY="x" * 32, **_BASE_KWARGS)
    assert settings.SECRET_KEY == "x" * 32


def test_secret_key_corta_falla_al_arrancar():
    # Mejor un crash claro en el deploy que firmar JWTs con una clave débil.
    with pytest.raises(ValidationError, match="al menos 32 caracteres"):
        Settings(_env_file=None, SECRET_KEY="corta", **_BASE_KWARGS)


def test_config_ya_no_expone_la_whitelist_de_autoregistro():
    """
    Guard contra volver atrás: si alguien reintroduce ROLES_PERMITIDOS_JSON
    en config, la whitelist quedaría en dos lugares (env var y tabla) y
    create_user leería solo uno de los dos.
    """
    settings = Settings(_env_file=None, SECRET_KEY="x" * 32, **_BASE_KWARGS)
    assert not hasattr(settings, "roles_permitidos")
    assert not hasattr(settings, "ROLES_PERMITIDOS_JSON")
