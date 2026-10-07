# Prompts de ejecución — rediseño UI/UX v5

Cada sección de abajo es **un prompt completo y autónomo** para una sesión de
Claude que arranca en frío. Se ejecutan **en orden**, uno por sesión y uno por
commit.

**Cómo usarlo:** abrí una sesión y decile

> `Leé docs/PROMPTS_UIUX.md y ejecutá el PROMPT 4. Nada más que eso.`

No hace falta pegar el texto: está acá.

Documentos de referencia, en este orden:

1. **`docs/DESIGN.md`** — el sistema de diseño v5. Dice **qué** tiene que quedar.
   Es la autoridad: si este archivo y DESIGN.md se contradicen, gana DESIGN.md.
2. **`docs/PLAN_UIUX_ROLLOUT.md`** — el plan por pieza, las 8 decisiones ya
   tomadas, la tabla de **Hallazgos** y la de **Contradicciones**.
3. **`docs/GENERALUIUXChange/`** y **`docs/MODALSUIUXChange/`** — los diseños, en
   archivos `.dc.html`. **Son el spec exacto**: leé entero el que te toque.

---

## Preámbulo — vale para TODOS los prompts

No hace falta repetirlo en cada uno; es la ley de todos.

**Antes de empezar**

- Leé `docs/DESIGN.md` completo la primera vez, y después las secciones que el
  prompt nombre.
- Leé la tabla **Hallazgos** de `docs/PLAN_UIUX_ROLLOUT.md`: ahí está lo que
  aprendieron las piezas anteriores, y suele ahorrar un error.
- Leé entero el `.dc.html` que el prompt nombre. No trabajes de memoria ni de
  la descripción de este archivo: el `.dc.html` tiene los valores.

**Mientras trabajás**

- **Ningún valor literal donde hay un token.** Nada de `font-size: 0.8rem`,
  `color: #6b7280` ni `padding: 7px 13px`. Si el valor que necesitás no existe
  como token, el problema es la decisión: anotalo en Hallazgos y usá el token
  más cercano.
- **Si un componente compartido no encaja, va un modificador, no un bloque
  nuevo.** `.btn--sm`, `.campo--sm`, `.badge--sm` existen para eso.
- **No toques lo que el prompt no nombra.** Si ves algo feo en otra pantalla, va
  a Hallazgos. No se arregla de paso.
- **Antes de cambiar algo que parezca duplicado, buscá las otras copias.** La
  pieza 0b descubrió el semáforo de estado duplicado a mano en dos componentes
  fuera de `estados.js`. Pasa seguido: `grep` antes de tocar.
- **Si un test busca una clase o un texto que cambiás, actualizá el test en el
  MISMO commit.** No lo dejes para después.
- **Estado ≠ progreso.** Una barra de avance no es un estado: el progreso usa la
  rampa oliva (DESIGN.md §2 "Progreso y datos"), el estado usa el semáforo.
  Confundirlos ya pasó una vez.
- **Ningún badge de estado sin su ícono.** Las seis luminancias del semáforo caen
  entre 0.07 y 0.12: los estados se distinguen por tono, no por claridad, así que
  con deuteranopia el verde y el rojo quedan casi iguales. El ícono carga la
  mitad del significado.

**Terminado cuando** (además de lo que pida el prompt)

```bash
# 1. Ningún tamaño de texto literal — tiene que dar 0
grep -rn --include="*.css" -E 'font-size: *[0-9.]+(rem|px|em);' frontend/src

# 2. Ningún hex fuera de index.css — tiene que dar 0
grep -rn --include="*.css" -E '#[0-9a-fA-F]{3,8}\b' frontend/src | grep -v 'src/index.css'

# 3. Tests verdes (línea base: 21 archivos, 217 tests + los que agregó la pieza 1)
cd frontend && npm test

# 4. Lint limpio en lo que tocaste
cd frontend && npx eslint <archivos>
```

Y: **anotá en la tabla Hallazgos de `docs/PLAN_UIUX_ROLLOUT.md`** qué token te
faltó, qué del spec no cerró contra el código real y qué resultó ambiguo. Si no
encontraste nada, escribilo explícitamente. Esa tabla es memoria entre sesiones y
es la mitad del valor de cada pieza.

**Commits:** un commit por prompt, en `main`. Mensaje en castellano, imperativo,
con el número de prompt al final entre paréntesis. Ejemplo:
`rediseño v5: tabs con ícono y badge de pendientes (prompt 2)`.

---

# FASE A — Fundaciones

## PROMPT 1 — `estados.js` a pares · ✅ YA HECHO

Dejado como registro. `getEstado` / `getEstadoLabel` devuelven
`{ color, bg, fg, label, icono }`, y `ProyectoDetalleHeader` ya usa el par en vez
de `color-mix`. Hay un `frontend/src/constants/estados.test.js` nuevo.

Si arrancás acá, verificá que siga así y pasá al 2.

---

## PROMPT 2 — `Tabs` con ícono y badge

**Leé:** DESIGN.md §13 (Navegación → Tabs) ·
`docs/GENERALUIUXChange/HSProyectoHeader.dc.html` (entero, 90 líneas)
**Archivos:** `frontend/src/components/shared/Tabs.{jsx,css}`

`Tabs.jsx` sólo pinta `label`. El diseño tiene además un ícono a la izquierda y
un badge opcional de pendientes a la derecha. Extendé el componente.

**API nueva:** cada tab acepta `{ key, label, icono, badge }`

- `icono`: componente de `lucide-react`, **opcional**. Se renderiza a 15px con
  `strokeWidth={1.75}` y `aria-hidden="true"`.
- `badge`: número o string, **opcional**.
- Los dos opcionales porque `Tabs` lo usan el proyecto **y** la fase, y la fase
  puede no pasarlos. Sin ícono y sin badge, el resultado tiene que verse igual
  que hoy salvo la geometría nueva.

