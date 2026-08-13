import json
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
    # B-06: refresh token de larga duración, en una cookie separada del
    # access token (ver auth/oAuth2.py y POST /auth/refresh) -- renueva la
    # sesión sin pedir credenciales de nuevo hasta que venza esto.
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

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

    # B-11: usuarios autorizados a autoregistrarse (ver routes/usuarios.py)
    # y su rol fijo -- antes hardcodeado en ROLES_PERMITIDOS en el código.
    # JSON: {"nombre_usuario": "rol", ...} (rol es "admin" o "lectura").
    # Sumar/sacar gente del equipo es ahora cambiar el .env, no un deploy de
    # código nuevo. Default: el equipo actual, para que nada cambie si no se
    # define la env var.
    ROLES_PERMITIDOS_JSON: str = '{"Agustin": "admin", "Aldana": "admin", "Alejandro": "lectura"}'

    @field_validator("ROLES_PERMITIDOS_JSON")
    @classmethod
    def roles_permitidos_json_valido(cls, valor: str) -> str:
        # Mismo criterio que secret_key_fuerte: falla al arrancar si el JSON
        # está mal tipeado en el .env, en vez de recién explotar cuando
        # alguien intente registrarse.
        try:
            parsed = json.loads(valor)
        except json.JSONDecodeError as exc:
            raise ValueError(f"ROLES_PERMITIDOS_JSON no es JSON válido: {exc}")
        if not isinstance(parsed, dict) or not all(
            isinstance(k, str) and isinstance(v, str) for k, v in parsed.items()
        ):
            raise ValueError('ROLES_PERMITIDOS_JSON tiene que ser un objeto JSON {"usuario": "rol", ...}')
        return valor

    @property
    def roles_permitidos(self) -> dict[str, str]:
        return json.loads(self.ROLES_PERMITIDOS_JSON)

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
