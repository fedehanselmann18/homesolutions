"""
Crea la cuenta "Manager": la única que puede resetearle la contraseña a
otros usuarios (ver requiere_manager en app/auth/oAuth2.py y
POST /usuarios/{user_id}/resetear-password).

Vía normal: registrarla desde /registro como cualquier otra cuenta
("Manager" está en la whitelist, ver migración e7b2f4c19a83). Este script
es la alternativa por consola, para cuando conviene no exponer el nombre en
el combo público de /registro ni siquiera el rato que tarda el alta -- por
ejemplo si la app ya está en producción con datos reales.

Se le da rol "lectura" y no "admin": su único poder especial viene de
requiere_manager (gateado por nombre de usuario), así no hereda de arrastre
los permisos de admin del resto de los endpoints.

Idempotente: si la cuenta ya existe avisa y sale sin tocar nada (para
cambiarle la contraseña, borrala de la base y volvé a correr esto).

La contraseña se pide por getpass, nunca como argumento de línea de
comandos: así no queda en el historial de la shell.

Uso: desde backend/, con el venv activado:
    python -m scripts.crear_usuario_manager
"""

import getpass
import sys

from app.auth.oAuth2 import NOMBRE_USUARIO_MANAGER
from app.auth.verification import hash_password
from app.db import models
from app.db.db import SessionLocal

MINIMO_PASSWORD = 8  # mismo mínimo que UsuarioCreate/UsuarioResetPassword


def pedir_password() -> str:
    password = getpass.getpass(f"Contraseña para {NOMBRE_USUARIO_MANAGER}: ")
    if len(password) < MINIMO_PASSWORD:
        print(f"La contraseña tiene que tener al menos {MINIMO_PASSWORD} caracteres.")
        sys.exit(1)

    confirmacion = getpass.getpass("Repetila para confirmar: ")
    if password != confirmacion:
        print("Las contraseñas no coinciden.")
        sys.exit(1)

    return password


def main():
    db = SessionLocal()
    try:
        existente = (
            db.query(models.Usuario).filter(models.Usuario.nombre_usuario == NOMBRE_USUARIO_MANAGER).first()
        )
        if existente:
            print(f'El usuario "{NOMBRE_USUARIO_MANAGER}" ya existe (id {existente.id}). No se creó nada.')
            return

        password = pedir_password()

        manager = models.Usuario(
            nombre_usuario=NOMBRE_USUARIO_MANAGER,
            rol="lectura",
            hashed_password=hash_password(password),
        )
        db.add(manager)
        db.commit()
        db.refresh(manager)
        print(f'Usuario "{NOMBRE_USUARIO_MANAGER}" creado (id {manager.id}).')
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