**Geometría**

| Parte | Valor |
|---|---|
| contenedor | `flex`, `gap: --space-7`, `border-bottom: 1px solid --color-linea` |
| tab | alto 40px, `border-bottom: 2px solid`, `margin-bottom: -1px`, `gap: --space-2` |
| activa | borde `--color-terracota`, color `--color-tinta`, peso 600 |
| inactiva | borde `transparent`, color `--color-tinta-muted`, peso 500 |
| badge | `--text-2xs` / 700 / `line-height: 18px` / `min-width: 18px` / centrado / `--radius-pill` / fondo `--color-arcilla-tint` / color `--color-arcilla-texto` |

El `margin-bottom: -1px` es lo que hace que la línea de 2px **tape** la de 1px
del contenedor en vez de apilarse debajo. No lo saques.

**No toques** `ProyectoDetalleHeader` ni `ProyectoDetalle`: nadie tiene que
empezar a pasar `icono` todavía.

**Terminado cuando** se mantienen `role="tablist"` / `role="tab"` /
`aria-selected`, el foco sigue cayendo en la regla global de `:focus-visible`
(DESIGN.md §16), y las tabs del proyecto y de la fase se ven como antes salvo la
geometría.

---

## PROMPT 3 — `ProyectoDetalleHeader` · EL PILOTO

**Leé:** DESIGN.md completo · PLAN_UIUX_ROLLOUT.md pieza 1, incluida "Desvío del
diseño, anotado" · `docs/GENERALUIUXChange/HSProyectoHeader.dc.html` (entero)
**Archivos:** `components/proyectos/ProyectoDetalleHeader.{jsx,css}`,
`pages/ProyectoDetalle.jsx`

**Anatomía final**

```
Proyectos / Edificio Olleros          breadcrumb: --text-sm, muted, "/" en
                                      --color-gris-claro-marca, último tramo
                                      --color-tinta peso 500
  ↕ --space-2
Edificio Olleros   [En curso]         h1 --text-2xl / 700 / ls -0.02em
                                      badge con el par bg/fg de estados.js,
                                      --radius-xs, SIN borde, con su ícono
  ↕ --space-2
📍 Olleros 1925   📅 Desde el 10/03/2026   📚 Fase 3 de 4 · Montaje
                                      --text-base muted, íconos 15px en
                                      --color-tinta-tenue, flex-wrap,
                                      gap --space-1-5 --space-5
  ↕ --space-5
[las tabs, ahora con ícono]
```

**Cambios respecto a hoy**

- **Se va** el `border-left: 4px solid estado.color` y su `padding-left`. El
  diseño no tiene regla izquierda: la identidad la da la tipografía.
- El h1 pasa de peso 600 a **700** y suma `letter-spacing: -0.02em`.
- La meta deja de ser un `<p>` con `{dirección} · Iniciado el {fecha}` y pasa a
  los **tres items con ícono**. Cambia la redacción: "Iniciado el" → **"Desde
  el"**.
- `Fase N de M · Nombre` **no está en los props actuales**. Agregá los props que
  haga falta desde `ProyectoDetalle.jsx`, que ya tiene las fases. Si el proyecto
  no tiene fases, ese item no se renderiza.
- Pasale `icono` a las cuatro tabs (Fases → `Layers`, Acciones →
  `ArrowRightLeft`, Análisis → `ChartNoAxesColumn`, Seguimiento → `Bell`) y
  `badge` a Seguimiento con la cantidad de pendientes, si ya está disponible en
  la página; si no, dejá el badge sin pasar y anotalo en Hallazgos.

**⚠️ DESVÍO DELIBERADO DEL DISEÑO.** `HSProyectoHeader.dc.html` dibuja el h1 en
**28px**. Usá **`--text-2xl` (24px)**. Razón: DESIGN.md §3 reserva 28px para
páginas de **listado** y 24px para páginas de **detalle**, y la variante 4p
(Proveedor detalle) usa 24px — el 28 del header de proyecto es el outlier entre
los dos diseños. Está tabulado en "Contradicciones con DESIGN.md".

**No toques** el contenido de las cuatro tabs, ni el sidebar, ni el fondo de
página.

**Terminado cuando** además: mobile a 640px apila título y badge, la meta hace
wrap y nada se desborda horizontalmente.

**ESTE ES EL PILOTO Y EL INFORME ES EL ENTREGABLE.** Llená Hallazgos con, como
mínimo: qué token te faltó, qué valor del spec no cerró contra el código, qué de
DESIGN.md resultó ambiguo, y **cuánto del trabajo fue CSS y cuánto fue tocar
JSX**. Eso decide cómo se escriben las piezas siguientes.

---

## PROMPT 4 — Utilidades globales de `index.css`

**Leé:** DESIGN.md §7 (radios y sombras), §8 (botones), §9 (campos), §11 (tablas
y listas), §12 (badges y chips), §3 (mayúsculas)
**Archivos:** `frontend/src/index.css` y los `.jsx` que haya que renombrar

Esta es la pieza de más alcance de todo el rediseño: cambia las utilidades que
consume toda la app, pero **casi todo pasa en un solo archivo**. Hacela con
cuidado y mirá varias pantallas al terminar.

**1. `.btn` pasa de padding a alto fijo.** Hoy es `padding: 10px 18px` y el alto
sale del contenido; en los diseños el alto está declarado, y eso es lo que los
hace alinear con los inputs y las filas.

| Tamaño | Alto | Radio | Texto | Padding |
|---|---|---|---|---|
| `.btn--sm` | 30px | `--radius-sm` | `--text-sm` | `0 --space-3` |
| `.btn` | 32px | `--radius-sm` | `--text-sm` | `0 --space-3` |
| `.btn--lg` | 38px | `--radius-md` | `--text-base` | `0 --space-4` (relleno: `0 18px`) |

