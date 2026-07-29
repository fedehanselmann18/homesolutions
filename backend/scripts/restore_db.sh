#!/usr/bin/env bash
# Restaura la base de HomeSolutions desde un backup hecho con backup_db.sh.
# CUIDADO: pisa el contenido actual de las tablas que estén en el dump.
#
# Uso:
#   cd backend && ./scripts/restore_db.sh backups/homesolutions_20260729_030000.sql.gz

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$BACKEND_DIR/.env"

ARCHIVO="${1:-}"
if [ -z "$ARCHIVO" ]; then
  echo "Uso: $0 <archivo.sql.gz>" >&2
  exit 1
fi
if [ ! -f "$ARCHIVO" ]; then
  echo "No se encontró el archivo: $ARCHIVO" >&2
  exit 1
fi

PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
[ -x "$PYTHON_BIN" ] || PYTHON_BIN="python3"

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

echo "Esto va a sobrescribir el contenido de la base '$database_name' con lo que hay en:"
echo "  $ARCHIVO"
read -r -p "Escribí 'si' para confirmar: " CONFIRMACION
if [ "$CONFIRMACION" != "si" ]; then
  echo "Cancelado."
  exit 1
fi

export PGPASSWORD="$database_password"
gunzip -c "$ARCHIVO" | psql -h "$database_host" -p "$database_port" -U "$database_user" -d "$database_name"
unset PGPASSWORD

echo "Restaurado desde $ARCHIVO"
