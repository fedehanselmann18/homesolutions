# CLAUDE.md — HomeSolutions

Contexto de proyecto para trabajar acá con Claude Code / Cowork. Este archivo
es un mapa rápido; para el detalle del sistema visual, ver
[`docs/DESIGN.md`](./DESIGN.md) — no dupliques su contenido, actualizalo a él
en vez de a este archivo cuando cambie algo de diseño.

App interna de gestión de proyectos de construcción: proyectos, fases,
compras a proveedores, gastos, cobros y cuenta corriente (notas de
crédito/débito) por proyecto.

---

## 1. Stack

**Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, PostgreSQL, Alembic
(migraciones), Pydantic v2 / pydantic-settings, JWT (PyJWT) en cookies
httpOnly + CSRF, slowapi (rate limiting), reportlab (PDFs), boto3 (Cloudflare
R2 para comprobantes en prod), google-genai (Gemini, lectura de comprobantes
y catálogos), pandas/openpyxl (parseo de catálogos Excel/CSV).

**Frontend**: React 18 + Vite 6, React Router 7, TanStack React Query 5,
Axios, lucide-react (íconos), recharts (gráficos), Vitest + Testing Library
(tests). **CSS plano con sistema de tokens propio — no hay Tailwind ni
ningún otro framework de utilidades.** Ver §5.

**Deploy**: frontend en Vercel (`frontend/vercel.json`, incluye CSP),
backend en Railway (`backend/railway.json`, corre `alembic upgrade head`
antes de levantar uvicorn). Dominios propios: `homesolutions.company`
(front) y `api.homesolutions.company` (back) — necesario para que las
cookies de sesión persistan cross-site en Safari/iOS (ver
`login_cross_site_cookie_fix` en memoria de proyecto).

**CI**: GitHub Actions, un workflow por lado (`backend-tests.yml`,
`frontend-tests.yml`), cada uno gateado por `paths:` para no correr si no
tocaste esa carpeta.

---

## 2. Arquitectura de carpetas

```
backend/app/
├── main.py              # entrypoint FastAPI, middlewares, routers
├── config.py             # Settings (pydantic-settings, lee .env)
├── db/                   # models.py (SQLAlchemy) y db.py (sesión)
├── routes/                # un router por recurso (proyectos, compras, gastos, cobros, ...)
├── auth/                  # JWT access+refresh, hashing, permisos
├── files/storage.py       # comprobantes: disco local (dev) o R2 (prod)
├── ia/                    # lectura de comprobantes y catálogos con Gemini
├── reportes/               # generación de PDF (reporte financiero de proyecto)
├── schemas.py              # Pydantic Create/Update/Out por entidad
├── security_middleware.py  # CSRF, security headers, manejo de errores
└── limiter.py               # rate limiting

backend/alembic/versions/    # migraciones, una por cambio de schema
backend/tests/                # pytest, un archivo por área/recurso

frontend/src/
├── pages/                # una pantalla por ruta (Dashboard, Proyectos, ProyectoDetalle, Login...)
├── components/
│   ├── shared/            # reutilizables entre pantallas (PageHeader, Buscador, Tabs, EstadoVacio...)
│   ├── modals/             # ModalShell + un modal por entidad
│   └── <área>/             # proyectos/, fases/, proveedores/, manager/ — específicos de esa área
├── services/               # un archivo por recurso, llaman a axiosClient (1:1 con endpoints del back)
├── hooks/
│   ├── queries.js           # hooks de lectura (React Query) compartidos, 1:1 a un endpoint
│   └── use*.js               # lógica de estado reusable (useAuthProvider, useModal, ...)
├── lib/
│   ├── queryKeys.js          # fuente única de query keys de React Query
│   └── queryClient.js
├── api/axiosClient.js         # cliente axios (cookies, CSRF, redirect en 401)
├── context/                   # AuthContext, ToastContext
├── router/                    # AppRouter, ProtectedRoute
├── constants/                  # colores.js, estados.js, tipoMovimiento.js, ...
└── utils/                      # funciones puras (formato, fechas, validación, análisis), con sus .test.js
```

Regla general: **un componente de UI trae su propio `.css` al lado**, con el
mismo nombre de archivo. No hay carpeta `styles/` centralizada.

---

## 3. Convenciones de React

- **Componentes funcionales, hooks, sin clases.**
- **Nombres de componente y archivo en PascalCase; hooks propios en
  camelCase con prefijo `use`** (`useAuthProvider.js`, `useFaseDetalle.js`).
- **JSX y texto de UI en español**, nombres de variables/funciones también en
  español donde nombran conceptos del dominio (`proyecto`, `guardando`,
  `esEdicion`, `handleGuardar`). Términos técnicos de React quedan en inglés
  (`useState`, `useEffect`, `props`).