Gap ícono–texto `--space-1-5` siempre. El borde de 1px va en **todas** las
variantes (transparente en las rellenas) así todas miden igual.

- `.btn-primary`: oliva relleno, texto blanco.
- `.btn-secondary`: fondo `--color-superficie`, borde `--color-linea`, texto
  `--color-tinta`.
- `.btn-marca`: **cambia de forma**. Deja de ser contorno oliva y pasa a relleno:
  fondo `--color-terracota-tint`, borde `--color-ia-borde`, texto
  `--color-terracota-dark`. Así no compite con el primario, que es el único
  oliva sólido de la pantalla.
- `.btn-peligro`: contorno rojo que se rellena en hover. Sin cambios de criterio.

**2. `.btn-icono` pasa de 28×28 a 32×32** (`--sm`: 24→28), ícono de 14 a **16px**
(`--sm`: 14px). Radio `--radius-sm`. Razón: en los diseños miden igual que el
botón de toolbar que tienen al lado.

**3. `.campo` pasa a alto fijo y fondo blanco.**

| Propiedad | Valor |
|---|---|
| alto | **40px** (textarea: alto libre, mismo padding) |
| radio | `--radius-md` |
| borde | `1px solid --color-linea` |
| fondo | **`--color-superficie`** (blanco, no gris) |
| texto | `--text-base` |
| padding | `0 --space-3` |
| gap interno | `--space-2` |
| ícono / chevron | `--color-tinta-tenue`, 16px |
| **foco** | borde `--color-terracota` **+** `--shadow-foco` |

Modificadores: `.campo--sm` (32px, `--radius-sm`), `.campo--error` (borde
`--color-oxido`), y **nueva** `.campo--monto` (`--text-lg` / 600 / tabular-nums,
con la moneda como prefijo tenue adentro).

**4. `.badge` pasa de pill a rectángulo.** `padding: 0 --space-2`,
`line-height: 22px`, `--text-xs`, peso 600, **`--radius-xs`**. `.badge--sm`:
`0 --space-1-5`, `line-height: 20px`, `--text-2xs`.

El `line-height` en vez de `padding-block` es lo que mantiene el alto exacto en
22px sin importar la fuente. **No le pongas `padding-block`.**

Variantes con los pares de §2: `--neutro`, `--exito`, `--atencion`, `--peligro`,
`--marca`. Un badge puede llevar ícono a 14px con `gap: --space-1`.

**⚠️ Esto invierte el significado del radio pill.** Antes el radio grande era
"esto es una etiqueta"; ahora el badge es un rectángulo de 4px y el pill queda
para los **controles** y para lo que es geométricamente redondo. Es el cambio de
detalle que más se nota, y es deliberado: en los diseños los badges van pegados a
cifras en filas densas y la pastilla redonda compite con el texto.

**5. `.chip` es nueva.** Es un **control**, no un badge: tiene hover, foco y
estado. Vive en `index.css` como utilidad propia justamente para que nadie vuelva
a resolverlo con `.badge` + `onClick`.

| Variante | Forma |
|---|---|
| `.chip` | 30px, `--radius-pill`, borde `--color-linea`, fondo blanco |
| `.chip--activo` | borde `--color-terracota`, fondo `--color-terracota-sel`, peso 600 |
| `.chip--agregar` | `1px dashed --color-gris-claro-marca`, texto muted, con `+` |
| `.chip--quitable` | con `×` a la derecha a 20px, fondo `--color-base-2` |
| `.chip--opcion` | 34px, `--radius-md` — el de formularios |

Puede llevar contador a la derecha en `--text-xs` / `--color-tinta-tenue`.

**6. `.planilla` pierde su caja.** Hoy tiene borde y radio: es una card con filas
adentro. En los diseños las listas **no tienen contorno** — las filas se separan
con `--color-linea-suave` y la lista se apoya en el blanco de la página. Es lo
que más aire le da a los listados.

| Parte | v5 |
|---|---|
| contenedor | **sin borde ni radio** |
| header | alto 32px, fondo `--color-superficie-suave`, `--text-xs` / 600 / muted. **Deja de ser obligatorio** |
| fila | `min-height: 54px`, `border-bottom: 1px solid --color-linea-suave`, gap `--space-4` |
| hover | `--color-superficie-suave` |
| última fila | sin borde |

**7. `.label-ficha` → `.label-campo`, y se van las mayúsculas.** El label pasa a
**caja normal, `--text-sm`, peso 500, `--color-tinta-muted`**, con
`gap: --space-1-5` respecto al campo. El nombre viejo describía una ficha en
mayúsculas que ya no existe. Son 8 archivos `.jsx` y 2 `.css` — buscalos con
grep, no confíes en el número.

El `(opcional)` va **dentro** del label, en `--color-tinta-tenue` peso 400.

**8. Acciones de fila: la excepción que se mantiene.** Los diseños las muestran
sólo en hover. **No lo copies tal cual**: en touch el hover no existe y las
acciones quedan inalcanzables, que es un bug que la v4 ya arregló una vez.

```css
@media (hover: hover) and (pointer: fine) {
  .planilla__fila .acciones { opacity: 0; }
  .planilla__fila:hover .acciones,
  .planilla__fila:focus-within .acciones { opacity: 1; }
}
```

El `:focus-within` **no es opcional**: sin él son inalcanzables por teclado.

**Terminado cuando** además: recorriste Panel, Proyectos, un proyecto,
Proveedores, Catálogos y un modal de alta, y ninguno quedó roto (sí van a quedar
a medio migrar — eso es esperado). Todo lo que quedó raro va a Hallazgos.

---

## PROMPT 5 — Sidebar blanco y fondo de página blanco

