# Database connection and session management for SQLAlchemy in a FastAPI application.

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings

MY_DB_URL = f"postgresql+psycopg2://{settings.database_user}:{settings.database_password}@{settings.database_host}:{settings.database_port}/{settings.database_name}"

# pool_pre_ping: antes de reusar una conexión del pool hace un ping barato y,
# si el server la cerró (Postgres de Railway corta las conexiones inactivas),
# la descarta y abre otra. Sin esto, el primer request después de un rato sin
# uso puede fallar con un 500 por "server closed the connection".
engine = create_engine(
    MY_DB_URL,
    pool_pre_ping=True,
    connect_args={"sslmode": "require"} if settings.ENVIRONMENT == "production" else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
