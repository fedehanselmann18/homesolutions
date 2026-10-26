"""
Config común de pytest para el backend.

Cómo funciona:
- Usa una base de datos de test APARTE, en el mismo Postgres local pero con
  "_test" agregado al nombre (ver TEST_DB_NAME). Nunca toca la base de
  desarrollo. Si no existe, la crea sola la primera vez que corrés pytest.
- Cada test corre DENTRO de una transacción que se rollbackea al terminar,
  así los tests no se pisan entre sí ni dependen del orden en que corren, y
  no hace falta recrear las tablas en cada test (son las mismas tablas de
  siempre, se crean una sola vez por sesión de pytest).
- El fixture `client` pisa la dependencia get_db de la app para que las
  rutas usen esa misma sesión de test en vez de conectarse a la base real.
"""

import uuid

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, select
from sqlalchemy.orm import sessionmaker

from app.auth.oauth2 import NOMBRE_USUARIO_MANAGER, create_access_token
from app.auth.verification import hash_password
from app.core.config import settings
from app.db import models
from app.db.database import Base, get_db
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


# Lo mismo que siembra la migración b7e3c5a1d9f2. create_all arma el esquema
# pero no corre migraciones, y sin estos tipos cualquier movimiento choca con
# la FK de tipo_factura. Se cargan una vez por sesión, fuera de la
# transacción de cada test: lo que un test cree o borre se rollbackea igual.
TIPOS_FACTURA_DE_FABRICA = [
    ("factura_a", "Factura A"),
    ("factura_b", "Factura B"),
    ("factura_c", "Factura C"),
    ("remito", "Remito"),
    ("recibo", "Recibo"),
    ("factura_interna", "Factura interna"),
    ("otros", "Otros"),
]


# Lo mismo que siembra la migración d8b1f4a7c2e9: «Contado» (protegido) es
# el default de compras y gastos, sin él no se puede crear ninguno.
CONDICIONES_PAGO_DE_FABRICA = [
    ("Contado", [], True),
    ("30 días", [30], False),
    ("60 días", [60], False),
    ("90 días", [90], False),
    ("30/60 días", [30, 60], False),
    ("30/60/90 días", [30, 60, 90], False),
    ("30/60/90/120 días", [30, 60, 90, 120], False),
]


# Lo mismo que siembra la migración c3f8a2d6e1b7: la FK de medio_pago.
MEDIOS_PAGO_DE_FABRICA = [
    ("efectivo", "Efectivo"),
    ("transferencia", "Transferencia"),
    ("cheque", "Cheque"),
    ("tarjeta", "Tarjeta"),
]


def _sembrar_medios_pago(engine):
    with sessionmaker(bind=engine)() as session:
        existentes = set(session.scalars(select(models.PaymentMethod.codigo)))
        session.add_all(
            models.PaymentMethod(codigo=codigo, nombre=nombre, orden=orden)
            for orden, (codigo, nombre) in enumerate(MEDIOS_PAGO_DE_FABRICA, start=1)
            if codigo not in existentes
        )
        session.commit()


def _sembrar_condiciones_pago(engine):
    with sessionmaker(bind=engine)() as session:
        existentes = set(session.scalars(select(models.PaymentCondition.nombre)))
        session.add_all(
            models.PaymentCondition(nombre=nombre, dias=dias, orden=orden, protegido=protegido)
            for orden, (nombre, dias, protegido) in enumerate(CONDICIONES_PAGO_DE_FABRICA, start=1)
            if nombre not in existentes
        )
        session.commit()


def _sembrar_tipos_factura(engine):
    # Idempotente: si una corrida anterior se cortó antes del drop_all, las
    # tablas (y los tipos) ya están.
    with sessionmaker(bind=engine)() as session:
        existentes = set(session.scalars(select(models.InvoiceType.codigo)))
        session.add_all(
            models.InvoiceType(codigo=codigo, nombre=nombre, orden=orden)
            for orden, (codigo, nombre) in enumerate(TIPOS_FACTURA_DE_FABRICA, start=1)
            if codigo not in existentes
        )
        session.commit()


@pytest.fixture(scope="session")
def db_engine():
    _crear_db_test_si_no_existe()
    engine = create_engine(_TEST_DB_URL)
    Base.metadata.create_all(bind=engine)
    _sembrar_tipos_factura(engine)
    _sembrar_condiciones_pago(engine)
    _sembrar_medios_pago(engine)
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
    usuario = models.User(
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
        models.AuthorizedUser(nombre_usuario="Agustin", rol="admin"),
        models.AuthorizedUser(nombre_usuario="Aldana", rol="admin"),
        models.AuthorizedUser(nombre_usuario="Alejandro", rol="lectura"),
        models.AuthorizedUser(nombre_usuario=NOMBRE_USUARIO_MANAGER, rol="lectura"),
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


@pytest.fixture()
def usuario_manager(db_session):
    """
    La cuenta de mantenimiento (ver requiere_manager): la única que administra
    el equipo. Rol "lectura" a propósito, para no
    arrastrar permisos de admin en el resto de los endpoints.

    OJO: test_auditoria.py y test_mantenimiento_cuentas.py definen su propia
    copia de esta fixture, que tapa a esta cuando corren. Son anteriores a que
    estuviera acá; no se tocaron para no meter ruido en esos archivos.
    """
    manager = models.User(
        nombre_usuario=NOMBRE_USUARIO_MANAGER,
        hashed_password=hash_password("clave-de-test-123"),
        rol="lectura",
    )
    db_session.add(manager)
    db_session.commit()
    db_session.refresh(manager)
    return manager


@pytest.fixture()
def headers_manager(usuario_manager):
    return _headers_para(usuario_manager)


@pytest.fixture()
def cotizacion():
    """
    Lo que todo movimiento de plata manda al crearse (ver
    schemas.FrozenExchangeRateIn). 1000 pesos por dólar a propósito: así
    las cuentas de los asserts se leen de un vistazo (15.000 ARS = 15 USD).
    Se usa como **cotizacion en el json de los POST, o en el constructor del
    modelo al armar movimientos directo en la base.
    """
    return {"cotizacion_dolar": 1000, "tipo_cambio": "blue"}


@pytest.fixture(autouse=True)
def _resetear_rate_limiter():
    """
    El Limiter de slowapi guarda sus contadores en memoria, compartidos por
    todo el proceso de pytest (no por test individual). Sin este reset, un
    test que agote el límite de /auth/login (ver test_seguridad.py) dejaría
    contadores "sucios" para el siguiente test que también pegue contra
    login, haciendo que la suite sea flaky según el orden en que corran.
    """
    from app.core.limiter import limiter

    limiter.reset()
    yield
    limiter.reset()
