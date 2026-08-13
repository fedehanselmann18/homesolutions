"""
Paginación opcional para endpoints de listado (B-01).

limit/offset son OPCIONALES y sin default de truncado: si no se mandan, el
endpoint devuelve la lista completa, igual que hoy. Esto es a propósito --
varias pantallas del frontend (Dashboard, Comparador, dropdowns de
selección de proveedor/producto) todavía esperan la lista completa de una
sola llamada, sin manejar paginado. Meter un default como limit=50 ahí
truncaría esas pantallas en silencio. Los parámetros quedan listos para
que el frontend los empiece a usar cuando se sume paginado real ahí
(infinite scroll, tablas paginadas, etc.); ese día tiene sentido evaluar
subirle un default acá.

limit tiene un tope (500) para que, cuando SÍ se use, no sirva para pedir
la tabla entera en una sola página igual.
"""

from fastapi import Query


class ParametrosPaginacion:
    def __init__(
        self,
        limit: int | None = Query(
            None, ge=1, le=500,
            description="Máximo de resultados. Sin este parámetro, devuelve la lista completa.",
        ),
        offset: int = Query(0, ge=0, description="Resultados a saltear desde el principio."),
    ):
        self.limit = limit
        self.offset = offset
