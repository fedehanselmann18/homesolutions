# Prompts — Fase 1 (Backend / Frontend)
Para pegar directo en Claude Code. Cada uno es independiente, se pueden correr en paralelo (tocan carpetas distintas: `backend/` y `frontend/`).

---

## BACKEND — Fase 1

```
Contexto: HomeSolutions es una app interna (FastAPI + SQLAlchemy + PostgreSQL, backend en backend/app/). Estoy resolviendo hallazgos de una auditoría técnica, track backend, Fase 1 (crítico, bajo esfuerzo). Hacé cada punto como un commit separado y corré los tests después de cada uno.

1. Índices en FKs de alta frecuencia (ref auditoría B-03)
   Archivo: backend/app/db/models.py
   Agregá index=True a las columnas FK de alta frecuencia: fase_id, proyecto_id, proveedor_id y usuario_id en los modelos Compra, Gasto, Cobro y NotaCompra (revisá cuáles de estos modelos tienen cada columna). Generá la migración con Alembic (backend/alembic/versions/) y verificá que "alembic upgrade head" corra limpio contra una DB de prueba.

2. Health check real (ref B-09)
   Archivo: backend/app/main.py
   Agregá GET /health que ejecute un SELECT 1 contra la DB (usando la sesión existente en backend/app/db/db.py) y devuelva 200 con {"status": "ok"} si conecta, o 503 si falla. No debe requerir auth.

3. Corregir default de GEMINI_MODEL (ref B-10)
   Archivo: backend/app/config.py
   El default actual es "gemini-3.6-flash", que no es un modelo válido de la API de Google. Investigá cuál es el nombre correcto de modelo Gemini flash vigente hoy y actualizá el default. Agregá un comentario con la fecha de verificación para que sea fácil detectar si vuelve a quedar desactualizado.

4. Reducir expiración del JWT (parte de B-06, quick win)
   Archivo: backend/app/config.py
   Cambiá ACCESS_TOKEN_EXPIRE_MINUTES de 120 a 60. No toques nada más de la lógica de auth (el refresh token / blacklist queda para más adelante, no lo implementes ahora).

5. Logging de auditoría en operaciones críticas (ref B-13)
   Archivos: backend/app/routes/proyectos.py, compras.py, gastos.py, cobros.py
   Agregá un logger dedicado (ej. logging.getLogger("audit")) y logueá en INFO cada create/update/delete de proyecto, compra, gasto y cobro: incluir current_user.id, acción (create/update/delete), tipo y id del recurso, timestamp. Usá el usuario que ya se extrae del JWT en cada endpoint, no lo tomes del body.

6. CI para backend (ref D-02, parte backend)
   Archivo: .github/workflows/backend-tests.yml (nuevo)
   Workflow de GitHub Actions que en cada push y pull request instale dependencias de backend/requirements.txt (o pyproject, según corresponda) y corra pytest sobre backend/tests. Que falle el check si algún test falla.

Al terminar: corré la suite completa de pytest en backend/, confirmá que la migración de Alembic aplica sin errores, y dejá un resumen corto de qué tocaste y qué falta (si algo no se pudo cerrar del todo).
```

---

## FRONTEND — Fase 1

```
Contexto: HomeSolutions es una app interna (React + Vite, frontend en frontend/src/). Estoy resolviendo hallazgos de una auditoría técnica, track frontend, Fase 1 (crítico, bajo esfuerzo). Hacé cada punto como un commit separado.

1. Estado de error explícito en ProyectoDetalle (ref F-07)
   Archivo: frontend/src/pages/ProyectoDetalle.jsx
   Hoy si el fetch del proyecto falla, solo hace console.error y el componente queda mostrando el loader para siempre. Agregá un estado de error (useState) y, si el fetch falla, renderizá el componente existente EstadoVacio (frontend/src/components/shared/EstadoVacio.jsx) con un mensaje claro en vez del spinner infinito.

2. Error Boundary global (ref F-05)
   Archivo: frontend/src/App.jsx
   Creá un componente ErrorBoundary (nuevo, en frontend/src/components/shared/ErrorBoundary.jsx) que capture errores de render en el árbol de componentes y muestre un fallback amigable (mensaje + botón para volver al inicio), en vez de pantalla en blanco. Envolvé el router principal con este boundary en App.jsx.

3. Modal de confirmación para acciones destructivas (ref F-08)
   Carpeta: frontend/src/components/modals/
   Revisá si ya existe algún modal de confirmación genérico; si no, creá ModalConfirmar.jsx (props: título, mensaje, nombre del recurso a eliminar, onConfirmar, onCancelar). Conectalo a todos los flujos de borrado que encuentres (proyectos, compras, gastos, cobros, proveedores — buscá los handlers de delete en Acciones.jsx, Fases.jsx, ProyectoDetalleHeader.jsx, Proveedores.jsx y donde corresponda) para que ninguna acción de borrado se ejecute sin confirmación explícita.

4. Breadcrumbs en navegación profunda (ref U-02)
   Archivos: frontend/src/pages/ProyectoDetalle.jsx, frontend/src/pages/FaseDetalle.jsx
   Agregá un breadcrumb simple (Proyectos > {nombreProyecto} > {nombreFase} cuando aplique) usando los datos de proyecto/fase que estos componentes ya fetchan. Con links para volver a los niveles anteriores.

5. CI para frontend (ref D-02, parte frontend)
   Archivo: .github/workflows/frontend-tests.yml (nuevo)
   Workflow de GitHub Actions que en cada push y pull request instale dependencias de frontend/ (npm ci) y corra "npm run test" (vitest run) y "npm run build". Que falle el check si algo rompe.

Al terminar: corré vitest y npm run build en frontend/, confirmá que no rompiste nada existente, y dejá un resumen corto de qué tocaste y qué falta.
```
