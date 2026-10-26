from sqlalchemy.exc import IntegrityError

# SQLSTATE de Postgres para una violación de UNIQUE.
_UNIQUE_VIOLATION = "23505"


def es_violacion_unicidad(error: IntegrityError) -> bool:
    """True si el IntegrityError vino de un UNIQUE (ej. nombre repetido) y no
    de otra restricción (NOT NULL, FK). Sirve para devolverle al usuario el
    motivo concreto en vez de un "datos inválidos" que no le dice qué cambiar."""
    return getattr(error.orig, "pgcode", None) == _UNIQUE_VIOLATION
