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
    # access token (ver auth/oauth2.py y POST /auth/refresh) -- renueva la
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

    # B-11 (histórico): la whitelist de quién puede autoregistrarse vivía acá
    # como ROLES_PERMITIDOS_JSON. Ahora es la tabla usuarios_autorizados (ver
    # models.AuthorizedUser y app/api/users.py), para que la cuenta
    # "Manager" pueda sumar y sacar gente del equipo desde la app, sin editar
    # el .env ni redeployar. La migración d5a3c1e88f42 sembró esa tabla con
    # el equipo que estaba en el default de esta variable.
    #
    # "Manager" también está en esa whitelist (migración e7b2f4c19a83), o
    # sea que se registra desde /registro como cualquier otro. Es una
    # decisión tomada con el riesgo a la vista: POST /usuarios/crear es
    # público, así que mientras la cuenta esté autorizada y todavía sin
    # crear, cualquiera puede quedársela. Se banca porque la ventana dura lo
    # que tarda el dueño del proyecto en registrarse después del deploy y se
    # cierra sola (ver get_opciones_registro). scripts/crear_usuario_manager.py
    # sigue existiendo como alternativa por consola.

    # Lectura automática de comprobantes con IA (ver app/ai/extractor.py).
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
    # "https://homesolutions.company,https://www.homesolutions.company").
    # Default: solo el Vite dev server local.
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    @property
    def frontend_origins_list(self) -> list[str]:
        return [origen.strip() for origen in self.FRONTEND_ORIGINS.split(",") if origen.strip()]

    # Dominio explícito para las cookies de sesión (ver login.py). Sin
    # setear (default None) quedan "host-only": el browser solo las manda
    # de vuelta al mismo host exacto que las puso (ej. solo a
    # api.homesolutions.company). Alcanza para este caso -- el front nunca
    # lee el valor de la cookie (access_token es httpOnly), solo necesita
    # que el browser se la adjunte en sus pedidos a la API, y una vez que
    # front y back compartan dominio raíz eso pasa solo. Solo hace falta
    # setear esto (ej. ".homesolutions.company") si en el futuro otro
    # subdominio necesita compartir la misma cookie.
    COOKIE_DOMAIN: Optional[str] = None

    # Fuerza el valor de SameSite en vez de inferirlo de ENVIRONMENT (ver
    # login.py). None (default) mantiene el comportamiento de siempre:
    # "none" en producción -- necesario mientras front y back estén en
    # dominios de distinto "site" (ej. Vercel + Railway antes de tener
    # dominio propio) -- y "lax" en dev. Una vez que front
    # (homesolutions.company) y back (api.homesolutions.company) compartan
    # dominio raíz, dejan de ser cross-site para el browser: conviene
    # setear esto en "lax" explícito, más seguro que "none" y alcanza igual.
    COOKIE_SAMESITE: Optional[str] = None

    # Almacenamiento de comprobantes en un bucket S3-compatible (en
    # producción: el Storage Bucket de Railway; sirve igual para R2, S3 o
    # cualquier otro que hable S3). Si las 4 obligatorias no están seteadas,
    # app/file_management/storage.py guarda los archivos en disco local (comportamiento
    # de siempre, para dev). En producción el disco del servicio no persiste
    # entre deploys/reinicios, así que ahí sí hay que completarlas antes de
    # subir comprobantes reales.
    #
    # En Railway salen de la pestaña "Credentials" del bucket, y se cargan en
    # el servicio del backend como referencias de variables:
    #   S3_ENDPOINT_URL      <- ENDPOINT  (ej. https://t3.storageapi.dev)
    #   S3_ACCESS_KEY_ID     <- ACCESS_KEY_ID
    #   S3_SECRET_ACCESS_KEY <- SECRET_ACCESS_KEY
    #   S3_BUCKET_NAME       <- BUCKET    (NO usar RAILWAY_BUCKET_NAME: ese es
    #                                      el nombre visible, no el de la API)
    #   S3_REGION            <- REGION    (opcional, default "auto")
    S3_ENDPOINT_URL: Optional[str] = None
    S3_ACCESS_KEY_ID: Optional[str] = None
    S3_SECRET_ACCESS_KEY: Optional[str] = None
    S3_BUCKET_NAME: Optional[str] = None
    S3_REGION: str = "auto"
    # "virtual" (bucket como subdominio del endpoint) es lo que usan los
    # buckets nuevos de Railway. Los buckets viejos de Railway pueden pedir
    # "path": la pestaña Credentials del bucket dice cuál corresponde.
    S3_ADDRESSING_STYLE: str = "virtual"

    @property
    def bucket_configurado(self) -> bool:
        return all(
            [self.S3_ENDPOINT_URL, self.S3_ACCESS_KEY_ID, self.S3_SECRET_ACCESS_KEY, self.S3_BUCKET_NAME]
        )


settings = Settings()
