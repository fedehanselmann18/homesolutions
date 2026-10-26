import re
import uuid

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.common import TimestampOut

# XX-XXXXXXXX-X, con o sin guiones (los grupos son fijos: 2 dígitos de tipo,
# 8 de DNI/razón social, 1 verificador -- ver _validar_cuit).
_CUIT_REGEX = re.compile(r"^(\d{2})-?(\d{8})-?(\d{1})$")

_CUIT_MULTIPLICADORES = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]


def _validar_cuit(valor: str | None) -> str | None:
    """Valida formato (11 dígitos, con o sin guiones) y el dígito
    verificador con el algoritmo estándar de AFIP (módulo 11). Devuelve el
    valor tal cual lo mandó el cliente (con o sin guiones, no se normaliza)
    si es válido, o levanta ValueError con un mensaje claro si no.

    El CUIT es opcional: si no vino (None) o vino vacío, se guarda como None
    en vez de "" -- así "no lo sé" es un solo valor en la base y no dos.
    Ahora bien, si el usuario SÍ escribió algo, se valida igual de estricto
    que antes: un CUIT a medias es peor que no tenerlo."""
    if valor is None or not valor.strip():
        return None

    coincidencia = _CUIT_REGEX.match(valor.strip())
    if not coincidencia:
        raise ValueError(
            "El CUIT/CUIL tiene que tener el formato XX-XXXXXXXX-X (11 dígitos, con o sin guiones)"
        )

    digitos = "".join(coincidencia.groups())
    suma = sum(int(d) * m for d, m in zip(digitos[:10], _CUIT_MULTIPLICADORES))
    resto = suma % 11
    verificador_esperado = 11 - resto
    if verificador_esperado == 11:
        verificador_esperado = 0

    if verificador_esperado == 10 or int(digitos[10]) != verificador_esperado:
        raise ValueError("El CUIT/CUIL no es válido (el dígito verificador no coincide)")

    return valor.strip()


class SupplierBase(BaseModel):
    nombre: str
    cuit: str | None = None  # opcional, ver _validar_cuit
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None


class SupplierCreate(SupplierBase):
    @field_validator("cuit")
    @classmethod
    def cuit_valido(cls, valor: str | None) -> str | None:
        return _validar_cuit(valor)


class SupplierUpdate(BaseModel):
    nombre: str | None = None
    cuit: str | None = None
    direccion: str | None = None
    telefono: str | None = None
    email: str | None = None

    @field_validator("cuit")
    @classmethod
    def cuit_valido(cls, valor: str | None) -> str | None:
        return _validar_cuit(valor)


class SupplierOut(SupplierBase, TimestampOut):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
