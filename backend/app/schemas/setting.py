from pydantic import BaseModel, field_validator


class SettingValue(BaseModel):
    """
    Una clave editable (ver app/core/app_settings.py, CLAVES_CONFIGURABLES) con
    su valor efectivo (fila de la tabla o default de Settings/.env) y si ese
    valor viene de una fila o del fallback -- el front lo usa para mostrar
    "(valor del .env)" cuando todavía nadie la pisó desde acá.
    """

    clave: str
    valor: str
    descripcion: str
    personalizado: bool


class SettingUpdate(BaseModel):
    valor: str

    @field_validator("valor")
    @classmethod
    def valor_no_vacio(cls, valor: str) -> str:
        limpio = valor.strip()
        if not limpio:
            raise ValueError("El valor no puede estar vacío")
        return limpio
