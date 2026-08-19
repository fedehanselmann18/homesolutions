"""
Config común de pytest para el backend.

Cómo funciona:
- Usa una base de datos de test APARTE, en el mismo Postgres local pero con
  "_test" agregado al nombre (ver TEST_DB_NAME). Nunca toca la base de
  desarrollo. Si no existe, la crea sola la primera vez que corrés pytest.
- Cada test corre DENTRO de una transacción que se rollbackea al terminar,
  así los tests no se pisan entre sí ni dependen del orden en que corren, y
  no hace falta recrear las tablas en cada test (son las mismas 25 tablas de
  siempre, se crean una sola vez por sesión de pytest).
- El fixture `client` pisa la dependencia get_db de la app para que las
  rutas usen esa misma sesión de test en vez de conectarse a la base real.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.auth.oAuth2 import NOMBRE_USUARIO_MANAGER, create_access_token
from app.auth.verification import hash_password
from app.config import settings
from app.db import models
from app.db.db import Base, get_db
from app.main import app

TEST_DB_NAME = f"{settings.database_name}_test"

_ADMIN_DB_URL = (
    f"postgresql://{settings.database_user}:{settings.database_password}"
    f"@{settings.database_host}:{settings.database_port}/postgres"
)
_TEST_DB_URL = (
    f"postgresql://{settings.database_user}:{settings.database_password}"
    f"@{settings.database_host}:{settings.database_port}/{TEST_DB_NAME}"
)


def _crear_db_test_si_no_existe():
    """CREATE DATABASE no puede correr dentro de una transacción -> conexión
    en autocommit aparte, solo para este chequeo puntual."""
    admin_engine = create_engine(_ADMIN_DB_URL, isolation_level="AUTOCOMMIT")
    with admin_engine.connect() as conn:
        existe = conn.exec_driver_sql(
            "SELECT 1 FROM pg_database WHERE datname = %(nombre)s",
            {"nombre": TEST_DB_NAME},
        ).first()
        if not existe:
            conn.exec_driver_sql(f'CREATE DATABASE "{TEST_DB_NAME}"')
    admin_engine.dispose()


@pytest.fixture(scope="session")
def db_engine():
    _crear_db_test_si_no_existe()
    engine = create_engine(_TEST_DB_URL)
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture()
def db_session(db_engine):
    connection = db_engine.connect()
    transaction = connection.begin()
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=connection)
    session = TestingSessionLocal()

    # SAVEPOINT (no la transacción externa de arriba). Algunas rutas hacen
    # su propio db.rollback() cuando capturan un IntegrityError (ver
    # productos.py, delete_producto) -- eso cierra este savepoint solo, y
    # este listener abre uno nuevo enseguida para que la sesión de test
    # siga viva. Sin esto, el rollback final de abajo se queda sin
    # transacción a la que hacerle rollback y SQLAlchemy tira el warning
    # "transaction already deassociated from connection".
    nested = connection.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _reabrir_savepoint(sess, trans):
        nonlocal nested
        if not nested.is_active:
            nested = connection.begin_nested()

    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()


@pytest.fixture()
def client(db_session):
    def _get_db_override():
        yield db_session

    app.dependency_overrides[get_db] = _get_db_override
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def _crear_usuario(db_session, rol):
    usuario = models.Usuario(
        nombre_usuario=f"{rol}_test_{uuid.uuid4().hex[:8]}",
        hashed_password=hash_password("clave-de-test-123"),
        rol=rol,
    )
    db_session.add(usuario)
    db_session.commit()
    db_session.refresh(usuario)
    return usuario


@pytest.fixture()
def equipo_autorizado(db_session):
    """
    Siembra la whitelist de autoregistro (usuarios_autorizados) con lo mismo
    que dejan las migraciones en cualquier base real: el equipo
    (d5a3c1e88f42) y "Manager" (e7b2f4c19a83). Las tablas de test se crean
    con Base.metadata.create_all, que arma el esquema pero no corre las
    migraciones, así que esta tabla arranca vacía -- sin esto, cualquier
    test de POST /usuarios/crear daría 403.
    """
    autorizados = [
        models.UsuarioAutorizado(nombre_usuario="Agustin", rol="admin"),
        models.UsuarioAutorizado(nombre_usuario="Aldana", rol="admin"),
        models.UsuarioAutorizado(nombre_usuario="Alejandro", rol="lectura"),
        models.UsuarioAutorizado(nombre_usuario=NOMBRE_USUARIO_MANAGER, rol="lectura"),
    ]
    db_session.add_all(autorizados)
    db_session.commit()
    return autorizados


@pytest.fixture()
def usuario_admin(db_session):
    return _crear_usuario(db_session, "admin")


@pytest.fixture()
def usuario_lectura(db_session):
    return _crear_usuario(db_session, "lectura")


def _headers_para(usuario):
    token = create_access_token(data={"user_id": str(usuario.id)})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def headers_admin(usuario_admin):
    return _headers_para(usuario_admin)


@pytest.fixture()
def headers_lectura(usuario_lectura):
    return _headers_para(usuario_lectura)


@pytest.fixture(autouse=True)
def _resetear_rate_limiter():
    """
    El Limiter de slowapi guarda sus contadores en memoria, compartidos por
    todo el proceso de pytest (no por test individual). Sin este reset, un
    test que agote el límite de /auth/login (ver test_seguridad.py) dejaría
    contadores "sucios" para el siguiente test que también pegue contra
    login, haciendo que la suite sea flaky según el orden en que corran.
    """
    from app.limiter import limiter

    limiter.reset()
    yield
    limiter.reset()
