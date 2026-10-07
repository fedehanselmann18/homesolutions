# Plan de ejecución — rediseño UI/UX v5

Compañero de `docs/DESIGN.md`. Ese documento dice **qué** tiene que quedar; éste
dice **en qué orden, en qué archivos y cuándo una pieza está terminada**.

> **Leer `docs/DESIGN.md` completo antes de tocar la primera línea.** Este plan
> no repite los valores del sistema: los referencia por sección (§2 color, §7
> radios, etc.). Si una instrucción de acá y una de DESIGN.md se contradicen,
> gana DESIGN.md y se anota la contradicción al final de este archivo.

---

## Reglas de ejecución

1. **Una pieza por commit.** Cada pieza de abajo es un commit que se puede
   revertir solo. No encadenar dos piezas "porque total es lo mismo".
2. **Mirar la app entre pieza y pieza.** El punto de ir de a poco es ver el
   resultado, no llegar rápido al final.
3. **No tocar lo que la pieza no nombra.** Si al hacer la pieza 2 ves algo feo
   en Catálogos, se anota en "Hallazgos" al final — no se arregla de paso.
4. **Ningún hex ni tamaño literal.** Los dos canarios de DESIGN.md §1 tienen que
   seguir dando cero al final de cada pieza.
5. **Los tests tienen que quedar verdes.** Hay tests que afirman sobre clases y
   textos (`LibroDeObra.test.jsx`, `modales.test.jsx`, `ChipsCategorias.test.jsx`,
   `Catalogos.test.jsx`). Si una pieza cambia una clase que un test busca, se
   actualiza el test **en el mismo commit**, no después.
6. **Los commits los hace Fede.** `device_bash` no puede correr git de escritura
   en este repo (deja `.git/index.lock` trabado).

---

## Decisiones ya tomadas

Cerradas el 07/10/2026. No volver a abrirlas sin decirlo.

