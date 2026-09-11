# Brief — HomeSolutions como producto base comercializable

Fecha: 2026-08-22. Este documento es el contexto de arranque para el proyecto
de Claude que va a ayudar a convertir HomeSolutions en un producto
reutilizable, moldeable y personalizable por cliente. No define una decisión
final de arquitectura — deja planteadas las preguntas y una recomendación
inicial para discutir con Fede antes de tocar código.

## 1. Qué es HomeSolutions hoy

App de gestión financiera de proyectos (construcción/obra), en producción
para un solo cliente real, con deploy exitoso:

- **Backend**: FastAPI + SQLAlchemy + PostgreSQL (Railway), Alembic para
  migraciones, tests con pytest, CI en GitHub Actions.
- **Frontend**: React + Vite (Vercel).
- **Auth**: JWT en cookies httpOnly (access 60 min + refresh 7 días) + CSRF
  token + rate limiting (slowapi) + security headers. Roles: admin y una
  cuenta especial "Manager" (superadmin del sistema, sin recuperación por
  diseño).
- **Dominio**: Proyecto → Fases → movimientos financieros (Compras a
  proveedores, Gastos, Cobros) → cuenta corriente con notas de
  crédito/débito. Catálogo de Proveedores/Productos. Reportes financieros en
  PDF por proyecto.
- **IA (Gemini)**: lectura automática de comprobantes (autocompletar
  Gasto/Compra/Cobro desde una foto/PDF) y "Importar catálogo" (carga masiva
  de precios de proveedor desde Excel/CSV/foto/PDF).
