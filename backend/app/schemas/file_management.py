from datetime import datetime

from pydantic import BaseModel, field_validator


class BucketObject(BaseModel):
    """Un objeto del bucket que no tiene ninguna fila de comprobante/nota
    apuntándolo -- ver app/api/files.py."""

    key: str
    tamanio_bytes: int
    modificado_en: datetime


class BrokenFile(BaseModel):
    """El caso inverso: una fila con archivo_path que ya no existe en el bucket."""

    tipo_recurso: str
    recurso_id: str
    archivo_path: str


class BucketReconciliation(BaseModel):
    huerfanos: list[BucketObject]
    rotos: list[BrokenFile]


class PurgeOrphansRequest(BaseModel):
    claves: list[str]

    @field_validator("claves")
    @classmethod
    def al_menos_una_clave(cls, claves: list[str]) -> list[str]:
        if not claves:
            raise ValueError("Mandá al menos una clave para purgar")
        return claves


class PurgeOrphansResult(BaseModel):
    """
    `omitidas`: claves que se pidieron purgar pero ya no son huérfanas o
    fallaron al borrar (ver api/files.py) -- se revalida cada una justo
    antes de borrar, no solo contra la lista que vio el front al abrir la
    pantalla.
    """

    purgadas: list[str]
    omitidas: list[str]