**Leé:** DESIGN.md §13 (Navegación → Sidebar), §0 ·
`docs/GENERALUIUXChange/HSSidebar.dc.html` (entero, es el spec completo)
**Archivos:** `components/Sidebar.{jsx,css}`, `layouts/MainLayout.{jsx,css}`,
`index.css`, `pages/Auth.css`

El cambio más visible del rediseño. El sidebar pasa de negro puro a **blanco**.

**Sidebar: 232px** (hoy 212). Sigue `position: sticky` midiendo `100dvh` con
`100vh` de fallback; el único tramo que scrollea por dentro es `.sidebar-nav`,
así el footer queda siempre visible. **`dvh` y no `vh`**: con la barra de
direcciones retráctil de iOS, `100vh` es el viewport *grande* y el footer cae
abajo del borde visible.

| Parte | Spec |
|---|---|
| contenedor | fondo `--color-superficie`, `border-right: 1px solid --color-linea`, padding `--space-6 --space-4 --space-4`, gap `--space-6` |
| logo | isotipo 28px + "Home Solutions" en `--text-sm` / 700 / `line-height: 1.1` |
| item | alto 36px, `--radius-sm`, padding `0 --space-2`, gap `--space-3`, ícono 16px |
| item inactivo | `--color-tinta-muted`, peso 500 |
| item activo | texto e ícono `--color-terracota`, fondo `--color-terracota-sel`, peso 600 |
| hover | fondo `--color-base-2` |
| contador | derecha, `--text-xs`, `--color-tinta-tenue` |
| grupo "En curso" | label `--text-xs` / 600 / `--color-tinta-tenue`; items 32px con punto de 7px |
| footer | avatar 32px `--radius-pill` en tint oliva, nombre `--text-base` / 600, rol `--text-xs` muted, `border-top` |

**El item activo pierde el borde izquierdo.** En la v4 era fondo + borde
izquierdo oliva + ícono oliva. En los diseños es fondo + texto e ícono en oliva,
sin borde: un indicador alcanza, y el borde peleaba con el radio del item.

**Fondo de página a blanco.** La pieza 0 dejó `--color-base-1` apuntando a
`#f9f8f6` porque cargaba dos roles a la vez. Ahora:

- `body` (en `index.css`) y `MainLayout` pasan a **`--color-superficie`**.
- `--color-base-1` se queda en `#f9f8f6` para sus otros 26 usos (header de
  planilla, hover de fila, buscador, pies de modal). **No lo repuntes a blanco**
  o se borran todos esos roles.

**Los `--color-oscuro-*` quedan sólo para el login** (`pages/Auth.css`), que es
la única pieza que sigue siendo de marca y no de producto. No los borres.

**No toques** el contenido de ninguna página.

**Terminado cuando** además: el breakpoint de 768px del sidebar (barra superior
en mobile) sigue funcionando — lo comparten `Sidebar.css` y `MainLayout.css`, que
tienen que moverse juntos. Y `html { overflow-x: hidden }` + `body { overflow-x: clip }`
quedan como están: `hidden` en los dos rompe el sticky del sidebar.

---

# FASE B — Acciones de un proyecto

Diseño de toda esta fase: **`docs/GENERALUIUXChange/Movimientos v2.dc.html`**,
variante `3a`. Trae la tabla desktop, el modal de detalle y la versión mobile de
375px.

⚠️ **`docs/UIUXChange/Movimientos.dc.html` (variantes 1a–2b) es material
descartado**: paleta vieja fría, tamaños en `rem`, mayúsculas. No lo mires.

`Acciones.jsx` (484 líneas) es casi toda orquestación — estado, handlers,
modales. **No hay nada visual que cambiar ahí.**

## PROMPT 6 — `LibroDeObra`, la tabla de movimientos

**Archivos:** `components/proyectos/LibroDeObra.{jsx,css}`, `LibroDeObra.test.jsx`

**Es restyle, no rebuild.** El componente ya hace todo lo estructural del
diseño: agrupación por día con subtotal (`libro__dia`), saldo acumulado calculado
del más viejo al más nuevo, totales por tipo, y la grilla ya está parametrizada
en `--libro-cols`.

| Parte | v5 |
|---|---|
| `libro__cabecera` (título + leyenda con puntos) | **se va.** El título lo da la página; los totales por tipo pasan al contador de cada chip de filtro (prompt 7) |
| contenedor | sin borde ni radio |
| header de columnas | alto 36px, `--text-xs` / 600 / muted, sin fondo |
| separador de día | alto 36px, fondo `--color-superficie-suave`, borde arriba y abajo `--color-linea`, label 600 + subtotal muted a la derecha |
| fila | `padding: 14px --space-2`, `border-bottom: 1px --color-linea-suave`, hover `--color-superficie-suave`, `align-items: start` |
| fila seleccionada | fondo `--color-terracota-sel` |
| tipo | cuadradito 28px, `--radius-sm`, fondo `--color-base-2`, ícono 15px muted |
| movimiento | título `--text-md` / 600; abajo contexto con íconos de 13px (fase, proveedor) + meta muted |
| estados pago/envío | **badges** del par que corresponda, ícono a 12px, apilados |
| comprobante | columna de 28px: clip en `--color-tinta-tenue` si está adjunto, alerta en `--color-arcilla` si falta |
| importe | `--text-md` / 700 + moneda al lado en `--text-xs` / 500 / tenue; debajo el equivalente en muted |
| saldo | `--text-base` muted, a la derecha |
| pie | `{n} resultados` a la izquierda + paginación a la derecha, botones h28 |

Columnas: `28px minmax(0,1fr) 168px 28px 168px 104px`, `gap: --space-5`.