- **Storage**: comprobantes en Cloudflare R2 (o disco local en dev).
- **Auditoría**: hoy solo `logging`, no persistida en tabla todavía (ver
  `docs/PLAN_MANAGER.md`, es la feature #1 del roadmap de la cuenta Manager).

Repo: FastAPI + PostgreSQL + React, como dice la descripción corta del
proyecto. Archivos clave para que el otro Claude se ubique rápido:
`README.md` (arranque y estructura), `docs/DESIGN.md` (sistema de diseño y
por qué), `docs/PLAN_MANAGER.md` (roadmap de administración propia),
`backend/app/db/models.py` (modelo de datos completo), `backend/app/routes/`
(un router por recurso), `backend/.env.example` (toda la config
parametrizable hoy), `frontend/src/index.css` (tokens de diseño).

## 2. Objetivo de este proyecto

No es "vender HomeSolutions tal cual". Es identificar qué parte de lo que ya
se construyó es un **núcleo genérico** aprovechable por cualquier negocio que
gestione proyectos/trabajos con movimientos financieros asociados, y qué
parte es **específica del pedido real de HomeSolutions/Agus** — sin borrar lo
específico, sino dejarlo catalogado como feature opcional por si otro
cliente lo pide.

La idea de Fede: la versión base puede no traer "fases" ni "cobro en
dólares" ni "notas de crédito" activadas de entrada, pero el sistema tiene
que poder incorporarlas sin reescribir todo, porque son pedidos reales que ya
aparecieron una vez (van a volver a aparecer).

## 3. Núcleo genérico (probablemente reusable para cualquier cliente)

- **Todo el bloque de seguridad**: JWT + refresh + CSRF + rate limiting +
  security headers + hashing de passwords. No tiene nada específico de
  HomeSolutions, se lleva prácticamente as-is.
- **La forma del modelo de datos**: una entidad contenedora ("proyecto") con
  movimientos financieros tipados (compra/gasto/cobro) que arman una cuenta
  corriente con saldo. Esa forma sirve para cualquier negocio basado en
  proyectos/trabajos/obras, más allá del rubro.
- **El motor de reportes PDF**: genera un reporte financiero a partir de
  datos, con logo y colores como assets separados (`reportes/assets/marca/`)
  — ya está separado del código, falta parametrizarlo por cliente en vez de
  hardcodear un solo set de assets.
- **El motor de IA de lectura de comprobantes y catálogos** (Gemini): la
  lógica de "leer un documento y proponer datos estructurados, sin inventar
  ids" es genérica. Lo específico es *qué* estructura de datos le pide a la
  IA (categoría de producto, tipo de movimiento) según el rubro del cliente.
- **El sistema de diseño**: la arquitectura de tokens CSS (`index.css`,
  `DESIGN.md`) está bien pensada y es reusable como *arquitectura* — pero
  hoy los valores de esos tokens (paleta, tipografía "Public Sans", nombres
  como `--color-terracota`) salen 1:1 del manual de marca de HomeSolutions.
  Es lo primero que hay que poder tematizar por cliente.
- **El patrón de configuración migrando de `.env` a tabla** (roles ya se
  migraron; `GEMINI_MODEL` va para el mismo camino según `PLAN_MANAGER.md`):
  es el mecanismo correcto para que cada cliente ajuste comportamiento sin
  tocar código ni redeployar.

## 4. Específico de HomeSolutions (features verticales — no asumir en la base, pero tenerlas listas)

- **Fases de proyecto/obra**: pensado para negocios con etapas de
  ejecución (obra, instalación). Un cliente de servicios puntuales no lo
  necesita.
- **Notas de crédito/débito en la cuenta corriente**: típico de relaciones
  comerciales largas con ajustes posteriores al cobro/pago. No todo negocio
  las usa.
- **Cobro en dólares**: hoy `precio_acordado` no distingue moneda del gasto
  en ARS (deuda conocida, ver memoria del proyecto). Es una necesidad
  puntual de contextos con inflación/cobertura cambiaria — no asumir que
  todo cliente la quiere, pero si se generaliza, conviene resolver primero
  ese problema de moneda mixta en vez de heredarlo a la base.
- **Catálogo de Proveedores/Productos con precio**: útil para negocios que
  compran materiales (como HomeSolutions). Un negocio 100% de servicios sin
  insumos no lo necesita.
- **Terminología e idioma**: español rioplatense, moneda ARS por defecto.
  Si el producto se ofrece fuera de Argentina, esto también hay que
  parametrizarlo.
- **Roles actuales (admin + Manager único, sin recuperación)**: diseñado
  para un equipo chico y conocido (2-3 personas). No está pensado para
  organizaciones grandes ni multi-sucursal.

## 5. Deuda técnica a resolver antes de tener más de un cliente

- **Token de R2 con permiso "All buckets"**: aceptable para 1 cliente
  interno, no para vender a terceros — cada cliente nuevo va a necesitar su
  propio bucket y su propio token *scopeado a ese bucket únicamente*. Hay
  que resolverlo antes del segundo cliente, no después.
- **Auditoría no persistida**: sin tabla de auditoría, no hay rastro de
  acciones sensibles (purgas, backups, impersonar) — más importante todavía
  cuando el que administra el sistema de un cliente no es Fede.
- **Sin tabla de sesiones activas**: no se puede revocar la sesión de un
  usuario ni ver quién está conectado — relevante en cuanto haya soporte a
  terceros.
- **CI corre pero falta confirmar branch protection**: importante si el
  "core" se comparte entre clientes — un test roto no debería poder
  mergearse a main y afectar a todos.
- **Reconciliación de archivos huérfanos en R2**: falta red de seguridad
  para uploads que fallan a mitad de camino.

(Detalle completo de estos puntos en la memoria del proyecto y en
`docs/PLAN_MANAGER.md`.)

## 6. La pregunta de arquitectura (con mi recomendación)

La decisión más grande es cómo se sirve el producto a varios clientes.
Fede todavía no la tomó — quedan planteadas las dos opciones:

**A. Template por cliente** (mismo repo/core, un deploy independiente por
cliente: su propio Railway + Postgres + Vercel + bucket R2).
**B. SaaS multi-tenant real** (una sola instancia para todos, `tenant_id` en
cada tabla y cada query).

**Mi recomendación: empezar por A.** Tres razones concretas:

1. Con un solo cliente real todavía no hay evidencia de qué features son
   realmente "core" — forzar un modelo multi-tenant ahora es optimizar para
   una demanda que todavía no está probada.
2. Es una app financiera que guarda comprobantes de plata de terceros. El
   modo de falla de un multi-tenant mal filtrado (un `WHERE` sin
   `tenant_id`) es que un cliente vea datos de otro — un riesgo serio para
   invertir tiempo en evitarlo bien recién cuando haya volumen que lo
   justifique.
3. El costo operativo de un deploy más por cliente (Railway+Vercel+Postgres+R2)
   es bajo a la escala de los primeros clientes, y da una funcionalidad que
   el modelo B no da gratis: aislamiento total de datos, que es un buen
   argumento de venta ("tus datos viven en tu propia base, no compartida").

La migración a B queda como decisión para más adelante, cuando el costo
operativo de mantener N deploys separados empiece a doler de verdad (una
señal razonable: 5-10 clientes activos) — no antes.

Con la opción A, el trabajo concreto es: extraer branding/tema a config (no
a CSS hardcodeado), confirmar que no queden strings de "HomeSolutions"
enterrados en el backend, y tratar cada feature vertical (fases, notas de
crédito, multi-moneda, catálogo de productos) como un módulo que se puede
activar/desactivar por cliente en vez de borrarlo del core — así, cuando un
segundo cliente pida "fases", ya existe en el core y se activa, no se
reimplementa.

## 7. Preguntas abiertas para trabajar con el otro proyecto

- ¿Qué se resuelve con config (.env o tabla, como ya se hizo con roles) y
  qué necesita tocar código (tema visual, terminología)?
- ¿La terminología interna del modelo ("proyecto", "fase", "compra") queda
  fija en el código y solo se traduce la etiqueta visible por cliente, o el
  modelo mismo se vuelve más genérico?
- ¿Cómo se versiona el core para que una mejora pedida por un cliente pueda
  ofrecerse a los demás sin volverse específica de nadie?
- Modelo de negocio y precio: queda fuera de este brief (es una decisión de
  Fede, no técnica) — pero vale tenerlo en mente porque afecta si conviene
  invertir en onboarding self-service o si el modelo sigue siendo
  "implementación asistida por Fede para cada cliente nuevo".

## 8. Para pegar en las instrucciones cortas del proyecto (opcional)

> Producto base para comercializar, derivado de la web que le hicimos a
> HomeSolutions (FastAPI + PostgreSQL + React, ya en producción). El
> objetivo no es clonar HomeSolutions: es separar qué parte del sistema es
> un núcleo genérico de gestión de proyectos con movimientos financieros
> (reusable para cualquier cliente) de qué parte es específica del pedido
> real de HomeSolutions (fases de obra, notas de crédito, cobro en dólares,
> catálogo de productos con proveedores) — features que no van necesariamente
> en la base, pero que hay que poder activar sin reescribir el sistema
> porque son pedidos reales que van a volver a aparecer. Ver
> `docs/BRIEF_COMERCIALIZACION.md` en el repo para el detalle completo:
> qué es reusable, qué es específico, deuda técnica pendiente antes de tener
> más de un cliente, y la pregunta de arquitectura (template por cliente vs.
> SaaS multi-tenant) todavía sin resolver.
