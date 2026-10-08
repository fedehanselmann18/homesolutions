# Backups de la base

## Requisito

Necesitás `pg_dump` y `psql` en el PATH. Si instalaste Postgres con
Postgres.app o `brew install postgresql@16` ya los tenés. Probá con:

```bash
pg_dump --version
```

## Backup manual

```bash
cd backend
./scripts/backup_db.sh
```

Guarda un `.sql.gz` en `backend/backups/` (carpeta gitignoreada, no se sube
al repo) con la fecha y hora en el nombre, y borra automáticamente los que
tengan más de 14 días. Para cambiar la retención, editá `RETENCION_DIAS` al
principio del script.

## Restaurar un backup

```bash
cd backend
./scripts/restore_db.sh backups/homesolutions_20260729_030000.sql.gz
```

Pide confirmación antes de pisar la base actual.

## Más adelante (S3)

Cuando pasen a producción, este mismo script sirve de base: después de crear
el `.sql.gz` se le agrega un paso que lo suba a un bucket (por ejemplo con
`aws s3 cp`) y listo, sin tener que rehacer la lógica del dump.
