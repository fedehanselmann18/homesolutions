# Plan: tipo de cambio (precio en USD, gastos en ARS)

Fecha: 2026-10-05. Último cambio grande antes del deploy del relanzamiento.
Reemplaza la decisión previa de "se carga todo en pesos" (ver memoria
`proyecto_moneda_precio_acordado`): ahora el sistema sí maneja las dos monedas.

## Estado (05/10/2026)

Fases 1 a 5 implementadas y commiteadas, con `pytest` y `npm run test` en
verde. Diferencias con lo planeado:

- La migración (`c9e4a7b3d1f0`) no hace backfill y además **frena con un
  mensaje claro** si encuentra movimientos cargados, en vez de fallar con un
  NOT NULL críptico. La base local se vació solo en las tablas de
  movimientos (backup previo en `backend/backups/antes_tipo_cambio_2026-10-05.dump`)
  y se volvió a sembrar la demo con `scripts.seed_demo`, que ahora carga
  cotizaciones blue **inventadas** y convierte sus importes.
- La moneda del análisis es una elección global (`useMonedaAnalisis`): el
  switch US$/Pesos aparece en el análisis del proyecto, el de la fase, el
  Panel y Proyectos, y cambia todos a la vez. Vuelve a USD al recargar.
- El libro de obra quedó como caja en pesos nominales; los proveedores
  (catálogo, total comprado, deuda) siguen en pesos.
- El precio acordado en pesos usa la última cotización del tipo con que se
  acordó el proyecto, o la última de cualquier tipo si no hay de ese.

Pendiente:
- **6.1** — la columna de dólar del Excel de la carga inicial.
- **Deploy** (paso 20): no se hizo.
- Verificación visual con sesión iniciada: el PDF y la API se probaron
  contra la base local, las pantallas solo con tests (el login pide la
  contraseña real).

## 1. El problema de negocio

Agus acuerda el precio de la obra con el cliente **en dólares** (ej. 100.000 USD)
y **cobra en dólares** (ej. anticipo de 65.000 USD). Pero todo lo que paga él
—compras a proveedores, gastos— es **en pesos** (ej. 60.000.000 ARS de
materiales).

Hoy `Proyecto.precio_acordado` es un `Numeric(12,2)` sin moneda, y
`utils/analisis.js` lo compara directo contra la suma de gastos y compras en
pesos. Esa comparación es inconsistente y no hay tipo de cambio en ninguna
parte del código.

## 2. Decisiones tomadas (05/10/2026)

| # | Decisión |
|---|---|
| 1 | **Cobros siempre en USD** + cotización del día. El equivalente en pesos se calcula y se congela. |
| 2 | **Tabla `cotizaciones`** como fuente de sugerencia (el form precarga el valor del día o el último cargado) e **input editable**. Lo que vale es la cotización congelada en el movimiento: editar la tabla NO reescribe la historia. |
| 3 | **Varios tipos de dólar**: `oficial` / `blue` / `otro`. Cada movimiento guarda con qué tipo se cargó. |
| 4 | **Catálogo de proveedores todo en pesos.** `Producto.precio` y `DetalleCompra.precio_unitario` quedan ARS, sin cambios. El importador de catálogo con IA no se toca. |
| 5 | **Totales en pesos = nominales históricos** (lo que efectivamente salió de la caja). El USD es la vara de rentabilidad; el total en pesos es flujo de caja. Nada se reexpresa a dólar de hoy. |
| 6 | **PDF: USD principal + ARS entre paréntesis** en cada cifra. Los gráficos van en USD. Un solo PDF. |
| 7 | **Migración con columnas NOT NULL, sin backfill.** La base de producción está vacía; la base local se resetea. |
| 8 | **El precio acordado en pesos se muestra con la última cotización cargada** ("cuánto vale hoy el contrato"). El % gastado real se calcula en USD. |

## 3. Patrón de datos: doble registro congelado

La cotización **no se aplica al leer**: se guarda pegada al movimiento. Una
compra de marzo sigue valiendo lo que valió, pase lo que pase con el dólar.

Cada "documento de plata" (compra, gasto, cobro, nota) guarda tres cosas:

- `cotizacion_dolar` `Numeric(12,4)` NOT NULL — pesos por dólar, congelado
- `tipo_cambio` `String(20)` NOT NULL — `oficial` | `blue` | `otro`
- **las dos cifras**, ARS y USD, ambas persistidas

