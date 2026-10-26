"""
Freno contra fuerza bruta POR CUENTA en /auth/login (tabla intentos_login).

El límite por IP de slowapi (5/minute en login.py) solo frena a quien prueba
desde una sola IP: con muchas IPs no hay tope, y los nombres de usuario son
públicos (/usuarios/login-options), así que al atacante solo le falta la
contraseña. Esto cuenta los fallos de cada cuenta sin importar desde dónde
vengan:

- Los primeros FALLOS_SIN_ESPERA fallos seguidos son gratis (typos).
- Desde ahí, cada fallo nuevo bloquea la cuenta un rato que se duplica
  (1, 2, 4, 8, 16 minutos...) hasta ESPERA_MAXIMA. Mientras dura el bloqueo
  login.py rechaza SIN chequear la contraseña -- si la chequeara, el
  atacante seguiría probando igual y el bloqueo no frenaría nada.
- Un login correcto, o que Manager le resetee la contraseña, deja el
  contador en cero.
- Si el último fallo tiene más de VENTANA_DE_FALLOS, el contador arranca de
  nuevo: un typo de hoy no se suma a uno del mes pasado.

Costo asumido: alguien de afuera puede mantener bloqueada una cuenta con un
intento cada ESPERA_MAXIMA. Es el precio de cualquier bloqueo por cuenta;
Manager la destraba reseteando la contraseña.
"""

import math
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import case
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.db import models

FALLOS_SIN_ESPERA = 5
ESPERA_INICIAL = timedelta(minutes=1)
ESPERA_MAXIMA = timedelta(minutes=30)
VENTANA_DE_FALLOS = timedelta(hours=24)


def espera_para(fallidos: int) -> timedelta | None:
    """Cuánto queda bloqueada la cuenta después de su fallo número `fallidos`."""
    if fallidos < FALLOS_SIN_ESPERA:
        return None
    return min(ESPERA_INICIAL * 2 ** (fallidos - FALLOS_SIN_ESPERA), ESPERA_MAXIMA)


def minutos_de_bloqueo(db: Session, usuario_id: uuid.UUID) -> int | None:
    """Minutos (redondeados para arriba) que le faltan al bloqueo, o None si la cuenta no está bloqueada."""
    intento = db.get(models.LoginAttempt, usuario_id)
    if intento is None or intento.bloqueado_hasta is None:
        return None
    restante = intento.bloqueado_hasta - datetime.now(timezone.utc)
    if restante <= timedelta(0):
        return None
    return math.ceil(restante.total_seconds() / 60)


def registrar_fallo(db: Session, usuario_id: uuid.UUID) -> tuple[int, int | None]:
    """
    Suma un fallo y, si corresponde, bloquea la cuenta. Devuelve (fallos
    seguidos, minutos de bloqueo o None).

    INSERT ... ON CONFLICT con el incremento hecho por Postgres (y no leer,
    sumar en Python y escribir): dos intentos en paralelo contra la misma
    cuenta cuentan los dos, en vez de pisarse y perder uno.
    """
    ahora = datetime.now(timezone.utc)
    tabla = models.LoginAttempt.__table__
    sentencia = insert(tabla).values(usuario_id=usuario_id, fallidos=1, ultimo_fallo=ahora)
    sentencia = sentencia.on_conflict_do_update(
        index_elements=[tabla.c.usuario_id],
        set_={
            "fallidos": case(
                (tabla.c.ultimo_fallo < ahora - VENTANA_DE_FALLOS, 1),
                else_=tabla.c.fallidos + 1,
            ),
            "ultimo_fallo": ahora,
        },
    ).returning(tabla.c.fallidos)
    fallidos = db.execute(sentencia).scalar_one()

    espera = espera_para(fallidos)
    if espera is not None:
        db.query(models.LoginAttempt).filter(models.LoginAttempt.usuario_id == usuario_id).update(
            {"bloqueado_hasta": ahora + espera}, synchronize_session=False
        )
    db.commit()

    return fallidos, math.ceil(espera.total_seconds() / 60) if espera is not None else None


def limpiar(db: Session, usuario_id: uuid.UUID) -> None:
    """Contador a cero (login correcto o contraseña reseteada por Manager)."""
    db.query(models.LoginAttempt).filter(models.LoginAttempt.usuario_id == usuario_id).delete(
        synchronize_session=False
    )
    db.commit()