**⚠️ LA COLUMNA DE SALDO VA EN PESOS, NO EN DÓLARES.** El diseño la titula
`Saldo US$`; **ignoralo**. Va `Saldo $`, en ARS nominal. Es la decisión 6 del plan
y la #5 de `docs/PLAN_TIPO_CAMBIO.md`: *el libro es la caja, así que importes y
saldo van en pesos nominales, lo que efectivamente entró y salió*. El modelo es:
gastos y compras en pesos con su equivalente en dólares como complemento chico;
cobros y `precio_acordado_usd` en dólares. El tratamiento por fila del diseño ya
es correcto — sólo cambia el título de la columna.

**No agregues** el bloque de saldo + gráfico de barras: está diferido al prompt
19.

**Terminado cuando** además: `AccionesFase` y la ficha de proveedor siguen
enteras (usan el mismo `LibroDeObra`), y mobile a 640px colapsa la fila como la
versión de 375px del diseño (título + importe arriba, contexto, badges abajo), no
con scroll horizontal.

---

## PROMPT 7 — Filtros de lista a chips

**Archivos:** `components/shared/FiltrosSegmentados.{jsx,css}`

Hoy `Todo / Compras / Gastos / Cobros` es un segmentado. Pasa a los **chips de la
variante 4L**: pill, borde `--color-linea`, fondo blanco; activo con borde
`--color-terracota` + fondo `--color-terracota-sel` + peso 600, **con el contador
adentro** en `--text-xs` / `--color-tinta-tenue`. Usá la utilidad `.chip` del
prompt 4.

**Por qué chips y no tabs:** el diseño los dibuja como tabs con subrayado oliva
de 2px, igual que las tabs de sección del header del proyecto. Apiladas quedan
dos filas idénticas con significados distintos. El subrayado de 2px queda
reservado a **navegación de sección**; un filtro es un control. Precedente: la
variante 4L, que ya elegimos para Proyectos. Es la decisión 5 del plan.

**Agregá el filtro "Con alertas"**, que el diseño tiene y hoy no existe: cuenta
los movimientos con comprobante faltante, pago pendiente o sin entregar. La
lógica ya está disponible en la fila (el ícono de alerta se calcula).

**⚠️ `FiltrosSegmentados` lo usan además `Dashboard`, `Proyectos` y
`SelectorMoneda`.** Si el chip no les sirve a los tres, **agregá una variante**
(`<FiltrosSegmentados variante="chips">`), no forkees el componente. Verificá las
cuatro pantallas.

---

## PROMPT 8 — Panel de filtros

**Archivos:** `components/shared/FiltrosLista.{jsx,css}`

El diseño lo reemplaza por dos botones secundarios de h28 (`Filtrar`,
`Exportar`) a la derecha de la fila de chips. El panel desplegable queda, con los
campos a `.campo` de §9 y los filtros aplicados mostrados como `.chip--quitable`.

**`Exportar` no existe en el backend.** Verificá si hay endpoint; si no hay, **no
pongas el botón**. No shipees un botón que no hace nada.

---

## PROMPT 9 — Modales de detalle de movimiento

**Archivos:** `components/modals/ModalDetalle{Compra,Gasto,Cobro}.jsx`,
`PiezasDetalle.jsx`, `ModalDetalle.css`, `modales.test.jsx`

Geometría de DESIGN.md §14: radio `--radius-xl`, header **claro** de 64px, pie
con botones `.btn--lg`, ancho **560px**. Estructura de contenido de
`Movimientos v2`:

1. **Cabecera del movimiento**: título a la izquierda (`--text-xl` / 700) con sus
   badges debajo; a la derecha el importe en `--text-2xl` / 700, el equivalente
   en muted y la cotización usada en tenue.
2. **Banda de faltante** (si falta comprobante): fondo `--color-arcilla-tint`,
   `--radius-md`, botón `Adjuntar` a la derecha.
3. **Detalles**: grid de 3 columnas, cada campo con label `--text-xs` muted
   arriba y valor `--text-base` / 500 abajo, con punto de color donde hay estado.
4. **Productos** (si tiene): filas nombre / ×cantidad / total, y abajo a la
   derecha un bloque de 260px con Neto / IVA / **Total** en 700.
5. **Archivos**: fila con cuadradito de ícono, nombre + uuid en tenue, botón de
   descarga.
6. **Pie**: `Borrar` como ghost **a la izquierda** (hover a `--color-oxido`),
   `Editar` secundario y la acción primaria a la derecha.

**⚠️ El header oscuro se retira, y los dos shells se unifican.** En la v4 había
dos: `<ModalShell>` con header claro para alta/edición y
`DetalleShell`/`EditarShell` con header **oscuro** para ver un movimiento,
"porque el header oscuro distingue mirar de cargar". En la v5 eso lo dice el
ícono y el título: un header negro en una app sin superficies oscuras es un resto
de la v4. **Esto permite colapsar `ModalDetalle.css` (517 líneas) contra
`modal-base.css`**, que es un pendiente viejo. Hacelo acá o anotalo, pero no lo
dejes invisible.

**El alto del modal es variable:** `max-height: 88vh` con el cuerpo en
`flex: 0 1 auto`. El diseño tiene el frame en alto fijo y eso deja un hueco
muerto entre el último campo y el pie cuando hay pocos ítems. No lo copies.

**⚠️ 7 call sites.** Probá los tres modales desde: `Acciones`, `AccionesFase`,
`Seguimiento`, `SeguimientoFase`, `FaseDetalle`, `ProveedorDetalle`,
`ModalCompra`.

---

# FASE C — Pantallas

Todas siguen el mismo patrón: leé la variante, aplicá el sistema, no inventes.
Los tokens y las utilidades ya existen desde los prompts 4 y 5, así que esto
debería ser mayormente CSS.

## PROMPT 10 — Panel (variante 4i)

