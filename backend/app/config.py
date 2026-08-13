from typing import Optional

from pydantic import field_validator
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
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @field_validator("SECRET_KEY")
    @classmethod
    def secret_key_fuerte(cls, valor: str) -> str:
        # Falla rápido al arrancar en vez de firmar JWTs con una clave débil
        # o vacía -- mejor un crash claro en el deploy que un token
        # falsificable en producción. Generar una con:
        # python -c "import secrets; print(secrets.token_hex(32))"
        if len(valor) < 32:
            raise ValueError("SECRET_KEY tiene que tener al menos 32 caracteres")
        return valor

    # Lectura automática de comprobantes con IA (ver app/ia/extractor.py).
    # Sacar la key en https://aistudio.google.com/apikey. Sin esto configurado,
    # el botón "Autocompletar con IA" de los modales devuelve error 502.
    GEMINI_API_KEY: Optional[str] = None
    # Configurable por si Google renombra/discontinúa el modelo (pasa seguido)
    # sin tener que tocar código, solo el .env.
    # Verificado contra ai.google.dev (ficha del modelo + changelog) el
    # 2026-08-13: "gemini-3.6-flash" es GA desde el 21/07/2026 y es el
    # Flash más nuevo disponible -- el default sigue siendo válido.
    GEMINI_MODEL: str = "gemini-3.6-flash"

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

    # Almacenamiento de comprobantes en Cloudflare R2 (S3-compatible). Si
    # estas 4 variables no están seteadas, app/files/storage.py guarda los
    # archivos en disco local (comportamiento de siempre, para dev). En
    # producción (Railway) el disco no persiste entre deploys/reinicios, así
    # que ahí sí hay que completarlas antes de subir comprobantes reales.
    # Ver panel de Cloudflare > R2 > "Manage API tokens" para generar las
    # credenciales y el nombre del bucket creado ahí.
    R2_ACCOUNT_ID: Optional[str] = None
    R2_ACCESS_KEY_ID: Optional[str] = None
    R2_SECRET_ACCESS_KEY: Optional[str] = None
    R2_BUCKET_NAME: Optional[str] = None

    @property
    def r2_configurado(self) -> bool:
        return all([self.R2_ACCOUNT_ID, self.R2_ACCESS_KEY_ID, self.R2_SECRET_ACCESS_KEY, self.R2_BUCKET_NAME])

    @property
    def r2_endpoint_url(self) -> str:
        return f"https://{self.R2_ACCOUNT_ID}.r2.cloudflarestorage.com"


settings = Settings()