### Por qué las dos columnas y no calcular una al vuelo

`Compra.precio_total` suma el neto, los impuestos **y las notas de
crédito/débito**. Una nota tiene fecha propia, o sea **otro dólar**. Entonces:

```
precio_total_usd  ≠  precio_total_ars / compra.cotizacion_dolar
```

Con el USD congelado por componente los totales suman bien en las dos monedas,
y además se puede ordenar, filtrar y agrupar por USD directo en SQL.

### Regla de nombres

- Nombre pelado (`monto`, `precio`, `precio_unitario`) = **una sola moneda, pesos**.
- Sufijo `_ars` / `_usd` = **doble registro**, las dos cifras persistidas.

## 4. Modelo de datos

### 4.1 Tabla nueva: `cotizaciones`

```python
class Cotizacion(TimestampMixin, Base):
    __tablename__ = "cotizaciones"
    __table_args__ = (UniqueConstraint("fecha", "tipo", name="uq_cotizacion_fecha_tipo"),)

    id: uuid_pk()
    fecha: date      NOT NULL, index
    tipo:  String(20) NOT NULL   # oficial | blue | otro
    valor: Numeric(12,4) NOT NULL  # pesos por dólar
```

Es histórico consultable + fuente de sugerencia. No es la verdad de ningún
movimiento ya cargado.

### 4.2 Columnas en los movimientos

| Tabla | ARS | USD | Cuál se tipea | Agrega cotización |
|---|---|---|---|---|
| `proyectos` | (derivado al leer) | `precio_acordado_usd` | USD | `cotizacion_acordada`, `tipo_cambio_acordado` (nullable, solo referencia) |
| `cobros` | `monto_ars` (congelado) | `monto_usd` | **USD** | sí |
| `notas_cobro` | `monto_ars` (congelado) | `monto_usd` | **USD** (ajusta un precio en USD) | sí |
| `compras` | `precio_neto_ars` | `precio_neto_usd` (congelado) | **ARS** | sí |
| `gastos` | `monto_ars` | `monto_usd` (congelado) | **ARS** | sí |
| `notas_compra` | `monto_ars` | `monto_usd` (congelado) | **ARS** | sí |
| `compra_impuesto` | `monto` | property, hereda la cotización de su compra | ARS | no |
| `nota_compra_impuesto` | `monto` | property, hereda la de su nota | ARS | no |
| `detalle_compra` | `precio_unitario` | — | ARS | no |
| `productos` | `precio` | — | ARS | no |

