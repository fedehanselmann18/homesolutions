#!/usr/bin/env bash
# Backup de la base de HomeSolutions a un .sql.gz con fecha y hora, y borra
# los backups más viejos que RETENCION_DIAS. Usa las mismas credenciales que
# la app (backend/.env), no hay que configurar nada aparte.
#
# Uso manual:
#   cd backend && ./scripts/backup_db.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"
BACKUP_DIR="$BACKEND_DIR/backups"
RETENCION_DIAS=14

if [ ! -f "$ENV_FILE" ]; then
  echo "No se encontró $ENV_FILE" >&2
  exit 1
fi

PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
[ -x "$PYTHON_BIN" ] || PYTHON_BIN="python3"

# Lee las credenciales de .env con python-dotenv (la misma librería que ya
# usa la app) en vez de parsear el archivo a mano con grep/sed, para no
# romperse si algún valor tiene espacios o caracteres raros.
TMP_ENV="$(mktemp)"
trap 'rm -f "$TMP_ENV"' EXIT

"$PYTHON_BIN" - "$ENV_FILE" > "$TMP_ENV" <<'PYEOF'
import shlex
import sys
from dotenv import dotenv_values

valores = dotenv_values(sys.argv[1])
for clave in ("database_host", "database_port", "database_name", "database_user", "database_password"):
    valor = (valores.get(clave) or "").strip()
    print(f"{clave}={shlex.quote(valor)}")
PYEOF

# shellcheck source=/dev/null
source "$TMP_ENV"

mkdir -p "$BACKUP_DIR"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
ARCHIVO="$BACKUP_DIR/${database_name}_${TIMESTAMP}.sql.gz"

export PGPASSWORD="$database_password"
pg_dump -h "$database_host" -p "$database_port" -U "$database_user" -d "$database_name" \
  --format=plain --no-owner --no-privileges | gzip > "$ARCHIVO"
unset PGPASSWORD

echo "Backup creado: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

# Borra backups más viejos que RETENCION_DIAS
find "$BACKUP_DIR" -name "*.sql.gz" -mtime "+$RETENCION_DIAS" -delete

echo ""
echo "Backups guardados en $BACKUP_DIR:"
ls -lh "$BACKUP_DIR"