**Diseño:** `docs/GENERALUIUXChange/HS General.dc.html`, bloque `id="4i"`
("Números + gráfico + dos listas")
**Archivos:** `pages/Dashboard.{jsx,css}`, `components/shared/TarjetaKpi.*`,
`components/shared/TarjetaAlerta.*`, `components/shared/TarjetaMiniSeguimiento.*`

Saludo en `--text-3xl` / 700 / ls -0.02em. Los KPIs van en una grilla de 3 con
`gap: --space-8`, cada uno con label `--text-base` muted, cifra `--text-3xl` /
700 / tabular-nums y sublabel `--text-sm` muted; separados por
`border-left: 1px solid --color-linea` + `padding-left: --space-8`, **no por
cards**. Después el gráfico y las dos listas.

`.skeleton` del Panel es la **excepción a propósito** de DESIGN.md §16: es el
único lugar donde el layout es estable y conocido de antemano. No lo saques y no
lo replíques en otras pantallas.

## PROMPT 11 — Lista de proyectos (variante 4L)

**Diseño:** `HS General.dc.html`, `id="4l"` ("Cards")
**Archivos:** `pages/Proyectos.{jsx,css}`, `components/proyectos/TablaProyectos.*`,
`components/proyectos/ProyectoCard.*`

Grilla de 3 con `gap: --space-4`. Card: `--space-card`, borde `--color-linea`,
`--radius-lg`, gap interno `--space-4`, **sin sombra en reposo**; hover borde
`--color-gris-claro-marca` + `--shadow-hover`. Terminado = `opacity: .75`, **no
tachado**.

Dentro: badge de estado arriba a la izquierda + contador de alertas a la derecha;
nombre `--text-lg` / 700 y dirección `--text-sm` muted; la barra de segmentos de
fases (4px, `--radius-pill`, **rampa oliva** — ya arreglada en la pieza 0b); y
abajo una grilla de 3 con Cobrado / Gastado / Disponible separada por
`border-top: 1px solid --color-linea-suave`.

Los chips de filtro `Todos / En curso / Terminados / Presupuestados` con contador
usan `.chip` del prompt 4. **Éste es el precedente de los chips** — si el prompt
7 ya se hizo, reusá, no redeclares.

## PROMPT 12 — Lista de proveedores (variante 4N)

**Diseño:** `HS General.dc.html`, `id="4n"` ("Primero a quién se le debe")
**Archivos:** `pages/Proveedores.{jsx,css}`, `components/proveedores/*`

Dos bloques: **"Con deuda"** arriba, como cards en grilla de 2 con el monto en
`--text-xl` / 700, la antigüedad como badge del par que corresponda (rojo si
≥90 días, ámbar si no) y dos botones de acción (`Registrar pago` primario,
`Ver compras` secundario). Abajo **"Al día"** como lista de filas de 54px con
avatar de 32px, nombre + meta, teléfono, total comprado y chevron.

El criterio de la variante es **ordenar por lo que hay que resolver**, no
alfabético. No lo pierdas.

## PROMPT 13 — Proveedor detalle (variante 4P)

**Diseño:** `HS General.dc.html`, `id="4p"` ("Ficha lateral · Historial de compras")
**Archivos:** `pages/ProveedorDetalle.{jsx,css}`

Layout `grid-template-columns: 272px minmax(0,1fr)` con `gap: --space-9`,
`align-items: start`. **Esto no es un drawer** (DESIGN.md §15): es una columna
del layout, siempre visible, que en `max-width: 900px` pasa arriba del contenido.

Aside: avatar 44px + nombre `--text-2xl` / 700; panel suave
(`--color-superficie-suave`, sin borde, `--radius-lg`, `--space-4`) con el
comprado histórico; lista de contacto con filas separadas por
`--color-linea-suave`; y abajo `Editar` + un `.btn-icono` de `⋯`.

Contenido: tabs Catálogo / Historial, chips de filtro, y las filas de compra con
el cuadradito de fecha de 48px (`--radius-md`, día en `--text-lg` / 700 y mes en
`--text-2xs` / 600 / **uppercase** — es la única mayúscula que sobrevive en la v5).

**Los botones Editar y Eliminar de cada producto pasan a íconos en hover**
(con la regla de `@media (hover)` + `:focus-within` del prompt 4), y **Eliminar
el proveedor se va adentro del menú `⋯`**. Los 7 filtros del historial pasan a
chips en una sola línea.

## PROMPT 14 — Proyecto · Fases (variante 4b)

**Diseño:** `docs/MODALSUIUXChange/HS Proyecto.dc.html`, `id="4b"` ("Línea de tiempo")
**Archivos:** `components/proyectos/Fases.{jsx,css}`

Fila con índice circular de 32px y 4 columnas, con "Presupuesto usado" arriba.
**Las fases cerradas se atenúan (`opacity: .75`), no se tachan** — está explícito
en la nota del diseño. Editar, borrar y reordenar aparecen al pasar el mouse, con
la regla de `@media (hover)` + `:focus-within`.

`.fases-tabla-orden-btn` tiene radio de 2px, el único fuera del sistema:
pasalo a `--radius-xs`.

## PROMPT 15 — Proyecto · Análisis general (variante 4d)

**Diseño:** `HS Proyecto.dc.html`, `id="4d"` ("Resultado primero + cascada horizontal")
**Archivos:** `components/proyectos/AnalisisGeneral.{jsx,css}`,
`AnalisisGraficos.jsx`, `constants/colores.js`

Abre con la **ganancia neta grande** y después la cascada en barras horizontales
etiquetadas. En la cascada: **lo que suma en oliva, lo que resta en gris claro,
los subtotales en negro**, y el valor **escrito sobre cada barra** — no se
depende del tooltip para leer el número.