| # | Decisión |
|---|---|
| 1 | **Sidebar blanco**, con borde derecho e item activo en oliva. Los `--color-oscuro-*` quedan sólo para el login. |
| 2 | **Fondo de página blanco.** La separación la hacen los bordes, no los fondos ni las sombras. |
| 3 | **Paleta = 5 colores del manual + rampa derivada + 2 accents funcionales.** Se retiran `--color-musgo` (#16a34a) y `--color-acero` (#64748b): no están en el manual. |
| 4 | **Escala tipográfica recalibrada a los px del diseño, en rem.** Mismos nombres de token, valores nuevos. |
| 5 | **Los filtros de lista son chips, no tabs.** El subrayado oliva de 2px queda reservado a navegación de sección. Precedente: variante 4L. |
| 6 | **Moneda:** gastos y compras se cargan y se muestran **en pesos**, con su equivalente en dólares como complemento chico. Cobros y `precio_acordado_usd` van **en dólares**. La columna de saldo del libro va **en pesos nominales** (decisión #5 de `PLAN_TIPO_CAMBIO.md`), titulada `Saldo $`. |
| 7 | **Modal de detalle:** geometría de HS Modales (radio 14 / header 64 / botones h38), estructura de contenido de Movimientos v2. Header claro, no oscuro. |
| 8 | **El bloque de saldo + gráfico de 5 meses se difiere.** El piloto es 100% restyle. |

---

## Orden de las piezas

| # | Pieza | Archivos | Tipo | Estado |
|---|---|---|---|---|
| **0** | Tokens | `index.css`, `colores.js` | valores | **hecha** 07/10 (sin commitear) |
| **1** | Header de proyecto + Tabs | `ProyectoDetalleHeader.*`, `Tabs.*`, `estados.js` | **piloto** | **hecha** 07/10 (prompts 1–3) |
| **2a** | Tabla de movimientos | `LibroDeObra.*` | restyle | pendiente |
| **2b** | Filtros a chips | `FiltrosSegmentados.*` | restyle | pendiente |
| **2c** | Panel de filtros | `FiltrosLista.*` | restyle | pendiente |
| **2d** | Modales de detalle | `ModalDetalle*.jsx`, `PiezasDetalle.jsx`, `ModalDetalle.css` | restyle | pendiente |
| **3** | Sidebar blanco | `Sidebar.*`, `MainLayout.*` | estructural | pendiente |
| **4+** | Resto | ver cola al final | | |

**Por qué el header es el piloto y no Acciones.** Acciones es la página menos
contenida de la app: arrastra `LibroDeObra` (3 usos), `FiltrosSegmentados` (5),
`FiltrosLista` (3) y los `ModalDetalle*` (7 call sites). El header son 91 líneas,
está especificado completo y standalone en `HSProyectoHeader.dc.html`, y lo
comparten las 4 tabs del proyecto. Si el set de tokens no alcanza, conviene
descubrirlo ahí.

---

## Pieza 0 — Tokens

**Archivos:** `frontend/src/index.css`, `frontend/src/constants/colores.js`
**No tocar ningún componente.**

Es un cambio de valores más tokens nuevos. Después de este commit la app entera
cambia de paleta y de escala **sin que cambie una sola estructura**. Es el 70%
del rediseño visual en un commit reversible.

### Valores que cambian

Ver DESIGN.md §2 (color), §3 (escala), §7 (radios y sombras) para la tabla
completa y el porqué de cada uno. Resumen de lo que se repunta:

- `--color-tinta` → `#000000`, `--color-tinta-muted` → `#5a5a58`
- `--color-linea` → `#e6e4df`, `--color-base-2` → `#f3f2ee`
- `--color-terracota-dark` → `#4f5b30`, `--color-terracota-tint` → `#eef0e3`
- `--color-musgo*` → apuntan al par oliva (el token sigue existiendo para no
  romper sus 17 usos; el nombre se borra en el renombre de DESIGN.md §20)
- `--color-acero*` → apuntan a `--color-tinta-muted`
- Los diez pasos de `--text-*`, según la tabla de §3
- `--shadow-overlay` → `0 12px 32px rgba(24,24,27,.16)`

### Tokens nuevos

```css
/* color */
--color-tinta-tenue: #8c8b86;
--color-superficie-suave: #f9f8f6;
--color-linea-suave: #efeee9;
--color-terracota-sel: #f1f2ea;
--color-arcilla-tint: #fef3e2;     /* repuntar: hoy es #fdf0dc */
--color-oxido-tint: #fdecea;       /* repuntar: hoy es #fbe2e2 */
--color-oxido-texto: #b42318;      /* nuevo: no existía */
--color-ia-borde: #d6dbbf;         /* borde del botón de marca */

/* espaciado */
--space-5: 20px;
--space-7: 28px;
--space-9: 36px;
--space-10: 40px;
--space-card: 18px;

/* geometría */
--radius-xs: 4px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 14px;
--shadow-hover: 0 4px 16px rgba(0, 0, 0, 0.05);
--shadow-modal: 0 24px 64px rgba(0, 0, 0, 0.22);
--shadow-foco: 0 0 0 3px #eef0e3;
```

`--color-base-1` **no se borra todavía** (28 usos): se repunta a `#ffffff` y el
borrado del nombre va con el renombre de §20. Repuntarlo a blanco es lo que pone
el fondo de página en blanco sin tocar `App.css`.

### `colores.js`

Mismos valores que los tokens, en el mismo commit — si no, el estado de las
fases y los gráficos quedan con la paleta vieja. Cambian `VERDE`, `AZUL`, `GRIS`,
`TINTA_MUTED`, `LINEA`, `OLIVA_TINT`, `NARANJA`.

**`PALETA_GRAFICOS` queda para la pieza del gráfico**, no acá: tiene un violeta
y un cian que hay que reemplazar por la rampa monocroma propuesta en DESIGN.md §2,
y eso quiere mirarse contra una torta real.

### Terminado cuando

- [ ] Los dos canarios de §1 dan cero.
- [ ] `npm test` verde.
- [ ] La app se ve cálida de punta a punta, con el sidebar todavía negro (se
      arregla en la pieza 3) y sin ningún cambio de layout.
- [ ] Ningún valor de `--text-*` quedó sin repuntar: los títulos se ven más
      chicos que antes, no iguales.

---

## Pieza 1 — Header de proyecto + Tabs (piloto)

**Diseño:** `docs/GENERALUIUXChange/HSProyectoHeader.dc.html` (archivo completo,
vale leerlo entero: son 90 líneas y es el spec exacto).
**Archivos:** `components/proyectos/ProyectoDetalleHeader.{jsx,css}`,
`components/shared/Tabs.{jsx,css}`, `constants/estados.js`,
`pages/ProyectoDetalle.jsx`

### Anatomía

```
Proyectos / Edificio Olleros              ← breadcrumb, --text-sm, muted
                                             separador "/" en --color-gris-claro-marca
                                             último tramo --color-tinta / 500
  ↕ --space-2
Edificio Olleros   [En curso]             ← h1 + badge, gap --space-3
  ↕ --space-2
📍 Olleros 1925, CABA   📅 Desde el 10/03/2026   📚 Fase 3 de 4 · Montaje
                                          ← meta, --text-base, muted,
                                             íconos 15px, gap --space-1-5 --space-5,
                                             flex-wrap
  ↕ --space-5
[📚 Fases] [🔀 Acciones] [📊 Análisis] [🔔 Seguimiento 8]
                                          ← tabs, ver abajo
─────────────────────────────────────────  ← border-bottom 1px --color-linea
```

### Cambios respecto al código actual

| Hoy | v5 |
|---|---|
| `border-left: 4px solid estado.color` + `padding-left` | **se va.** El diseño no tiene regla izquierda; la identidad la da la tipografía. |
| h1 en `--text-2xl` / peso **600** | `--text-2xl` / peso **700** + `letter-spacing: -0.02em` |
| badge con `color-mix` inline + `borderColor` | par plano fondo/texto de §2, `--radius-xs`, **sin borde** |
| meta en un `<p>`: "{dirección} · Iniciado el {fecha}" | **tres items con ícono** (ver abajo) |
| `Tabs` recibe `{key, label}` | `Tabs` recibe `{key, label, icono, badge}` |

### Las tres cosas que no son sólo estilo

**1. `estados.js` tiene que devolver un par, no un color.** Hoy devuelve
`{ color, label, icono }` y el header arma el fondo con `color-mix`. El sistema
v5 usa pares planos fondo/texto. Hay que cambiar la forma del objeto a
`{ bg, fg, label, icono }` y actualizar a todos los consumidores de `getEstado`
y `getEstadoLabel`. **Buscarlos antes de empezar** — es el cambio de esta pieza
con más alcance fuera de los 4 archivos nombrados.

Mapeo nuevo, con los pares de DESIGN.md §2:

| Estado | Par | Antes era |
|---|---|---|
| `a_iniciar` / `por_empezar` | neutro | neutro ✅ |
| `en_curso` | **oliva (resuelto)** | ámbar (`NARANJA`) |
| `terminado` / `terminada` | **oliva** | verde `#16a34a` |
| `auditada` | neutro | azul `#64748b` (se retira) |

> **Ojo, esto es un cambio semántico, no estético.** Hoy "En curso" es ámbar y
> en el diseño es oliva. Eso significa que el ámbar deja de querer decir "está
> pasando" y queda sólo para "requiere atención" — que es lo que dice §2. Como
> efecto, `en_curso` y `terminado` pasan a compartir el par oliva y se
> distinguen por el label y el ícono, no por el color. Si eso no se quiere,
> decidirlo **antes** de esta pieza, porque toca el semáforo de toda la app.

**2. El meta necesita un dato que el header no recibe.** "Fase 3 de 4 · Montaje"
no está entre los props actuales (`proyecto`, `breadcrumb`). Dos salidas:
agregar un prop (`faseActual`, `totalFases`) desde `ProyectoDetalle.jsx`, que ya
tiene las fases; o shipear los dos primeros items y dejar el tercero para después.
**Preferir agregar el prop**: el dato existe y es el más útil de los tres.

También cambia la redacción: "Iniciado el 10/03/2026" → **"Desde el 10/03/2026"**.

**3. `Tabs` necesita ícono y badge.** Hoy sólo pinta `label`. El diseño tiene
ícono a 15px a la izquierda y un badge opcional de pendientes a la derecha
(`--text-2xs` / 700 / `line-height: 18px` / `min-width: 18px` / `--radius-pill`,
par de atención). `Tabs` lo usan proyecto **y** fase, así que los dos campos van
opcionales y la fase puede no pasarlos.

Geometría de la tab: alto 40px, `gap: --space-7` entre tabs,
`border-bottom: 2px` (oliva activa / transparent inactiva) con
`margin-bottom: -1px` para que tape la línea de 1px del contenedor. Activa:
`--color-tinta` / 600. Inactiva: `--color-tinta-muted` / 500.

### Desvío del diseño, anotado

`HSProyectoHeader.dc.html` dibuja el h1 en **28px**. Se usa **24px**
(`--text-2xl`), porque:

- DESIGN.md §3 reserva 28px (`--text-3xl`) para páginas de **listado** y 24px
  para páginas de **detalle**, y un proyecto es detalle.
- La variante **4p** (Proveedor detalle), que es la otra página de detalle
  diseñada, usa 24px. El 28px del header de proyecto es el outlier entre los dos.

Si al verlo en pantalla 24 queda chico para el proyecto, se sube a 28 y **se
actualiza la jerarquía de §3** — no se deja la excepción sin documentar.

### Terminado cuando

- [ ] El header se ve como `HSProyectoHeader.dc.html` en las 4 tabs del proyecto.
- [ ] No quedó ningún `color-mix` en el header.
- [ ] `getEstado` devuelve pares y **todos** sus consumidores están actualizados.
- [ ] Las tabs de fase siguen funcionando sin ícono ni badge.
- [ ] Teclado: las tabs mantienen `role="tablist"` / `role="tab"` /
      `aria-selected`, y el foco cae en la regla global de §16.
- [ ] Mobile a 640px: el título y el badge se apilan, el meta hace wrap.
- [ ] **El informe del piloto**: anotar en "Hallazgos" qué token faltó, qué
      valor del spec no cerró y qué hubo que inventar. Eso es el verdadero
      entregable de esta pieza.

---

## Pieza 2 — Acciones de un proyecto

**Diseño:** `docs/GENERALUIUXChange/Movimientos v2.dc.html`, variante `3a`.
Trae tres cosas: la tabla desktop, el modal de detalle y la versión mobile de
375px. El archivo `Movimientos.dc.html` (variantes 1a–2b) **es material
descartado**: paleta vieja fría. No mirarlo.

`Acciones.jsx` (484 líneas) es casi toda orquestación — estado, handlers,
modales. **No hay nada visual que cambiar ahí.** Lo visual está en las cuatro
sub-piezas de abajo.

### 2a — `LibroDeObra`

**Archivos:** `components/proyectos/LibroDeObra.{jsx,css}`, `LibroDeObra.test.jsx`

**Es restyle, no rebuild.** El componente ya hace todo lo estructural que muestra
el diseño: agrupación por día con subtotal (`libro__dia`), saldo acumulado
calculado del más viejo al más nuevo, totales por tipo, y la grilla ya está
parametrizada en `--libro-cols`.

Lo que cambia:

| Parte | v5 |
|---|---|
| `libro__cabecera` (título + leyenda de totales con puntos) | **se va.** El título lo da la página; los totales por tipo pasan al contador de cada chip de filtro (2b). |
| Contenedor | sin borde ni radio (DESIGN.md §11: la planilla pierde su caja) |
| Header de columnas | alto 36px, `--text-xs` / 600 / muted, sin fondo |
| Separador de día | alto 36px, fondo `--color-superficie-suave`, borde arriba y abajo en `--color-linea`, label 600 + subtotal muted a la derecha |
| Fila | `padding: 14px --space-2`, `border-bottom: 1px --color-linea-suave`, hover `--color-superficie-suave`, `align-items: start` |
| Fila seleccionada | fondo `--color-terracota-sel` |
| Tipo | cuadradito 28px, `--radius-sm`, fondo `--color-base-2`, ícono 15px en muted |
| Movimiento | título `--text-md` / 600; abajo contexto con íconos de 13px (fase, proveedor) + meta en muted |
| Estados de pago/envío | **badges** del par que corresponda, con ícono a 12px, apilados |
| Comprobante | una columna de 28px con el ícono: clip en `--color-tinta-tenue` si está adjunto, alerta en `--color-arcilla` si falta |
| Importe | `--text-md` / 700 + la moneda al lado en `--text-xs` / 500 / tenue; debajo el equivalente en muted |
| Saldo | `--text-base` / muted, a la derecha, **en pesos**, columna titulada `Saldo $` (decisión 6) |
| Pie | `{n} resultados` a la izquierda + paginación a la derecha, botones h28 |

Columnas del diseño: `28px minmax(0,1fr) 168px 28px 168px 104px`, `gap: --space-5`.

**Las acciones de fila** (editar, borrar, nota) siguen la regla de DESIGN.md §8:
visibles siempre en touch, en hover sólo con `@media (hover: hover) and
(pointer: fine)`, y con `:focus-within`. **No copiar el hover del diseño sin eso.**

### 2b — Filtros a chips

**Archivos:** `components/shared/FiltrosSegmentados.{jsx,css}`

Hoy `FILTROS_TIPO` es `Todo / Compras / Gastos / Cobros` como segmentado. Pasa a
los **chips de la variante 4L**: pill, borde `--color-linea`, fondo blanco;
activo con borde `--color-terracota` + fondo `--color-terracota-sel` + peso 600;
**con el contador adentro** en `--text-xs` / tenue.

El diseño agrega un cuarto filtro, **"Con alertas"**, que hoy no existe: cuenta
los movimientos con comprobante faltante, pago pendiente o sin entregar. La
lógica ya está disponible en la fila (el ícono de alerta se calcula). Vale
agregarlo.

**Cuidado:** `FiltrosSegmentados` lo usan además `Dashboard`, `Proyectos` y
`SelectorMoneda`. Si el chip no les sirve a los tres, **se agrega una variante**
(`<FiltrosSegmentados variante="chips">`), no se forkea el componente.

### 2c — Panel de filtros

**Archivos:** `components/shared/FiltrosLista.{jsx,css}`

El diseño lo reemplaza por dos botones secundarios de h28 (`Filtrar`,
`Exportar`) a la derecha de la fila de chips. El panel desplegable queda, con los
campos a `.campo` de §9 y los filtros aplicados mostrados como
`.chip--quitable`.

`Exportar` **no existe en el backend**: si no hay endpoint, el botón no se pone.
No shipear un botón que no hace nada.

### 2d — Modales de detalle

**Archivos:** `components/modals/ModalDetalle{Compra,Gasto,Cobro}.jsx`,
`PiezasDetalle.jsx`, `ModalDetalle.css`

Geometría de DESIGN.md §14 (decisión 7): radio 14, header **claro** de 64px,
pie con botones h38, ancho **560px**. Estructura de contenido de Movimientos v2:

1. **Cabecera del movimiento**: título a la izquierda (`--text-xl` / 700) con sus
   badges debajo; a la derecha el importe en `--text-2xl` / 700, el equivalente
   en muted y la cotización usada en tenue.
2. **Banda de faltante** (si falta el comprobante): fondo
   `--color-arcilla-tint`, `--radius-md`, con el botón `Adjuntar` a la derecha.
3. **Detalles**: grid de 3 columnas, cada campo con label `--text-xs` / muted
   arriba y valor `--text-base` / 500 abajo, con punto de color donde hay estado.
4. **Productos** (si tiene): filas con nombre / ×cantidad / total, y abajo a la
   derecha un bloque de 260px con Neto / IVA / **Total** en 700.
5. **Archivos**: fila con cuadradito de ícono, nombre + uuid en tenue, y botón
   de descarga.
6. **Pie**: `Borrar` como ghost **a la izquierda** (hover a `--color-oxido`),
   `Editar` secundario y la acción primaria a la derecha.

**El header oscuro se retira acá.** Es el cambio que permite colapsar
`ModalDetalle.css` (517 líneas) contra `modal-base.css`, que es un pendiente
viejo de la v4. Hacerlo en esta pieza o anotarlo, pero no dejarlo invisible.

**7 call sites** — probar los tres modales desde: Acciones, AccionesFase,
Seguimiento, SeguimientoFase, FaseDetalle, ProveedorDetalle, ModalCompra.

### Terminado cuando

- [ ] Acciones de un proyecto se ve como la variante `3a` de `Movimientos v2`,
      sin el bloque de saldo + gráfico (diferido, decisión 8).
- [ ] La fase (`AccionesFase`) y la ficha de proveedor siguen enteras: usan el
      mismo `LibroDeObra`.
- [ ] Los 3 modales de detalle funcionan desde los 7 call sites.
- [ ] `LibroDeObra.test.jsx` y `modales.test.jsx` verdes.
- [ ] Mobile 640px: la fila colapsa como la versión de 375px del diseño
      (título + importe arriba, contexto, badges abajo), no con scroll horizontal.

---

## Cola — piezas siguientes

En orden sugerido. No empezar ninguna antes de cerrar la 2.

| Pieza | Diseño | Nota |
|---|---|---|
| Sidebar blanco | `HSSidebar.dc.html` | 232px. Spec completo en DESIGN.md §13. |
| Panel | `HS General` 4i | |
| Lista de proyectos | `HS General` 4L | Cards. Precedente de los chips. |
| Lista de proveedores | `HS General` 4N | |
| Proveedor detalle | `HS General` 4P | Ficha lateral de 272px. |
| Proyecto · Fases | `HS Proyecto` 4b | Línea de tiempo. |
| Proyecto · Análisis | `HS Proyecto` 4d | Cascada horizontal. Toca `PALETA_GRAFICOS`. |
| Proyecto · Seguimiento | `HS Proyecto` 4f | Lista por urgencia. |
| Fase · Acciones | `HS Proyecto` 4h | Panel lateral de 288px. Reusa la tabla de 2a. |
| Modales de alta | `HS Modales` 5ab, 5c–5f | 14 modales. Ir de a uno. |
| Saldo + gráfico | `Movimientos v2` | Diferido de la pieza 2. Necesita agregación mensual. |
| Renombre de tokens | DESIGN.md §20 | Commit propio, sin ningún cambio de valor. |

**Sin diseño, heredan sólo los tokens:** Catálogos, Comparador, Cuentas, Libro de
Obra (la vista, no la tabla), Manager, Auth. Cuando se toquen, el criterio es
DESIGN.md §0: borde y peso, no fondo y sombra.

---

## Hallazgos

Lo que se aprende ejecutando y no estaba previsto. **Anotar acá en vez de
arreglarlo de paso.**

| Fecha | Pieza | Hallazgo |
|---|---|---|
| 07/10 | 0 | **`--color-base-1` cargaba dos roles**, no uno: fondo de página (`body`, `MainLayout`) y superficie suave (header de planilla, hover de fila, buscador, pies de modal, 8 cards). Repuntarlo a blanco como decía el plan habría borrado el segundo rol. Quedó en `#f9f8f6`, que es el valor v5 correcto para los 26 de 28 usos; el fondo de página queda un pelo cálido hasta la pieza 3, donde se toca el shell igual. |
| 07/10 | 0 | **`PALETA_GRAFICOS` se rompía sola** al repuntar `VERDE` al oliva: `OLIVA` y `VERDE` pasaban a ser el mismo hex y la serie quedaba con dos tramos de color idéntico. Se reemplazó ese tramo por `OLIVA_CLARO`. El rework completo (sacar el violeta y el cian) sigue pendiente para la pieza del gráfico. |
| 07/10 | 0 | **Los tests no corren desde el shell del entorno**: `node_modules` está instalado para darwin-arm64 y el shell corre en Linux, así que falla el binario nativo de rollup (`MODULE_NOT_FOUND` en `rollup/dist/native.js`). Hay que correrlos en la máquina. Como sustituto se verificó: llaves balanceadas, 77 declaraciones en `:root` bien formadas, cero tokens duplicados y cero `var()` sin definir en los 53 `.css`. |
| 07/10 | 0 | **Ningún test de la app afirma sobre color, hex ni `toHaveStyle`.** Los cambios de token tienen riesgo de test nulo; lo que puede romper tests es la pieza 3 (utilidades), que sí cambia clases. |
| 07/10 | 0b | **La regla de color de DESIGN.md §2 estaba mal para los estados.** "5 de marca + rampa + 2 accents" dejaba a `en_curso` y `terminado` compartiendo el oliva, o sea un semáforo que no semaforea. El semáforo es **funcional, no de marca**: pasa a 6 posiciones con tonos bien separados — sin empezar gris, **en curso azul `#1d4ed8`**, terminado verde `#15803d`, **auditada violeta `#6b21a8`**, atención ámbar, problema rojo. Los seis pares dan ≥4.5:1 sobre su tint y ≥6:1 sobre blanco. Enmienda §2. |
| 07/10 | 0b | **El ícono de estado es estructural, no decorativo.** Las seis luminancias del semáforo caen entre 0.07 y 0.12: los estados se distinguen por tono y no por claridad, así que con deuteranopia verde y rojo quedan casi iguales. Nunca un badge de estado sin su ícono. |
| 07/10 | 0b | **`VERDE` no era sólo "terminado"**: es la semántica financiera de positivo / entrada / cobrado en Dashboard, AnalisisGeneral, TablaProyectos, Seguimiento, ProveedorCard y ProveedorDetalle. Por eso no se unificó al oliva. Sí se oscureció de `#16a34a` a `#15803d`: se usa como color de TEXTO y `#16a34a` daba 3.30:1 sobre blanco, por debajo del mínimo. |
| 07/10 | 0b | **`AZUL` no era azul y no se repuntó.** Era `#64748b` y nunca se usó como el azul del estado, sino como NEUTRO: el subtotal de la cascada del análisis, un relleno de barra y un tipo de movimiento. Repuntarlo al azul del semáforo habría pintado todo eso de azul brillante. Queda como el gris cálido que ya era en la práctica; el nombre va a la lista de renombre de §20. |
| 07/10 | 0b | **El semáforo estaba duplicado a mano en dos componentes**, con la misma copia (`terminada/auditada → VERDE, en_curso → NARANJA`) en `Fases.jsx:28` y `TablaProyectos.jsx:13`. Al mover `en_curso` a azul, el estado habría quedado azul en el header y naranja en las dos tablas. `Fases.colorFase` ahora deriva de `ESTADO_LABELS` en vez de remapear. Es exactamente lo que la Regla Principal de DESIGN.md viene a evitar: **buscar copias del semáforo antes de tocarlo**. |
| 07/10 | 0b | **`TablaProyectos.colorSegmentoFase` no era el semáforo**: es la barra de PROGRESO de fases, y usaba VERDE/NARANJA, con lo cual la barra parecía decir "esta fase tiene un problema" cuando sólo decía "ésta es la que se está haciendo". Pasa a la rampa de progreso de §2 (completado oliva claro, actual oliva, pendiente línea), que es lo que dibuja 4L. **Estado ≠ progreso**; conviene revisar esa confusión en cada barra de la app. |
| 07/10 | 0 | **El spec no tenía `--color-oxido-texto`** (`#b42318`) y los diseños lo usan en todo mensaje de error de campo y badge de deuda. Agregado. También se agregó `--color-ia-borde` (`#d6dbbf`) para el botón de marca, que en la v4 era contorno oliva y en la v5 es relleno en tint. |
| 07/10 | 1 (estados) | **Consumidores de `getEstado` / `getEstadoLabel` / `ESTADO_LABELS`: ninguno fuera de la lista** (`ProyectoDetalleHeader`, `Fases`, `FaseDetalle`, `utils/analisis.js`), verificado con grep. `FaseDetalle` y `analisis.js` no necesitaron cambios: el primero ya recibía la forma completa salvo con un estado desconocido (el bug de `getEstadoLabel`, arreglado en `estados.js`), y el segundo sólo lee `color` y `label`. `Fases.jsx` cambió su fallback armado a mano por `getEstadoLabel`. Un estado desconocido sale con el par neutro y **`icono: null`**: el reloj de "a iniciar" afirmaría algo que no sabemos. |
| 07/10 | 1 (estados) | **Los badges de estado de `Fases.jsx` y `FaseDetalle.jsx` siguen armando su fondo** con `` `${color}${TINTE_PASTILLA}` `` (alfa, no `color-mix`), y el de `FaseDetalle` además lleva `borderColor: ${color}55`. No se migraron a `bg`/`fg` para que este commit sólo cambie el badge del header; el par ya está disponible y migrarlos es cambiar dos `style`. Al hacerlo, el texto de "Terminada" pasa de `#15803d` a `#11672f`. |
| 07/10 | 1 (estados) | **Hay una tercera copia del semáforo, en CSS**, que el grep de `getEstado` no encuentra: `TablaProyectos.css`, `.panel-tabla-grupo--{en_curso,a_iniciar,terminado}` (cabecera de grupo de la vista "Todos" de Proyectos). Pinta en curso **verde** (`--color-musgo`, label `--color-terracota-texto`), a iniciar **ámbar** y terminado **acero**: contradice a `estados.js` en las tres posiciones. Además los labels de estado están duplicados a mano en `ModalProyecto.jsx:8`, `ModalFase.jsx:6`, `Proyectos.jsx:25` (con "Terminados" en plural) y `Dashboard.jsx:43`. Ninguno se tocó. |
| 07/10 | 2 (tabs) | **El `margin-bottom: -1px` del spec no sobrevive al `overflow-x: auto` de `.tabs`** (que es lo que las hace scrolleables en mobile). El overflow recorta en el borde del padding, así que el pixel de abajo de la línea activa se cortaba: quedaba 1px oliva sobre 1px gris en vez de 2px oliva, y además 1px de scroll vertical (medido: `scrollHeight` 40 vs `clientHeight` 39). Ya pasaba en la v4. La línea del contenedor pasó a `box-shadow: inset 0 -1px 0 --color-linea`: se pinta debajo de los hijos, el borde de 2px de la tab la tapa y nada se sale de la caja. Mismo resultado visual que el spec, sin el recorte. |
| 07/10 | 2 (tabs) | **El nombre accesible de una tab con badge es "Seguimiento8"**, sin espacio: el badge es texto pegado al label. Se lee bien en pantalla; para un lector de pantalla convendría un texto oculto ("8 pendientes"), pero la app **no tiene utilidad `.sr-only`**. Si aparece otro caso, vale crearla en `index.css`. |
| 07/10 | 2 (tabs) | Un `badge` en `0` no se pinta (decisión de componente, no del spec): "0 pendientes" no es un pendiente y el ámbar diría lo contrario. Sin ícono y sin badge, las tabs de fase y de Catálogos quedan iguales salvo la geometría (40px, gap 28, inactiva peso 500, activa en tinta en vez de oliva). |
| 07/10 | 3 (piloto) | **Informe del piloto — proporción CSS / JSX: ~45 / 55.** Del diff, 74 líneas son CSS (header + breadcrumb + tabs) y 113 JSX (header + página). Pero el JSX **no fue restyle**: fue dato nuevo (fase actual, contador de pendientes) y estructura semántica (`<p>` → `<ul>` de 3 ítems con ícono). El restyle puro fue casi todo CSS. **Para las piezas siguientes**: cuando el diseño muestra un dato que la pantalla no tiene, el trabajo se va al JSX y a los hooks; cuando sólo cambia la forma, es CSS. Conviene que cada prompt diga de antemano qué datos nuevos pide. |
| 07/10 | 3 (piloto) | **Ningún token faltó.** Todos los valores de `HSProyectoHeader.dc.html` cerraron contra tokens existentes (13→`--text-sm`, 14→`--text-base`, gaps 6/8/12/20/28→`--space-1-5/2/3/5/7`, `#d9d7d2`→`--color-gris-claro-marca`, `#8c8b86`→`--color-tinta-tenue`). La pieza 0 cubrió bien la paleta y la escala. |
| 07/10 | 3 (piloto) | **El badge de estado todavía es pill** después de esta pieza: la forma (`--radius-xs`, `line-height: 22px`, sin borde) es de `.badge` global y se cambia en el prompt 4. No se pisó con una regla local en el header para no tener dos recetas de badge. El ícono sí va (14px, `strokeWidth` 2 por ser ≤14px, DESIGN.md §17). |
| 07/10 | 3 (piloto) | **`Breadcrumbs.css` estaba fuera del spec y se tocó**, aunque el prompt no lo nombraba: separador en `--color-linea` (casi invisible) en vez de `--color-gris-claro-marca`, último tramo a 600 en vez de 500, y el espacio entre ítems salía de `margin: 0 2px` en el separador (2px de un lado, 6 del otro). Es un componente compartido por todas las páginas de detalle, así que el cambio llega también a fase y proveedor — que es lo que dice la Regla Principal. |
| 07/10 | 3 (piloto) | **El gap header → tabs es 20px (`--space-5`) en el diseño y `.tabs` traía `margin-top: --space-6`.** Se bajó en `Tabs.css` para todos los usos (proyecto, fase, Catálogos), no con un override en el header: misma navegación, misma distancia. |
| 07/10 | 3 (piloto) | **Ambiguo en el spec: qué es "la fase actual".** Se resolvió: la primera `en_curso` por `orden` → "Fase N de M · Nombre", con N = posición en la lista ordenada (no `fase.orden`, que puede tener huecos). Sin ninguna en curso no se inventa una: "4 fases terminadas" si todas están cerradas (terminada o auditada), "5 fases, ninguna en curso" si no. Sin fases, el ítem no se pinta. |
| 07/10 | 3 (piloto) | **El badge de Seguimiento sí se pasó**, aunque el contador no estaba en la página: `calcularSeguimiento().pendientes` ya existía "para el contador de la pestaña" (comentario en `utils/seguimiento.js`). `ProyectoDetalle` levanta fases, gastos, cobros y compras con las mismas query keys que usan las tabs (React Query las dedupea), así que el costo es adelantar 3 requests que la tab de Acciones hace igual. El número es exactamente el de adentro de Seguimiento, porque sale de la misma función. |
| 07/10 | 3 (piloto) | **`scripts/seed_demo.py` crea todas las fases con `orden = 1`** (el campo tiene `default=1` y el seed no lo pasa), así que la tabla de Fases de la demo numera todo "01". No es del rediseño y no se tocó; en la base local de verificación se renumeró a mano. Vale arreglarlo en el seed. |
| 07/10 | 4 (utilidades) | **`.label-ficha` no era sólo label de campo: en 5 de los 8 `.jsx` era el encabezado de columna** de una planilla (Proyectos, TablaProyectos, Fases, SeccionCatalogo, SeccionCotizaciones) y en LibroDeObra el de `.libro__columnas`. Pasarlos a `.label-campo` (13px / 500) los habría agrandado; el header de tabla es `--text-xs` / 600 (§11). La tipografía del encabezado pasó al contenedor (`.planilla__header` en index.css, `.libro__columnas` en LibroDeObra.css) y los `<span>` quedaron sin clase. `.label-campo` quedó para lo que sí es label: SelectFlotante, FiltrosLista (Desde/Hasta), "Ordenar por", los labels móviles de TablaProyectos y la leyenda Pago/Envío del libro. |
| 07/10 | 4 (utilidades) | **Los labels de los modales, de Auth y de Manager eran tres copias de la receta en mayúsculas** (`.modal-form label` en modal-base.css, `.auth-campo` en Auth.css, `.manager-campo` en Manager.css), con los mismos 5 valores. Pasaron a ser alias de `.label-campo` en index.css, igual que `.campo` ya enganchaba sus inputs por descendencia; en cada archivo quedó sólo el layout (columna + gap `--space-1-5`). Así login, alta de cuenta y modales comparten label como pide §9. |
| 07/10 | 4 (utilidades) | **`.btn--lg` relleno lleva `padding: 0 18px`, y 18 no tiene token de espaciado** (sólo `--space-card`, que es de card). Va literal con comentario, sólo en `.btn--lg.btn-primary` / `.btn--lg.btn-marca`. Si aparece otro 18 fuera de card, vale un token. |
| 07/10 | 4 (utilidades) | **El ícono de `.btn-icono` lo fija el CSS, no el `size` del JSX**: el CSS le gana al atributo `width/height` del `<svg>`, así que los ~40 llamados que pasan `size={14}` quedan a 16 (y a 14 en `--sm`) sin tocar un `.jsx`. Lo mismo para el chevron del select, que tenía hardcodeado el gris frío `%236b7280` de la v4 adentro de la data URI: pasó a `--color-tinta-tenue`. |
| 07/10 | 4 (utilidades) | **Se agregó el campo compuesto** (`div.campo` + `.campo__prefijo` / `.campo__sufijo`, foco por `:focus-within`), que el prompt no pedía con nombre pero `.campo--monto` necesita: la moneda "como prefijo tenue adentro" exige que la caja sea un contenedor y el input vaya sin borde. Sin consumidores todavía; lo usan los modales de alta (prompt 18). |
| 07/10 | 4 (utilidades) | **No existía `.badge--atencion`** (el par ámbar de §2) y `.badge--peligro` usaba el rojo pleno como texto: pasó a `--color-oxido-texto`, que es el par del spec. `.badge--exito` sigue en el verde funcional (`--color-musgo-*`) por la decisión de la pieza 0b, no en oliva como dice la tabla de §2. |
| 07/10 | 4 (utilidades) | **Las acciones de fila en hover tienen utilidad pero todavía no consumidores**: `.acciones` dentro de `.planilla__fila` o de `.fila-con-acciones`. Fases y el libro siguen con las acciones siempre visibles (fix 8f79861) hasta sus prompts (14 y 6). |
| 07/10 | 4 (utilidades) | **Quedan 20 `.css` con `text-transform: uppercase`** (Sidebar, PageHeader, TarjetaKpi, TablaProyectos, LibroDeObra, Seguimiento, Fases, ModalDetalle, ModalEditar, ModalShell, modal-base, Manager, ProveedorCard, ProveedorDetalle, Comparador, AnalisisGeneral, ChipsCategorias, ModalImportarCatalogo, ErrorBoundary, Auth). Son de cada pantalla y se van con su prompt; los de pantallas sin diseño (Comparador, Manager, ErrorBoundary) van en una pasada final. |

---

## Contradicciones con DESIGN.md

Cuando este plan y DESIGN.md no coinciden, gana DESIGN.md y la diferencia se
anota acá para resolverla.

| Qué | DESIGN.md dice | El diseño dice | Resuelto como |
|---|---|---|---|
| h1 del header de proyecto | §3: detalle = 24px | `HSProyectoHeader`: 28px | 24px, por 4p y por la jerarquía. Revisable en pantalla. |
| Badge "En curso" | §2: un par por rol | 4L lo dibuja oliva **sólido**, `HSProyectoHeader` oliva **tint** | Tint en los dos. El sólido de 4L es el outlier. |
| Acciones de fila | §8: visibles en touch | 4a y 4p: sólo en hover | §8 gana, con `@media (hover)` + `:focus-within`. |
| Columna de saldo | decisión 6: pesos | `Movimientos v2`: `Saldo US$` | Pesos, `Saldo $`. |