- **Un hook de datos por recurso**, definido en `hooks/queries.js` o en un
  hook dedicado (`useProveedores.js`), nunca `fetch`/`axios` suelto adentro
  de un componente de página.
- **Formularios de modal**: estado local con `useState`, `useEffect` para
  precargar en edición, `guardando` como flag de submit, `try/finally` para
  bajar el flag. Mirá `ModalProyecto.jsx` como referencia de la receta.
- **`prop-types` está deshabilitado** (`react/prop-types: 'off'' en
  `eslint.config.js`) — no hace falta declarar PropTypes en componentes
  nuevos, pero segui siendo explícito con los nombres de props.
- **Todo modal usa `useModal(onCerrar, deshabilitado)`** (Escape, foco
  atrapado, foco inicial, foco restaurado) y `<ModalShell>` o los shells de
  `Piezas*.jsx` — nunca un `<div>` de overlay hecho a mano. Ver DESIGN.md §11.
- **Nunca un `<h1>` suelto ni un input suelto**: título de página va con
  `<PageHeader>`, búsqueda con `<Buscador>`, lista vacía con `<EstadoVacio>`,
  error con `<EstadoError>`. Ver DESIGN.md §13–15.
- **Íconos: sólo `lucide-react`.** No SVGs sueltos, no otra librería.

---

## 4. Cómo manejar API calls

- **Un archivo en `services/` por recurso del backend** (`proyectoService.js`,
  `compraService.js`, ...), cada función mapea 1:1 a un endpoint y usa
  `axiosClient` (nunca `axios` importado directo, nunca `fetch`).
- **`axiosClient` (`src/api/axiosClient.js`) ya resuelve**: `withCredentials`
  para que viajen las cookies httpOnly de sesión, inyección de
  `X-CSRF-Token` en métodos mutantes desde el token guardado en memoria (no
  en `localStorage` — se pierde a propósito en cada reload), y redirect a
  `/login` en un 401 fuera de rutas públicas. **No reimplementes nada de
  esto en un componente o servicio nuevo.**
- **Lectura (`GET`) siempre vía React Query**: agregá el hook a
  `hooks/queries.js` (o a un hook dedicado si tiene lógica extra) y la key a
  `lib/queryKeys.js` — nunca una key armada a mano en el componente, porque
  rompe el dedupe entre pantallas que piden el mismo recurso.
- **Escritura (`POST`/`PUT`/`PATCH`/`DELETE`)**: función en el `service`
  correspondiente, invocada desde el componente (típicamente en el
  `handleSubmit` de un modal) con invalidación manual de queries afectadas,
  no `useMutation` centralizado — así se viene haciendo hasta ahora, seguí el
  patrón del recurso más parecido antes de inventar uno nuevo.
- **Un 422 con detalle del backend tiene que mostrar el motivo real al
  usuario**, no un mensaje genérico — es un bug que ya se corrigió una vez
  (alta de proveedor con CUIT/CUIL inválido); mirá `utils/errorHandling.js`.
- **Descargas de archivo** (ej. reporte PDF): el service pide
  `responseType: "blob"` y devuelve el blob crudo; el armado de la descarga
  (`URL.createObjectURL`, etc.) vive en quien llama, no en el service.

---

## 5. CSS — no hay Tailwind

El proyecto usa **CSS plano con un sistema de tokens propio**, documentado a
fondo en [`docs/DESIGN.md`](./DESIGN.md). Si vas a escribir o tocar CSS, leé
ese archivo primero — acá va sólo el resumen operativo:

- **Nunca un valor literal donde exista un token** (`font-size: 0.8rem`,
  `color: #6b7280`, `padding: 7px 13px` sueltos están prohibidos). Los
  tokens de color, tipografía, espaciado y radios están en `index.css` y
  documentados en DESIGN.md §2–4 y §7.
- **Un `.css` por componente**, importado desde su `.jsx`, mismo nombre de
  archivo. Selectores genéricos (`.modal-*`, utilidades como `.btn`,
  `.campo`, `.badge`, `.planilla`) viven sólo en `modal-base.css` o
  `index.css` — no los redeclares en el `.css` de un componente.
- **BEM en kebab-case** (`bloque__elemento--modificador`) para clases propias
  de un componente. Las utilidades globales (`.btn`, `.badge`, `.campo`,
  `.planilla`, `.label-ficha`, `.cifra`) son la excepción a propósito.
- **Si un componente compartido no encaja, agregás un modificador**
  (`.btn--sm`, `.campo--sm`, `.badge--sm`), nunca un bloque nuevo que
  redeclare la receta entera.
- **`!important` prohibido**, salvo la regla global de
  `prefers-reduced-motion`. Si necesitás ganarle a una utilidad por
  especificidad, usá doble clase (`.planilla.mi-tabla`), no `!important`.
- **Radio único** (`--radius-sm`, 6px) para todo excepto badges/chips
  (`--radius-pill`). **Sin sombras en contenido** — sólo en lo que flota
  (modal, popover, toast).
- **Color desde un dato** (estado de fase, tipo de movimiento) sale de
  `constants/colores.js` y se aplica inline — es el único lugar donde puede
  vivir un hex en JS.
- Antes de escribir CSS nuevo, revisá la tabla "Necesito… / Usá…" al
  principio de DESIGN.md — casi todo lo que vas a necesitar ya existe.

---

## 6. Responsive

Documentado en detalle en DESIGN.md §5. Resumen:

- **Tres breakpoints, no más:**
  - `max-width: 640px` — móvil: grillas a una columna, headers apilados,
    botones a ancho completo.
  - `max-width: 900px` — tablet: planillas pasan a scroll horizontal con
    columnas de ancho fijo, modales anchos pierden el riel.
  - `max-width: 768px` — **sólo el sidebar** (estructural: pasa de columna
    lateral a barra superior). Vive en `Sidebar.css` y `MainLayout.css`
    juntos, y tienen que moverse juntos si uno cambia.
- **No agregues un breakpoint nuevo.** Antes había once y se consolidaron en
  tres a propósito porque resolvían lo mismo de formas distintas.
- El sistema visual tiene que verse igual en las tres — si un componente se
  comporta distinto en móvil, la razón va comentada en el CSS.

---

## 7. Criterios de UI/UX

Ver DESIGN.md completo para el detalle (colores semánticos, estados de
carga/vacío/error, modales, tablas, navegación). Los criterios que más
importan al escribir código nuevo:

- **Regla principal del sistema**: si dos elementos cumplen la misma
  función, tienen que verse y comportarse igual.
- **Semáforo de color fijo**: verde = resuelto, naranja = en curso/atención,
  rojo = problema, gris = neutro/pendiente. No inventar otro mapeo por
  pantalla.
- **Un solo indicador de espera**: el isotipo de marca pulsando
  (`<LogoCargando>` inline en un control, `<Cargando>` en página/sección).
  No spinners genéricos nuevos.
- **Error ≠ vacío.** Un error usa `<EstadoError>` (rojo, `role="alert"`); un
  vacío usa `<EstadoVacio>` (isotipo a baja opacidad). Son situaciones
  opuestas, no se mezclan.
- **Accesibilidad de modal no es opcional**: `role="dialog"` +
  `aria-modal="true"` sólo si además hay foco atrapado (vía `useModal`) — no
  se declara uno sin el otro.
- **Botón de sólo ícono siempre con `aria-label`.** Ícono decorativo con
  `aria-hidden="true"`.
- **Acciones de fila siempre visibles**, no sólo en `:hover` (en touch no
  hay hover).

---

## 8. Qué NO modificar (o modificar con mucho cuidado)

- **Migraciones ya aplicadas** en `backend/alembic/versions/`. Una migración
  corrida en producción no se edita — se agrega una nueva. Revisar siempre a
  mano lo que genera `alembic revision --autogenerate` antes de aplicarlo
  (no detecta todo: algunos `CHECK`, renombres de columna).
- **`frontend/src/api/axiosClient.js`**: la lógica de CSRF en memoria (no
  `localStorage`), el manejo del 401 y `RUTAS_PUBLICAS` tienen comentarios
  que explican bugs reales ya resueltos (loop infinito de redirect, CSRF
  invisible cross-domain). No "simplificar" sin releer los comentarios.
- **`backend/app/security_middleware.py`, CSP en `frontend/vercel.json`,
  cookies en `backend/app/routes/login.py`**: relacionados al fix de sesión
  cross-site en Safari/iPhone (dominio propio homesolutions.company /
  api.homesolutions.company). Tocar esto sin entender el fix completo puede
  romper el login en iOS de nuevo.
- **Credenciales y `.env`** (`backend/.env`, `frontend/.env`, y los
  `.env.bak*`/`.env.tmp` que quedaron en backend): nunca commitear, nunca
  imprimir su contenido. El token de R2 hoy tiene permiso "All buckets" sin
  restringir — pendiente, no lo des por resuelto.
- **`docs/DESIGN.md` y los tokens de `index.css`**: no se agregan colores,
  tamaños de fuente, espaciados o radios nuevos por fuera de la escala sin
  actualizar ese documento a la vez. Es la fuente de verdad del sistema
  visual.
- **`frontend/dist/`**: build generado, no se edita a mano.
- **Carpeta `uploads/` del backend** (comprobantes subidos, dev): son datos
  reales de clientes/proveedores, no van al repo (ya está en `.gitignore`).

---

## 9. Comandos

### Backend

```bash
cd backend
source .venv/bin/activate
uvicorn app.main:app --reload      # http://localhost:8000 (docs en /docs)
pytest                              # tests (usa una DB de test aparte, se crea sola)
alembic upgrade head                # aplicar migraciones pendientes
alembic revision --autogenerate -m "descripción corta"
black app tests && isort app tests  # formato (no bloqueante en CI todavía)
```

### Frontend

```bash
cd frontend
npm run dev          # http://localhost:5173
npm run test         # vitest, una corrida
npm run test:watch   # vitest, modo watch
npm run lint
npm run format        # prettier --write src
npm run build
```

`VITE_API_URL` (en `frontend/.env`) tiene que apuntar al backend local
(`http://localhost:8000` por default).

---

## 10. Git / commits

- **Mensajes de commit en español**, en imperativo/infinitivo, describiendo
  qué cambia y a veces por qué en el cuerpo. El repo mezcla dos estilos —
  ambos válidos, preferí el primero para cambios claramente clasificables:
  - Con prefijo tipo Conventional Commits: `feat:`, `fix:`, `docs:`,
    `chore:`, `revert:` — ej. `fix: mostrar el motivo real de un 422 al
    guardar un proveedor`.
  - Sin prefijo, frase directa en español — ej. `Ajustar cookies y CSP para
    dominio propio (homesolutions.company)`.
- **Un commit por cambio lógico**, no mezclar refactors grandes con fixes
  puntuales en el mismo commit.
- **CI corre por `paths:`**: un cambio sólo en `frontend/` no dispara el
  workflow de backend y viceversa — si tocás algo que cruza ambos (ej. un
  contrato de API), verificá que los dos jobs relevantes corran.
- **No commitear con tests rojos.** `pytest` y `npm run test` tienen que
  pasar antes de abrir PR; `black`/`isort` son no bloqueantes por ahora pero
  conviene correrlos.
- **No usar `git push --force` a `main`**, no reescribir historia compartida.

---

## 11. Criterios para componentes reutilizables

- **Va a `components/shared/` sólo si de verdad se usa en más de un área**
  (hoy: `PageHeader`, `Buscador`, `Tabs`, `Breadcrumbs`, `EstadoVacio`,
  `EstadoError`, `Cargando`, `LogoCargando`, `ToastStack`, etc.). Si es
  específico de un área, va en `components/<área>/` aunque parezca
  reutilizable a futuro — no se generaliza antes de tener un segundo uso
  real.
- **No hay un `<Card>` genérico, y es a propósito**: las distintas cards de
  la app comparten la *receta* CSS (superficie, borde, radio, padding) pero
  tienen contenidos y densidades genuinamente distintas. Un componente único
  terminaría con muchas props de layout y sería peor que CSS compartido. Lo
  que se comparte es la receta visual (DESIGN.md §10), no la estructura del
  componente.
- **Antes de crear un componente nuevo para algo que "se parece" a otro ya
  existente**, primero mirá si alcanza con un modificador CSS
  (`--sm`, `--error`, etc.) sobre el existente. La duplicación de recetas
  parecidas-pero-no-iguales es exactamente lo que el rediseño de agosto 2026
  vino a limpiar.
- **Componentes de estado** (carga, vacío, error) son siempre los mismos
  cuatro (`Cargando`, `LogoCargando`, `EstadoVacio`, `EstadoError`) — no se
  crea una variante nueva por pantalla.
- **Un hook reutilizable va a `hooks/`** sólo si la lógica de estado se
  repite o es candidata clara a reutilizarse (ej. `useModal`,
  `useAuthProvider`); lógica de estado específica de una sola pantalla se
  queda en el componente de esa pantalla.

---

## Notas para Claude Code / Cowork en este proyecto

- Este archivo vive en `docs/CLAUDE.md` (no en la raíz) a pedido de Fede —
  es contexto de trabajo, no documentación de producto.
- Hay memoria de proyecto persistente con decisiones y pendientes de
  sesiones anteriores (moneda de precio acordado, scope del token R2, fix de
  login cross-site, etc.) — consultarla antes de asumir que algo no se
  evaluó todavía.
- El repo tiene además `docs/DESIGN.md` (sistema visual, fuente de verdad),
  `docs/PLAN_MANAGER.md` (roadmap del panel Manager) y
  `docs/BRIEF_COMERCIALIZACION.md` (evaluación de productizar la app para
  otros clientes).