**Acá hay que rehacer `PALETA_GRAFICOS`.** Hoy tiene un violeta `#7c3aed` y un
cian `#0891b2` que no existen en ningún otro lugar del sistema. La salida no es
inventar colores sino una **rampa monocroma del oliva más los grises cálidos**,
que además es lo correcto para series sin orden semántico. Propuesta en
DESIGN.md §2, **sin validar**: mirala contra una torta real y ajustá.

Ojo: el violeta `#6b21a8` del semáforo (auditada) **no** es el violeta de los
gráficos. No los confundas.

## PROMPT 16 — Proyecto · Seguimiento (variante 4f)

**Diseño:** `HS Proyecto.dc.html`, `id="4f"` ("Lista por urgencia con acción")
**Archivos:** `components/proyectos/Seguimiento.{jsx,css}`

Una sola lista **ordenada por urgencia**, con 3 KPIs arriba (Por pagar / Por
cobrar / Sin comprobante) y 5 columnas por fila. **Cada ítem lleva su acción
para resolverlo ahí mismo** (`Registrar pago`, `Registrar cobro`,
`Marcar entregado`, `Adjuntar`) — ése es el criterio de la variante, no es
decoración.

## PROMPT 17 — Fase · Acciones (variante 4h)

**Diseño:** `HS Proyecto.dc.html`, `id="4h"` ("Lista + panel de la fase")
**Archivos:** `components/fases/AccionesFase.{jsx,css}`, `pages/FaseDetalle.*`

Lista de movimientos a la izquierda y **panel fijo de 288px a la derecha** con el
resumen y los pendientes de la fase (a pagar, sin entregar, falta factura).
`grid-template-columns: minmax(0,1fr) 288px`.

**Reusá la tabla del prompt 6**: es el mismo `LibroDeObra`. Los botones negro y
verde de hoy pasan a uno principal (`Nueva compra`) y dos secundarios.

En una fase el acumulado **no es un "saldo"** — el `saldoLabel` ya se ajusta
desde el call site. No lo rompas.

---

# FASE D — Modales de alta

## PROMPT 18 — Los modales de alta

**Diseño:** `docs/MODALSUIUXChange/HS Modales.dc.html`, variantes `5a`–`5f`
**Archivos:** `components/modals/ModalShell.*`, `modal-base.css`,
`ModalGasto.jsx`, `ModalCobro.jsx`, `ModalFase.jsx`, `ModalProyecto.jsx`,
`ModalCompra.jsx`, `ModalProducto.jsx`, `ModalProveedor.jsx`,
`ModalCategoria.jsx`, `ModalConfirmar.*`, `CamposCotizacion.*`

**Son 14 modales: hacelos de a uno y commiteá por grupo**, no todos en un commit.
Orden sugerido: `ModalShell` + `modal-base.css` primero (la forma), después los
chicos, y `ModalCompra` al final.

**Anchos: tres, y cierra un pendiente viejo** (había cinco: 440, 620, 660, 860,
900).

| Ancho | Cuándo |
|---|---|
| **560px** | Todo alta y edición: gasto, cobro, fase, proyecto, producto, proveedor, categoría, confirmación |
| **760px** | Carga en pasos — sólo Nueva compra |
| **960px** | Formulario con riel de resumen de 300px |

Los cuatro chicos del diseño venían en 560/560/520/560: **se unifican en 560**.
Que "Nueva fase" sea 40px más angosta porque tiene menos campos no es información
para el usuario.

**Estructura común:** overlay `rgb(0 0 0 / 55%)` z-index 1000, caja
`--radius-xl` + `--shadow-modal`, **alto variable `max-height: 88vh`** con el
cuerpo en `flex: 0 1 auto`, header 64px con `border-bottom`, cuerpo
`--space-6` con gap `--space-5`–`--space-7`, pie `--space-4 --space-6` con
`border-top` y acciones a la derecha.

**El borde superior de 4px en oliva se retira**: con radio de 14px una franja de
color arriba corta la curva.

**Header:** cuadradito 32px (`--radius-md`, fondo `--color-base-2`) con el ícono
del tipo de operación, título `--text-xl` / 700, y **el contexto del proyecto a
la derecha del título**, separado por `border-left` + `padding-left: --space-3`,
en `--text-sm` muted con su ícono.

**El proyecto deja de ser un campo deshabilitado** y pasa al header. Un campo que
no se puede editar le pide al usuario que lo lea como si fuera una decisión suya.

**El comprobante va primero**, arriba de los campos, y "Autocompletar con IA"
**al lado del archivo** — no en la toolbar ni en el pie: el botón necesita el
archivo para funcionar. Zona vacía: alto 52px, `1px dashed`, `--radius-lg`, clip
en oliva. Con archivo: fila con ícono en cuadradito blanco, nombre + tipo/peso,
el botón de IA (`.btn-marca`) y una `×`.

**Nada de switches ni desplegables para elegir entre pocas opciones.** Tipo de
factura, condición de pago y los estados pasan a **controles de opción**
(DESIGN.md §9): segmentado para 2–3 excluyentes, `.chip--opcion` para 4–6. Con 6
opciones o menos **se muestran todas**. Un desplegable esconde y cuesta dos
clicks; un switch miente sobre que hay dos estados simétricos.

**El monto lleva la moneda adentro** como prefijo tenue y la conversión **al
lado, dentro de la misma caja**, en `--text-xs` muted, actualizándose mientras se
escribe. Debajo, como hint: `Dólar blue $ 1.450 del 01/10 · cambiar`.

### Nueva compra: el híbrido 5ab

De los dos diseños (5a "formulario + riel", 5b "3 pasos") va un mix:

- **Shell de 5b**: 760px, 3 pasos con barritas de progreso de 3px arriba del
  label de cada paso.
- **Alto variable** `max-height: 88vh` (en 5b el frame está en 880px fijo y deja
  un hueco muerto entre el último campo y el pie).