`cotizacion_acordada` es la única nullable del lote: es trazabilidad del día de
la firma, no entra en ningún cálculo (decisión #8), y un proyecto cargado
tiempo después puede no tenerla.

### 4.3 Properties derivadas

```
Compra.precio_total_ars = precio_neto_ars + Σ impuestos.monto − Σ NC.monto_ars + Σ ND.monto_ars
Compra.precio_total_usd = precio_neto_usd + Σ (impuestos.monto / compra.cotizacion_dolar)
                                          − Σ NC.monto_usd + Σ ND.monto_usd
Cobro.monto_neto_ars / monto_neto_usd  — mismo criterio, cada nota con SU cotización
Proyecto.precio_acordado_ars  — NO se persiste: precio_acordado_usd × última cotización
```

### 4.4 Quién calcula el congelado

**Siempre el backend**, en el service layer, y **recalcula ignorando lo que
manda el front**:

```
gasto/compra/nota_compra:  monto_usd = round(monto_ars / cotizacion_dolar, 2)
cobro/nota_cobro:          monto_ars = round(monto_usd × cotizacion_dolar, 2)
```

El front muestra el equivalente en vivo como preview, pero no es la fuente de
verdad. Esto es lo primero a testear.

## 5. Fases de implementación

Commits chicos, un archivo a la vez, cada archivo explicado antes de aplicarlo.

### Fase 1 — Base de datos
1. `models.py`: modelo `Cotizacion`.
2. `schemas.py` + `routes/cotizaciones.py`: CRUD + `GET /cotizaciones/ultima?tipo=blue`. Tests.
3. `models.py`: columnas nuevas de la tabla 4.2 + properties de 4.3.
4. Migración Alembic (NOT NULL, sin backfill) + reseteo de la base local.

### Fase 2 — Backend: schemas y routes
5. `schemas.py`: entradas y salidas con `_ars`/`_usd`, validación de `tipo_cambio` y `cotizacion_dolar > 0`.
6. `routes/compras.py`, `gastos.py`, `cobros.py`, `proyectos.py` + las notas: congelamiento del USD en el service layer.
7. Fixtures de `conftest.py` con cotización + tests nuevos: congelamiento, recálculo que ignora al cliente, nota con cotización distinta a su compra.
8. Suite backend verde.

### Fase 3 — Cálculos y PDF
9. `reportes/calculos.py`: **parametrizado por moneda** (`calcular_analisis_proyecto(..., moneda)`), un solo cuerpo de fórmulas invocado dos veces. Evita duplicar la lógica y garantiza que las dos monedas usen la misma cuenta.
10. `reportes/pdf_proyecto.py`: `formato_moneda` dual `US$ 41.379 (ARS 60.000.000)`, gráficos en USD, `_tabla_totales` / `_tabla_notas` / `_tabla_fases` / `_tabla_deuda` con las dos cifras.
11. `routes/proyectos.py`: el endpoint del PDF resuelve la última cotización y la pasa al cálculo.

### Fase 4 — Frontend: carga de datos
12. `utils/formato.js`: `formatMoneda(monto, moneda)` + `formatMonedaDual(ars, usd)`.
13. `services/cotizacionService.js` + `hooks/useCotizacionDia.js` (precarga del valor del día).
14. `ModalCompra.jsx`, `ModalGasto.jsx`, `ModalCobro.jsx`, `ModalNota.jsx`: selector de tipo de cambio, campo cotización precargado y editable, preview del equivalente.
15. Pantalla de cotizaciones en Catálogos (mismo molde que impuestos y categorías, para que Agus cargue el dólar del día solo).

### Fase 5 — Frontend: análisis
16. `utils/analisis.js`, `panel.js`, `seguimiento.js`: parametrizados por moneda.
17. Switch ARS/USD en el header del análisis + los ~22 archivos que llaman `formatMoneda`.
18. Tests vitest.

### Fase 6 — Cierre
19. Revisión de la carga inicial (ver caveat 6.1).
20. Deploy.

## 6. Caveats y puntos finos

### 6.1 El Excel de la carga inicial necesita una columna de dólar
Los gastos cargados a mano en el Excel que hay que importar a producción
(ver memoria `relanzamiento_produccion`) ahora necesitan **la cotización de la
fecha de cada fila**. Sin eso no se puede calcular el USD histórico y queda
inventado. Hay que resolver esto antes de importar, no después.

### 6.2 La deuda a proveedores es una obligación en pesos
Una compra impaga se debe en pesos, no en dólares. En el análisis y el PDF la
deuda va **con el peso como cifra principal** y el USD histórico como
referencia — al revés que el resto del reporte.

### 6.3 El "% gastado" solo tiene sentido en USD
Comparar gasto nominal en pesos contra un precio acordado reexpresado a hoy
mezcla dos cosas distintas. `pctGastado` y `pctCobrado` se calculan **en USD**;
en la vista en pesos se muestran igual, pero el número viene del cálculo en USD.

### 6.4 El extractor de IA sigue leyendo pesos
Los comprobantes están en pesos, así que la IA sigue devolviendo ARS. Para un
**cobro** (que se tipea en USD) el front tiene que convertir el monto leído con
la cotización precargada antes de ponerlo en el campo. A validar en la Fase 4.

### 6.5 Renombrar `precio_acordado` → `precio_acordado_usd`
**Decidido (05/10/2026): sí, como commit aparte antes de la Fase 1.** El bug
que origina todo este trabajo es justamente que ese campo no dice su moneda,
y con la regla de nombres del §3 un nombre pelado significa pesos. Se hizo
como rename puro (sin cambio de comportamiento) con su propia migración
`alter_column`, para que los diffs de las fases siguientes muestren solo la
lógica de doble moneda. Ojo: en el front un `proyecto.precio_acordado` que se
escape no rompe, da `undefined ?? 0` — el control es un `grep` en cero.

### 6.6 Precisión numérica
`Numeric(12,4)` para cotizaciones (aguanta `1487.3456`). Los montos ARS pasan a
`Numeric(14,2)`: un proyecto de 100.000 USD a 2.000 son 200.000.000, y conviene
margen antes del techo de `Numeric(12,2)`.
