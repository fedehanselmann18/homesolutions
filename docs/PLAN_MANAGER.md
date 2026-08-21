# Plan de acción — Funcionalidades futuras para "Manager"

Brainstorm del 21/08/2026, después de cerrar la consistencia visual del
frontend. Objetivo: identificar qué le falta a la cuenta "Manager" (ver
`requiere_manager` en `backend/app/auth/oAuth2.py`, componentes en
`frontend/src/components/manager/`) para que Fede deje de necesitar acceso
directo a Railway/Postgres/Cloudflare una vez que la app esté en uso
funcional total. No es para implementar ahora — es la lista ordenada para
cuando llegue el momento.

Hoy Manager ya cubre: autorizar/revocar quién se puede registrar
(`usuarios_autorizados`), resetear contraseña, cambiar rol, cerrar sesión de
alguien y activar/desactivar cuentas — todo en `backend/app/routes/usuarios.py`.
Lo que sigue es la otra mitad: todo lo que hoy solo se puede hacer con acceso
directo a la infraestructura.

---

## Orden sugerido

1. ~~Auditoría persistida~~ (base para justificar y loguear todo lo demás) — HECHO
2. ~~Panel de configuración del sistema~~ — HECHO
3. Reconciliación de archivos huérfanos en R2
4. Sesiones activas
5. Backup / export on-demand
6. "Ver como" (impersonar usuario) — al final, alcance acotado a solo lectura

---

## 1. Auditoría persistida — HECHO (21/08/2026)

Implementado tal cual el alcance de abajo: tabla `auditoria` (migración
`c8a1f6d20b45`), `log_auditoria` escribiendo a la base además del logger,
`GET /auditoria` paginado con filtros y sección "Historial" en la página de
Manager. Dos detalles que se decidieron al hacerlo y no estaban en el plan:

- `recurso_id` es `String` sin foreign key. La mitad de las filas registran un
  borrado, así que apuntan a un recurso que ya no existe: con FK, justo el
  caso más importante de auditar sería imposible de insertar.
- La auditoría se escribe SIEMPRE después del commit de la acción, en su
  propio commit y con `try/except`. Así una acción exitosa nunca falla por un
  problema al auditarla, y una acción que falló nunca queda registrada como si
  hubiera pasado. El logger se mantiene como red de seguridad, como decía el
  plan.

Sigue pendiente de decidir (no bloquea nada): retención y export a CSV.

**Qué resuelve:** `app/audit.py` (`log_auditoria`) y `_log_accion_manager` en
`usuarios.py` solo escriben a `logging` — para revisar qué pasó hay que ir a
los logs del server (Railway). No queda nada consultable desde la app.

**Alcance propuesto:**
- Tabla nueva `auditoria` (migración Alembic): `usuario_id`, `accion`,
  `tipo_recurso`, `recurso_id`, `detalle` (jsonb opcional), `creado_en`.
- `log_auditoria` y `_log_accion_manager` escriben ahí además del logger (no
  reemplazar el logger, es la red de seguridad si la DB falla).
- Endpoint `GET /auditoria` (`requiere_manager`), paginado, con filtros por
  tipo de recurso / usuario / rango de fechas.
- Pestaña nueva en Manager (`components/manager/`) listando esas acciones.

**Decisiones pendientes:** cuánto tiempo retener, si hace falta exportar a
CSV.

**Prioridad:** Alta. Sin esto, ninguna de las acciones más sensibles de abajo
(purgar R2, generar backups, impersonar usuarios) queda con rastro dentro de
la app.

---

## 2. Panel de configuración del sistema — HECHO (21/08/2026)

Implementado como piloto de una sola clave, tal como decían las decisiones
pendientes de abajo: tabla `configuracion` (migración `e1d94a2c7f83`),
`app/configuracion.py` con `CLAVES_CONFIGURABLES` (hoy solo `GEMINI_MODEL`)
y fallback a `Settings`/`.env` cuando no hay fila, `GET/PATCH/DELETE
/configuracion` (`requiere_manager`, DELETE restaura al valor del `.env`) y
`GET /configuracion/estado-integraciones` (R2/Gemini, solo lectura). Página
"Configuración" nueva en el sidebar de Manager.

`SECRET_KEY` y las credenciales de DB/R2 NO se migraron, como decía la
decisión pendiente. Rate limiting tampoco se tocó (quedó fuera de este
piloto, no era el foco). Editar/restaurar quedan en la auditoría del punto 1
(`tipo_recurso="Configuracion"`).

Sumar una clave nueva a futuro es una entrada en `CLAVES_CONFIGURABLES` --
el endpoint y el front ya son genéricos, no hace falta tocar rutas.

**Qué resuelve:** mismo problema que resolvió B-11 (ver
`proyecto_moneda_precio_acordado` y el comentario de `config.py` sobre
`ROLES_PERMITIDOS_JSON`): variables como `GEMINI_MODEL` viven en `.env` y
cambiarlas exige editar el archivo y redeployar. El propio comentario en
`config.py` dice que Google renombra el modelo "seguido".

**Alcance propuesto:**
- Tabla `configuracion` clave/valor (o columnas específicas si son pocas).
- `Settings` (en `config.py`) lee primero de esa tabla, con fallback al
  `.env` si no hay fila — mismo patrón que ya se usó para migrar la
  whitelist de roles.
