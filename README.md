# HomeSolutions

App interna de gestión de proyectos de construcción: proyectos, fases, compras
a proveedores, gastos, cobros y la cuenta corriente (notas de crédito/débito)
de cada uno. Backend en FastAPI + SQLAlchemy + PostgreSQL, frontend en React
(Vite).

## Prerequisitos

- **Python 3.12** (ver `backend/.python-version`)
- **PostgreSQL** corriendo en local (o accesible por red)
- **Node.js 20+** y **npm** (el frontend usa Vite 6, que requiere Node 18.19+ o 20+)
- `pip` y `venv` (vienen con Python)

## Backend

```bashsigo aca
cd backend
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements-dev.txt   # instala requirements.txt + herramientas de dev/test

cp .env.example .env
# completar .env: credenciales de Postgres, SECRET_KEY (generarla con el
# comando que indica el propio .env.example), y el resto según haga falta
# (GEMINI_API_KEY para el autocompletado con IA, credenciales de R2 para
# almacenamiento de comprobantes en producción -- ninguna de las dos es
# obligatoria para levantar el backend en local)

alembic upgrade head               # crea/actualiza el esquema en la DB de .env

uvicorn app.main:app --reload      # http://localhost:8000
```

La API queda disponible en `http://localhost:8000` (docs interactivas en
`http://localhost:8000/docs`) y `GET /health` sirve como health check (sin
auth, hace un `SELECT 1` contra la DB).

### Tests del backend

```bash
cd backend
source .venv/bin/activate
pytest
```

Los tests usan una base de datos de test aparte (mismo Postgres de `.env`,
con `_test` agregado al nombre) que se crea sola la primera vez que corrés
`pytest` -- nunca tocan la base de desarrollo. Ver `backend/tests/conftest.py`
para el detalle.

### Migraciones (Alembic)

```bash
cd backend
source .venv/bin/activate

alembic upgrade head                                  # aplicar todas las migraciones pendientes
alembic revision --autogenerate -m "descripción corta" # generar una nueva a partir de cambios en app/db/models.py
alembic downgrade -1                                   # revertir la última
alembic history                                        # ver el historial
```

Revisá siempre el archivo que genera `--autogenerate` en
`backend/alembic/versions/` antes de aplicarlo: el autogenerate detecta la
mayoría de los cambios de schema, pero no todos (ej. algunos `CHECK`,
renombres de columna que ve como drop+add).

## Frontend

```bash
cd frontend
cp .env.example .env    # VITE_API_URL=http://localhost:8000 por default
npm install
npm run dev              # http://localhost:5173
```

`VITE_API_URL` (ver `frontend/src/api/axiosClient.js`) tiene que apuntar a
donde esté corriendo el backend -- si lo corriste con el `uvicorn` de arriba
sin tocar nada, `http://localhost:8000` ya es correcto.

### Tests del frontend

```bash
cd frontend
npm run test        # corre una vez
npm run test:watch  # modo watch
```

### Lint

```bash
cd frontend
npm run lint
```

## CI

`.github/workflows/backend-tests.yml` corre `pytest` en cada push/PR que
toque `backend/` (contra un Postgres de servicio efímero, sin depender de
ningún `.env`).

## Estructura del repo

```
.
├── backend/
│   ├── app/
│   │   ├── main.py            # entrypoint FastAPI, middlewares, routers
│   │   ├── config.py          # Settings (pydantic-settings, lee .env)
│   │   ├── db/                # modelos SQLAlchemy (models.py) y sesión (db.py)
│   │   ├── routes/            # un router por recurso (proyectos, compras, gastos, cobros...)
│   │   ├── auth/               # JWT (access + refresh token), hashing, permisos
│   │   ├── files/             # storage.py: comprobantes en disco local o Cloudflare R2
│   │   ├── ia/                # lectura automática de comprobantes con Gemini
│   │   ├── reportes/          # generación de PDF (reporte financiero de proyecto)
│   │   ├── schemas.py         # schemas Pydantic (Create/Update/Out por entidad)
│   │   ├── security_middleware.py  # CSRF, security headers, manejo de errores
│   │   └── limiter.py         # rate limiting (slowapi)
│   ├── alembic/versions/      # migraciones
│   └── tests/                 # pytest, un archivo por área/recurso
├── frontend/
│   └── src/
│       ├── pages/             # una pantalla por ruta (Dashboard, Proyectos, Login...)
│       ├── components/        # componentes reusables, agrupados por área
│       ├── services/          # un archivo por recurso, llaman a la API vía axiosClient
│       ├── hooks/             # lógica de estado reusable (ej. useAuthProvider)
│       ├── api/                # cliente axios (cookies, CSRF, manejo de errores)
│       └── context/            # contexto de auth (usuario actual, login/logout)
├── docs/                      # informes de auditoría y planes de acción
└── .github/workflows/         # CI
```

## Autenticación (resumen)

El login (`POST /auth/login`) deja dos cookies httpOnly: `access_token` (60
min) y `refresh_token` (7 días, acotada a `/auth`), más una cookie legible
por JS (`csrf_token`) que el frontend reenvía como header `X-CSRF-Token` en
cada request que modifica datos. `POST /auth/refresh` renueva el access
token sin pedir credenciales de nuevo, hasta que venza el refresh token.
Clientes tipo API pueden usar el header `Authorization: Bearer <token>` en
vez de cookies (ver `backend/app/auth/oAuth2.py`).
