# Plan de Acción — HomeSolutions
Basado en: Reporte de Auditoría Integral, Agosto 2026

Separado en dos tracks (Backend / Frontend) para poder trabajarlos en paralelo con agentes distintos. Cada ítem referencia su código del reporte original.

**Estado (2026-08-13):** Fase 1 y Fase 2 cerradas en ambos tracks, mergeadas a `main`, verificadas con tests + build + prueba manual en local. Push a GitHub hecho (`main` @ `84dd580`).

---

## BACKEND

### Fase 1 — Crítico ✅ COMPLETADA
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 1 | ✅ Índices en FKs (fase_id, proyecto_id, proveedor_id, usuario_id) vía migración Alembic | B-03 | BAJA | ALTO |
| 2 | ✅ `GET /health` con `SELECT 1` a la DB | B-09 | BAJA | MEDIO |
| 3 | ✅ Verificado default de `GEMINI_MODEL` (era válido, se dejó igual con comentario de verificación) | B-10 | BAJA | MEDIO |
| 4 | ✅ Logging de auditoría en create/update/delete de proyectos, compras, cobros | B-13 | BAJA | ALTO |
| 5 | ✅ GitHub Actions: correr `pytest` en cada push/PR | D-02 (parte backend) | BAJA | ALTO |

### Fase 2 — Primer mes ✅ COMPLETADA
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 6 | ✅ Rate limiting en creación y upload (compras/gastos/cobros, incl. notas) | B-07 | BAJA | MEDIO |
| 7 | ✅ Tests de integración: proyectos, compras, gastos, cobros, cascade en `DELETE /proyectos/{id}` | T-01 | MEDIA | ALTO |
| 8 | ✅ Sacar el JWT del body de `/auth/login` (solo cookie httpOnly) | B-05 | BAJA | BAJO |
| 9 | ✅ Validar CUIT (formato + dígito verificador AFIP), extendido también a `ProveedorUpdate` | B-08 | BAJA | BAJO |
| 10 | ✅ Leer solo 8 bytes para validar firma de archivo + streaming al destino | B-15 | MEDIA | MEDIO |
| 11 | ✅ Verificación explícita `nota.proveedor_id == compra.proveedor_id` | B-14 | BAJA | BAJO |

### Fase 3 — Mediano plazo (pendiente)
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 12 | Mover usuarios autorizados hardcodeados a DB o env JSON | B-11 | MEDIA | MEDIO |
| 13 | Refresh token + blacklist de JWT (la reducción de expiración 120→60 min **ya se hizo** en Fase 1 como quick win) | B-06 | MEDIA | MEDIO |
| 14 | Reemplazar `lru_cache` del cliente R2 por singleton reinicializable | B-12 | BAJA | BAJO |
| 15 | Documentar/testear invariante de `precio_total` con eager-loading | B-04 | MEDIA | MEDIO |

### Fase 4 — Escalabilidad (cuando el volumen lo justifique)
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 16 | Paginación en endpoints de lista (`limit`/`offset`) + endpoint de resumen agregado para Dashboard | B-01 | MEDIA | ALTO |
| 17 | Docker + docker-compose para desarrollo local | D-01 | MEDIA | ALTO |
| 18 | README de setup en la raíz | D-03 | BAJA | MEDIO |
| 19 | Black + isort en backend | D-04 (parte backend) | BAJA | MEDIO |
| 20 | Migración a `AsyncSession`/`asyncpg` | B-02 | ALTA | MEDIO (solo con 10+ usuarios concurrentes) |

---

## FRONTEND