- Endpoint `GET/PATCH /configuracion` (`requiere_manager`).
- Pestaña "Configuración" en Manager: estado de R2 (reusa la property
  `r2_configurado` que ya existe), estado de Gemini, modelo de IA actual
  editable, límites de rate limiting si hace falta tocarlos sin redeploy.

**Decisiones pendientes:** qué variables migrar primero (arrancar por
`GEMINI_MODEL` como piloto) y cuáles quedan siempre en `.env` por seguridad
(`SECRET_KEY`, credenciales de DB y R2 no deberían pasar nunca por acá).

**Prioridad:** Alta — esfuerzo bajo, sigue un patrón ya probado en el
proyecto.

---

## 3. Reconciliación de archivos huérfanos en R2

**Qué resuelve:** ojo, esto ya está mejor cubierto de lo que parecía —
`eliminar_comprobante` (`app/files/storage.py`) se llama explícitamente antes
de cada `CASCADE` en `proyectos.py`, `compras.py`, `gastos.py`, `cobros.py` y
`fases.py`, y también en cada delete individual de comprobante/nota. El
problema no es que falte el borrado a propósito: es que no hay red de
seguridad para lo que ese borrado explícito no puede cubrir — un upload que
llega a R2 pero falla el commit de la fila en DB, un request interrumpido a
mitad de camino, o un bug futuro en algún endpoint nuevo que suba sin
registrar.

**Alcance propuesto:**
- Endpoint/acción en Manager que liste los objetos del bucket (`list_objects`
  contra R2) y los compare contra todas las filas con `archivo_path` en las
  tablas de comprobantes y notas.
- Mostrar los huérfanos encontrados (archivo en R2 sin fila) y dejarlos
  purgar con confirmación explícita.
- Registrar la purga en la auditoría (punto 1).
- Bonus: detectar también el caso inverso — fila con `archivo_path` que ya
  no existe en R2 (comprobante roto).

**Decisiones pendientes:** correr on-demand (botón) vs. job periódico que
solo notifique sin borrar solo.

**Prioridad:** Media-alta.

---

## 4. Sesiones activas

**Qué resuelve:** Manager puede cortar la sesión de alguien (`POST
/usuarios/{id}/cerrar-sesion`) pero a ciegas — no ve quién está logueado
ahora ni desde cuándo.

**Alcance propuesto:** hoy no hay tabla de sesiones (los JWT se validan sin
estado contra `fecha_actualizacion`, ver B-06 / `resolver_usuario_vigente`
en `auth/oAuth2.py`), así que esto pide agregar algún tracking mínimo.
Arrancar liviano: una columna `ultima_actividad` en `Usuario`, actualizada en
`get_current_user` con throttle (no en cada request, cada X minutos alcanza)
antes de pasar a una tabla completa de sesiones con IP/user-agent.

**Decisiones pendientes:** alcance mínimo ("visto por última vez") vs.
completo (listado de sesiones con IP/dispositivo, revocar una sola en vez de
todas).

**Prioridad:** Media.

---

## 5. Backup / export on-demand

**Qué resuelve:** hoy un respaldo de la base es un `pg_dump` manual desde
Railway CLI o el dashboard.

**Alcance propuesto:** endpoint (`requiere_manager`) que dispare un dump o,
más liviano, un export a Excel/CSV de las tablas de negocio principales.
Ojo con el tiempo de un request HTTP normal para un dump completo — puede
necesitar generarse async y ofrecer la descarga después.

**Decisiones pendientes:** dump completo de Postgres (sirve para restore
real) vs. export de datos de negocio (más liviano, útil para revisar, no
sirve como backup técnico); antes de invertir acá conviene confirmar qué
backups automáticos ya incluye el plan de Railway — el valor de esto es
comodidad, no la ausencia total de respaldo.

**Prioridad:** Media.

---

## 6. "Ver como" (impersonar usuario)

**Qué resuelve:** diagnosticar un problema que reporta alguien del equipo sin
pedirle usuario y contraseña ni tocar la DB para ver qué le aparece.

**Alcance propuesto:** endpoint (`requiere_manager`) que emite un token para
otro usuario, marcado explícitamente (ej. claim `impersonado_por` en el JWT)
para que quede clarísimo tanto en la UI (banner fijo "Estás viendo como
Agus — Volver a Manager") como en la auditoría (punto 1) que la sesión no es
genuina.

**Decisiones pendientes:** cuánto puede hacer Manager mientras impersona.
Para la primera versión, arrancar en **solo lectura** — minimiza el riesgo
de una acción hecha "como si fuera" otra persona.

**Prioridad:** Baja. Es la más sensible en términos de seguridad de toda la
lista — dejarla para el final, con el alcance acotado de arriba.

---

## Excluido a propósito

- **Correr migraciones de Alembic desde la UI.** Se mantiene como comando de
  consola siempre: es la única acción de esta lista donde un botón mal
  apretado en producción puede romper la base. Ahí "tener que abrir la
  terminal" es una protección, no una molestia a resolver.
- **Recuperación de la cuenta "Manager" sin acceso a la DB.** Sigue siendo
  manual por diseño: nadie puede resetearle la contraseña a "Manager" porque
  `requiere_manager` es la propia cuenta (ver comentario de
  `_buscar_usuario_ajeno` en `usuarios.py`). Si en algún momento se quiere
  mitigar, la opción más simple sería un código de emergencia generado una
  sola vez al crear la cuenta y guardado fuera de la app — pero no es algo
  para meter en el mismo sprint que el resto de este plan.
