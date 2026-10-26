import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Token schemas
# ---------------------------------------------------------------------------
class LoginResponse(BaseModel):
    """Body de POST /auth/login. El JWT en sí NO viaja acá -- ver comentario
    en api/authentication.py sobre por qué (B-05: evitar que el token quede
    expuesto en logs/histories que sí capturan el body de la respuesta)."""

    message: str


class TokenData(BaseModel):
    user_id: Optional[uuid.UUID] = None
    # Cuándo se emitió el JWT (claim "iat") -- ver revocación en
    # auth/oauth2.py (B-06): un token con iat anterior a la última
    # modificación del usuario se trata como inválido.
    iat: Optional[datetime] = None
    # Solo los refresh tokens: id único (claim "jti") y vencimiento (claim
    # "exp"), para poder darlos de baja uno por uno en /auth/logout (ver
    # models.RevokedRefreshToken).
    jti: Optional[str] = None
    exp: Optional[datetime] = None


# Largo mínimo de contraseña al crear la cuenta o al resetearla. Las cuentas
# ya creadas con menos siguen entrando: la regla solo mira contraseñas nuevas.
# Espejo en el front: MINIMO_PASSWORD de utils/formValidation.js.
MIN_PASSWORD_LENGTH = 10
