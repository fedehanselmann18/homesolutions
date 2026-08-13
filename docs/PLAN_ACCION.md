# Plan de Acción — HomeSolutions
Basado en: Reporte de Auditoría Integral, Agosto 2026

Separado en dos tracks (Backend / Frontend) para poder trabajarlos en paralelo con agentes distintos. Cada ítem referencia su código del reporte original.

---

## BACKEND

### Fase 1 — Crítico (ahora)
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 1 | Índices en FKs (fase_id, proyecto_id, proveedor_id, usuario_id) vía migración Alembic | B-03 | BAJA | ALTO |
| 2 | `GET /health` con `SELECT 1` a la DB | B-09 | BAJA | MEDIO |
| 3 | Corregir default de `GEMINI_MODEL` | B-10 | BAJA | MEDIO |
| 4 | Logging de auditoría en create/update/delete de proyectos, compras, cobros | B-13 | BAJA | ALTO |
| 5 | GitHub Actions: correr `pytest` en cada push/PR | D-02 (parte backend) | BAJA | ALTO |

### Fase 2 — Primer mes
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 6 | Rate limiting en endpoints de mutación y upload (`/compras/crear`, `/gastos/crear`, `/cobros/crear`, uploads) | B-07 | BAJA | MEDIO |
| 7 | Tests de integración: `routes/compras.py`, `routes/gastos.py`, `routes/cobros.py`, cascade en `DELETE /proyectos/{id}` | T-01 | MEDIA | ALTO |
| 8 | Sacar el JWT del body de `/auth/login` (dejar solo cookie httpOnly) | B-05 | BAJA | BAJO |
| 9 | Validar CUIT de proveedor con `field_validator` | B-08 | BAJA | BAJO |
| 10 | Leer solo bytes necesarios para validar firma de archivo (no cargar 10MB completos) | B-15 | MEDIA | MEDIO |
| 11 | Verificación explícita `nota.proveedor_id == compra.proveedor_id` | B-14 | BAJA | BAJO |

### Fase 3 — Mediano plazo
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 12 | Mover usuarios autorizados hardcodeados a DB o env JSON | B-11 | MEDIA | MEDIO |
| 13 | Reducir expiración JWT a 30-60 min + refresh token | B-06 | MEDIA | MEDIO |
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

### Fase 1 — Crítico (ahora)
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 1 | Estado de error explícito en `ProyectoDetalle.jsx` (evitar spinner infinito) | F-07 | BAJA | ALTO |
| 2 | Error Boundary global en `App.jsx` | F-05 | BAJA | ALTO |
| 3 | Modal de confirmación para acciones destructivas (borrar proyecto/compra/gasto/cobro) | F-08 | BAJA | ALTO |
| 4 | Breadcrumbs en `ProyectoDetalle` y `FaseDetalle` | U-02 | BAJA | ALTO |
| 5 | GitHub Actions: correr `vitest run` en cada push/PR | D-02 (parte frontend) | BAJA | ALTO |

### Fase 2 — Primer mes
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 6 | Elevar fetching a `ProyectoDetalle` y pasar datos como props (eliminar over-fetching entre pestañas) | F-01 | MEDIA | ALTO |
| 7 | Separar `FaseDetalle.jsx` y `Acciones.jsx` en hooks + componentes más chicos | F-02 | ALTA | ALTO |
| 8 | Centralizar colores hardcodeados en `src/constants/colores.js` | F-06 | BAJA | MEDIO |
| 9 | Unit tests para `calcularAnalisis()`, `calcularPanel()`, `filtrarCompras()`, `filtrarGastos()` | T-02 | BAJA | ALTO |
| 10 | Íconos de Lucide en el sidebar | U-01 | BAJA | MEDIO |

### Fase 3 — UI/UX (segundo mes)
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 11 | Validación en tiempo real en formularios (modales de compra/gasto/cobro) | U-06 | MEDIA | ALTO |
| 12 | Sidebar colapsable en mobile (responsive básico) | U-04 | ALTA | ALTO (según uso real desde obra) |
| 13 | Tokens de escala tipográfica en `index.css` | U-03 | BAJA | MEDIO |
| 14 | Loading skeleton en Dashboard en vez de spinner monolítico | U-05 | MEDIA | MEDIO |
| 15 | Login: cambiar dropdown de usuarios por input de texto libre | F-09 | BAJA | MEDIO |
| 16 | Verificar estado "guardando" consistente en todos los modales | U-07 | BAJA | MEDIO |

### Fase 4 — Arquitectura (tercer mes)
| # | Ítem | Ref | Esfuerzo | Beneficio |
|---|------|-----|----------|-----------|
| 17 | Adoptar TanStack Query (React Query) para caché/dedup/retry | F-03 | MEDIA | ALTO |
| 18 | Lazy loading de rutas (`React.lazy` + `Suspense`), especialmente Recharts | F-04 | BAJA | MEDIO |
| 19 | Consistencia de CSS (BEM documentado o migrar a CSS Modules) | F-10 | ALTA | MEDIO |
| 20 | Prettier + lint-staged en frontend | D-04 (parte frontend) | BAJA | MEDIO |

---

## Fase 5 — Evolución del producto (después de estabilizar)
Notificaciones automáticas · Búsqueda global (Cmd+K) · Exportación a Excel · Vista Gantt de fases · PWA con cámara para comprobantes · Refresh tokens · AsyncSession (si el volumen lo justifica) · Integración AFIP.

---

## Seguridad — ya está bien, no tocar
Cookies httpOnly, CSRF double-cookie, magic bytes en uploads, CORS sin wildcards, `requiere_admin` en mutaciones, `SECRET_KEY` validado, orden de middlewares, errores genéricos sin stack trace, `sslmode=require`, roles server-side, `usuario_id` desde JWT.
