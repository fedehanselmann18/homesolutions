from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_host: str
    database_port: int
    database_user: str
    database_password: str
    database_name: str
    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    OPENAI_API_KEY: Optional[str] = None

    # "development" (default, local) | "production" (deploy real).
    # Controla flags sensibles a HTTPS: la cookie del JWT solo se manda
    # marcada como "secure" en producción, porque en local se corre sobre
    # http:// y el navegador la descartaría directamente.
    ENVIRONMENT: str = "development"

    # Orígenes permitidos por CORS, separados por coma (ej. en producción:
    # "https://homesolutions.vercel.app,https://www.homesolutions.com.ar").
    # Default: solo el Vite dev server local.
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def frontend_origins_list(self) -> list[str]:
        return [origen.strip() for origen in self.FRONTEND_ORIGINS.split(",") if origen.strip()]


settings = Settings()