- **Chips de 5a**: *Tipo de factura* y *Condición de pago* quedan **visibles y
  clickeables** como `.chip--opcion` en el paso que les toca. **No** se colapsan
  detrás de un link *Editar* como hace 5b: son dos decisiones de una sola vez, y
  esconderlas para ahorrar alto en un modal que ahora se encoge solo no compra
  nada.
- **Pie en dos niveles**: el desglose (`Neto $ … · impuestos $ … · ≈ US$ …`) en
  su propia fila sobre `--color-superficie-suave`, y abajo el total en
  `--text-2xl` / 700 / tabular-nums a la izquierda con los botones a la derecha.
  En 5b el total de 22px y su subline de 12px se peleaban en una barra de 14px de
  padding.

El total **nunca se pierde de vista**: el pie es fijo.

**Teclado, obligatorio en todos.** `useModal(onCerrar, deshabilitado)` resuelve
Escape (y no cierra mientras guarda), foco atrapado, foco inicial en el diálogo y
foco restaurado al abridor. Con `role="dialog"` + `aria-modal="true"` le estás
prometiendo al lector de pantalla que el resto quedó inerte; **sin el trap esa
promesa es falsa**. No declares uno sin el otro. Un modal abierto desde otro usa
`capaSuperior` para subir el z-index a 1100.

---

# FASE E — Lo diferido

## PROMPT 19 — Saldo de la obra + gráfico de 5 meses

**Diseño:** `Movimientos v2.dc.html`, el bloque de arriba de la tabla
**Archivos:** `components/proyectos/Acciones.*`, backend si hace falta

Lo único del rediseño que necesita trabajo de **datos**, no de estilo. No existe
hoy en la app.

- Saldo de la obra en `--text-3xl` / 700 / ls -0.02em / tabular-nums, con
  "Cobrado US$ X · Gastado US$ Y en los últimos N meses" en `--text-base` muted.
- Selector de período a la derecha (`.btn` con fondo `--color-base-2`).
- Gráfico de barras por mes: **cobros en oliva, compras y gastos en gris claro**,
  barras de 28px con `border-radius: 3px 3px 0 0`, grid horizontal en
  `--color-linea-suave`, eje inferior en `--color-gris-claro-marca`, labels del
  eje Y en `--text-xs` tenue tabular-nums. Leyenda abajo con cuadraditos de 10px.

Necesita **agregación mensual**: mirá si el backend ya la expone (los endpoints
de proyecto / reportes) antes de calcularla en el cliente sobre todos los
movimientos.

Respetá el modelo de moneda de la decisión 6: egresos en pesos con equivalente en
dólares, cobros en dólares.

## PROMPT 20 — Renombre de tokens · ÚLTIMO

**Leé:** DESIGN.md §20
**Archivos:** los 53 `.css`, `constants/colores.js` y los `.jsx` que usen las
constantes

**Commit propio, SIN ningún cambio de valor.** Es un find-replace mecánico y el
diff tiene que ser legible: si mezclás un cambio de valor, nadie va a poder
revisarlo.

| Hoy | Debería ser |
|---|---|
| `--color-terracota*` | `--color-oliva*` |
| `--color-musgo*` | `--color-exito*` |
| `--color-arcilla*` | `--color-atencion*` |
| `--color-oxido*` | `--color-error*` |
| `--color-acero*` | *(se borra; pasa a `--color-tinta-muted`)* |
| `--color-base-1` | `--color-superficie-suave` *(ya es el mismo valor)* |
| `--color-base-2` | `--color-relleno` |
| `--color-gris-claro-marca` | `--color-linea-fuerte` |
| `AZUL` (en `colores.js`) | `NEUTRO` — **no es azul**, es el gris de los subtotales |
| `VERDE` | `EXITO` |
| `NARANJA` | `ATENCION` |
| `ROJO` | `ERROR` |

Decidí también qué pasa con **`--text-btn`**, que hoy es un alias exacto de
`--text-sm`: o se colapsa, o se documenta para siempre como marcador semántico de
"este texto es de un control". No lo dejes a medio camino.

Y con **`--font-display` vs `--font-ui`**, que son la misma familia y no producen
ninguna diferencia visual: o se le da una fuente distinta a display, o se
colapsan en un token.

**Verificá con los dos canarios y con `npm test`.** Si los dos dan cero y los
tests están verdes, el renombre está completo.

---

## Lo que NO tiene diseño

**Catálogos, Comparador, Cuentas, Libro de Obra (la vista), Manager y Auth.**
Heredan los tokens y quedan coherentes de arriba, pero su layout no está
rediseñado. Cuando los toques, el criterio es DESIGN.md §0: **borde y peso, no
fondo y sombra.** No inventes una variante nueva: mirá qué pantalla rediseñada se
parece más y seguila.

## Decisiones que quedaron abiertas

Anotadas para que no se tomen por omisión:

1. **El azul `#1d4ed8` de `en_curso` no se validó en pantalla.** Entró en la
   pieza 0b con contraste verificado (5.71:1 sobre su tint) pero sin que nadie lo
   mirara en contexto. Si se siente ajeno a la marca, la alternativa evaluada es
   el teal `#0e7490`, que queda más cerca del oliva sin volver a confundirse con
   el verde de `terminado`. Es un cambio de una línea en `constants/colores.js`.
2. **`docs/HomeSolutionsMobile.zip` (5.4 MB)** está borrado en el working tree.
   Si la eliminación es a propósito, que vaya en su propio commit y no mezclada
   con el rediseño.
3. **El h1 del header de proyecto quedó en 24px** contra los 28px del diseño. Si
   en pantalla se ve chico, se sube a 28 **y se actualiza la jerarquía de
   DESIGN.md §3** — no se deja la excepción sin documentar.