### Fase 1 — Crítico ✅ COMPLETADA
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 1 | ✅ Estado de error explícito en `ProyectoDetalle.jsx`, con `EstadoError.jsx` dedicado (sin isotipo, respeta la convención de `EstadoVacio`) | F-07 | BAJA | ALTO |
| 2 | ✅ Error Boundary global en `App.jsx` | F-05 | BAJA | ALTO |
| 3 | ✅ Modal de confirmación en todos los borrados (proyectos, fases, compras, gastos, cobros, proveedores, y productos del catálogo — este último no estaba en el alcance original) | F-08 | BAJA | ALTO |
| 4 | ✅ Breadcrumbs en `ProyectoDetalle` y `FaseDetalle` | U-02 | BAJA | ALTO |
| 5 | ✅ GitHub Actions: correr `vitest run` + build en cada push/PR | D-02 (parte frontend) | BAJA | ALTO |

### Fase 2 — Primer mes ✅ COMPLETADA
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 6 | ✅ Adoptado TanStack Query + refactor de `FaseDetalle`, `Acciones`, `Fases`, `AnalisisGeneral`, `Seguimiento`, `Dashboard` en hooks compartidos con query keys centralizadas — fusiona F-01, F-02 y F-03 en una sola pasada (ver nota más abajo) | F-01 / F-02 / F-03 | MEDIA-ALTA | ALTO |
| 7 | ✅ Centralizar colores hardcodeados en `src/constants/colores.js` | F-06 | BAJA | MEDIO |
| 8 | ✅ Unit tests para `calcularAnalisis()`, `calcularPanel()`, `filtrarCompras()`, `filtrarGastos()` (46 tests nuevos) | T-02 | BAJA | ALTO |
| 9 | ✅ Íconos de Lucide en el sidebar | U-01 | BAJA | MEDIO |

Verificado en browser (no solo tests): navegar entre pestañas de un proyecto no dispara fetches duplicados; cache compartido confirmado con Network tab.

### Fase 3 — UI/UX (pendiente)
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 10 | Validación en tiempo real en formularios (modales de compra/gasto/cobro) | U-06 | MEDIA | ALTO |
| 11 | ~~Sidebar colapsable en mobile~~ — descartado: confirmado con Fede (2026-08-13) que la app es web-only, sin uso desde celular en obra por ahora | U-04 | — | — |
| 12 | Tokens de escala tipográfica en `index.css` | U-03 | BAJA | MEDIO |
| 13 | Loading skeleton en Dashboard en vez de spinner monolítico | U-05 | MEDIA | MEDIO |
| 14 | Login: cambiar dropdown de usuarios por input de texto libre | F-09 | BAJA | MEDIO |
| 15 | Verificar estado "guardando" consistente en todos los modales | U-07 | BAJA | MEDIO |

### Fase 4 — Arquitectura (pendiente)
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 16 | Lazy loading de rutas (`React.lazy` + `Suspense`), especialmente Recharts — relevante ahora: el build ya avisa que el bundle supera 500KB | F-04 | BAJA | MEDIO |
| 17 | Consistencia de CSS (BEM documentado o migrar a CSS Modules) | F-10 | ALTA | MEDIO |
| 18 | Prettier + lint-staged en frontend | D-04 (parte frontend) | BAJA | MEDIO |

---

## Housekeeping (surgió durante la ejecución, no estaba en la auditoría original)
- Revisar `npm audit` en frontend (6 vulnerabilidades: 1 moderate, 5 high) — pendiente de evaluar si son directas o transitivas.

---

## Fase 5 — Evolución del producto (después de estabilizar)
Notificaciones automáticas · Búsqueda global (Cmd+K) · Exportación a Excel · Vista Gantt de fases · PWA con cámara para comprobantes · Refresh tokens/blacklist (B-06 completo) · AsyncSession (si el volumen lo justifica) · Integración AFIP.

---

## Seguridad — ya está bien, no tocar
Cookies httpOnly, CSRF double-cookie, magic bytes en uploads, CORS sin wildcards, `requiere_admin` en mutaciones, `SECRET_KEY` validado, orden de middlewares, errores genéricos sin stack trace, `sslmode=require`, roles server-side, `usuario_id` desde JWT.
