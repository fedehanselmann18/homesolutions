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
| **2a** | Tabla de movimientos | `LibroDeObra.*` | restyle | **hecha** 07/10 (prompt 6) |
| **2b** | Filtros a chips | `FiltrosSegmentados.*` | restyle | **hecha** 07/10 (prompt 7) |
| **2c** | Panel de filtros | `FiltrosLista.*` | restyle | **hecha** 07/10 (prompt 8) |
| **2d** | Modales de detalle | `ModalDetalle*.jsx`, `PiezasDetalle.jsx`, `ModalDetalle.css` | restyle | **hecha** 07/10 (prompt 9) |
| **3** | Sidebar blanco | `Sidebar.*`, `MainLayout.*` | estructural | **hecha** 07/10 (prompt 5) |
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
| 07/10 | 5 (sidebar) | **El logo del sidebar pasó de `HS_logo_blanco.png` a isotipo negro + nombre en texto**, como dibuja `HSSidebar`: `HS_iso_negro.png` a 28px de alto y "Home / Solutions" en `--text-sm` / 700. El `<img>` lleva `alt=""` porque el nombre ya está escrito al lado. Login, Registro y NoAutorizado siguen con el logo blanco: son el panel oscuro de marca. |
| 07/10 | 5 (sidebar) | **El punto de "obra al día" pasó de verde a oliva** (§2, "Progreso y datos": punto sin alerta = `--color-terracota`). No es el estado "terminado": dice "esta obra está bien de plata", y en verde se confundía con el semáforo. |
| 07/10 | 5 (sidebar) | **El padding del `<main>` estaba en `--space-8 --space-12` (32/48)** y el canónico de §4 es 32/40. Se corrigió en MainLayout junto con el fondo; todas las páginas ganan 16px de ancho útil. |
| 07/10 | 5 (sidebar) | **El rol del footer venía en mayúsculas con tracking** ("ADMIN"); pasó a `text-transform: capitalize` ("Admin"), igual que el nombre. El rol en la base es minúscula, así que capitalizar es lo único que hace falta. |
| 07/10 | 5 (sidebar) | Quedan `--color-oscuro-*` fuera del login en dos lugares: la barra de saldo del libro (`LibroDeObra.css`, prompt 6) y `ErrorBoundary.css` (sin diseño, pasada final). |
| 07/10 | 6 (libro) | **`constants/estadoCompra.js` tenía los hex de la v4 escritos a mano** (`#16a34a`, `#64748b`, `#6b7280`) fuera de `colores.js`, así que el estado de pago/envío de las compras seguía en verde y gris fríos después de la pieza 0. Ningún canario lo ve: los dos sólo miran `.css`. Pasó a la forma de `estados.js` (`{ color, bg, fg, label, icono }`) con los pares de `colores.js`, que sumó `NARANJA_TINT/TEXTO` y `ROJO_TINT/TEXTO`. **Vale un tercer canario**: `grep -rn --include="*.js" --include="*.jsx" -E '"#[0-9a-fA-F]{3,8}"' frontend/src \| grep -v colores.js`. |
| 07/10 | 6 (libro) | **Los labels de estado de una compra cambiaron**, siguiendo el diseño: "Pendiente" → **"A pagar"**, "Pedido" → **"Sin entregar"**, y una compra impaga hace 90 días o más dice **"N días sin pagar"** en rojo (`DIAS_DEUDA_VENCIDA`, el mismo corte de la variante 4N). Por debajo de 90 la fila ya no dice los días; van en el `title`/`aria-label` del badge ("Impaga hace 12 días"). Los modales de compra (que también leen `getEstadoPago`) muestran los labels nuevos desde este commit. |
| 07/10 | 6 (libro) | **Resuelto = oliva, no verde**, en el badge de pago/envío y en el "Pagado"/"Cobrado" de gastos y cobros: es lo que dibuja el diseño y la tabla de accents de §2. El verde funcional de la pieza 0b queda para el estado de fase/proyecto "terminado" y para las cifras positivas. |
| 07/10 | 6 (libro) | **Se fue la fila oscura de saldo final** (`.libro__saldo`, con `--color-oscuro-*`): no está en el diseño, y el saldo actual es el de la primera fila. El bloque grande de saldo es el prompt 19. Con eso el libro ya no usa ningún `--color-oscuro-*`. |
| 07/10 | 6 (libro) | **El prop `titulo` de `LibroDeObra` se borró** junto con la cabecera, y con él `faseNombre` de `AccionesFase`, que sólo existía para armarlo. Se agregó `movimientoActivo` (`{ tipo, id }`) para la fila seleccionada; lo pasan Acciones y la ficha de proveedor. AccionesFase no, porque el detalle lo abre FaseDetalle. |
| 07/10 | 6 (libro) | **Paginación nueva, de a 50 movimientos**, sólo visible si hay más de una página (no se shipea un "Siguiente" que no lleva a nada). Los botones son `.btn--sm` (30px): el diseño dibuja 28 y no hay tamaño de botón de 28. |
| 07/10 | 6 (libro) | **En la ficha de proveedor el acumulado sale negativo** ("Total comprado −$ 2.320.780"): el libro suma con el signo de caja y una compra resta. Ya pasaba antes; es de la pieza de Proveedor detalle (prompt 13) decidir si ahí se muestra en positivo. |
| 07/10 | 6 (libro) | Entre 641 y 900px el libro scrollea en horizontal con `min-width` 900 (1000 con acciones de admin, si no la columna Movimiento queda en 190px). Abajo de 640 pasa a la versión de 375 del diseño, con las acciones de admin en su propia línea porque en touch se ven siempre. |
| 07/10 | 7 (chips) | **El chip no le servía a `SelectorMoneda`** (US$ / Pesos): no es un filtro que recorta una lista sino un switch de dos opciones que cambia el dato, que es el caso del **segmentado** de §9. Se agregó `variante="segmentado"` a `FiltrosSegmentados` (no un componente nuevo): track en `--color-linea-suave` con 3px de aire y la activa en blanco con `--shadow-hover`. Los botones miden 26 para que el control entero mida 32 y alinee con los botones de toolbar de al lado; §9 dice "botones de 32px", que es ambiguo entre el botón y el control. |
| 07/10 | 7 (chips) | **`FiltrosSegmentados` era un `role="tablist"` con `role="tab"`** y no controla ningún panel. Pasó a `role="group"` con botones `aria-pressed`: tabs prometen un panel asociado y un radiogroup promete navegar con flechas, y ninguna de las dos cosas pasa. Ningún test dependía de los roles viejos. |
| 07/10 | 7 (chips) | **"Con alertas" se agregó en el proyecto y también en la fase** (`AccionesFase` usa los mismos filtros); el criterio vive en `tieneAlerta()` de `utils/filtros.js`, con tests, y es el mismo que pinta la fila: comprobante faltante, compra impaga o sin entregar. |
| 07/10 | 7 (chips) | **Con un filtro puesto, la columna de saldo es el acumulado de lo filtrado**, no el saldo real de la caja (ya pasaba con Compras/Gastos/Cobros; con "Con alertas" se nota más). Un saldo que depende del filtro es engañoso: vale decidir si con filtro la columna se oculta o se calcula sobre todos los movimientos. No se cambió acá. |
| 07/10 | 8 (filtros) | **`Exportar` no se puso**: el backend no tiene endpoint de exportación de movimientos. El único que exporta algo es `GET /proyectos/{id}/reporte-pdf`, que es el reporte de Análisis y ya tiene su botón en esa tab. |
| 07/10 | 8 (filtros) | **`FiltrosLista` pasó a ser la barra entera**: recibe los chips de tipo como `children` (izquierda) y pone "Filtrar" a la derecha; el panel con los campos se despliega abajo y los aplicados quedan como `.chip--quitable`. Los campos son `<select class="campo campo--sm">` nativos con `.label-campo` arriba. **`SelectFlotante` se borró**: era el desplegable propio con label flotante, sólo lo usaba esta barra, y su listbox no se podía manejar con teclado. |
| 07/10 | 8 (filtros) | **Antes la barra de filtros sólo existía en el chip Compras** (y al salir de ahí se borraban todos). Ahora "Filtrar" está en todos los chips y ofrece los campos que aplican a cada uno (`CAMPOS_FILTRO_POR_TIPO` en `utils/filtros.js`): Todo → factura y comprobante; Compras → pago, envío, notas, factura, comprobante; Cobros → notas, factura, comprobante; Gastos → factura, comprobante; Con alertas → factura. Al cambiar de chip se sueltan sólo los que no aplican (`filtrosParaTipo`). `filtrarCompras` ganó el filtro de comprobante, que las compras no tenían. |
| 07/10 | 8 (filtros) | Los labels de las opciones de filtro de estado pasaron a los del badge de la fila ("A pagar", "Sin entregar") y el "todos" de cada uno a "Todos": con el label del campo arriba, "Cualquier estado de pago" repetía el label. |
| 07/10 | 9 (detalle) | **Los shells se unificaron de verdad, no sólo el color del header.** `DetalleShell` ahora es un `ModalShell` con props (`icono`, `contexto` = fecha larga, `accionesIzquierda` para Borrar, `etiqueta` para el aria-label) y `ModalShell` pasó a la geometría v5: header de 64 con el cuadradito del ícono y el contexto a la derecha con `border-left`, cuerpo `flex: 0 1 auto` con `max-height: 88vh`, pie `--space-4 --space-6`, caja `--radius-xl` + `--shadow-modal`, sin el borde oliva de 4px. **Eso adelanta la forma del prompt 18**: los modales de alta que usan `ModalShell` (fase, proyecto, producto, proveedor, categoría, confirmar, nota, cotización, importar catálogo) ya tienen el shell nuevo; su contenido sigue siendo v4 hasta ese prompt. `ModalDetalle.css` bajó de 517 a ~330 líneas y ya no define caja, header ni pie. |
| 07/10 | 9 (detalle) | **`EditarShell` (editar gasto/cobro/compra) usa el mismo `ModalHeader`**, así ver y editar un movimiento tienen el mismo header claro. El resto del modal de edición (inputs de línea abajo, labels en mayúsculas, riel) es v4 y es del prompt 18. Como el detalle v5 ya no usa la barra de composición ni los tiles con switch, `BarraComposicion` y `TileEstado` se mudaron de `PiezasDetalle` a `PiezasEditar` (con sus estilos, ahora `mov-edit__*`): sólo los usan ModalCompra y ModalCobro. |
| 07/10 | 9 (detalle) | **Los switches de pago/envío del detalle se fueron** (§9: nada de switches). El estado es el badge debajo del título —el mismo de la fila del libro— y el badge es el botón que lo cambia; además, una compra impaga trae **"Marcar pagado" como acción principal del pie** (el "Registrar pago" del diseño: no hay un modelo de pagos, así que la acción es marcarla pagada). |
| 07/10 | 9 (detalle) | **"Borrar" en el pie se conectó en Acciones y en la fase** (los dos lugares con flujo de borrado): cierra el detalle y abre el `ModalConfirmar` de siempre. En Seguimiento, Seguimiento de la fase y la ficha de proveedor no se pasa `onEliminar` y el botón no aparece: ahí no se borraba antes y no es el lugar. |
| 07/10 | 9 (detalle) | **Se fue la barra de composición del total** (no está en Movimientos v2); el desglose numérico completo (neto, cada impuesto, notas, total, en las dos monedas) quedó en el bloque de totales alineado a la derecha. En mobile el bloque ocupa todo el ancho y la grilla de detalles pasa a 2 columnas. |
| 07/10 | 9 (detalle) | **`.shell--ancho` pasó de 660 a 760** (el ancho de "carga en pasos" de §14). Lo usan ModalNota con selector de producto e ImportarCatálogo en el paso de productos; el prompt 18 decide si se quedan ahí. |
| 07/10 | 9 (detalle) | `formatFechaLarga` ("Jueves 5 de marzo") pasó a `utils/formato.js`: la usan el separador de día del libro y el header del detalle. |
| 07/10 | 10 (panel) | **4i cambia qué cuenta el Panel, no sólo cómo se ve**, y eso fue casi todo JSX/datos: los 5 KPI de la v4 (proyectos en curso, disponible, cobrado del mes, ganancia neta del mes, requiere acción) pasan a **3** — Disponible en obras, Falta cobrar, **Deuda con proveedores** (nuevo: todas las compras impagas en pesos, con cuántas pasan los 90 días) —; la tabla de proyectos con filtros pasa a la lista corta "Proyectos en curso" con su fase actual; y "Actividad reciente" se reemplaza por **"Para resolver"** (nuevo en `calcularPanel`: impagas, sin entregar, sin comprobante y fases paradas de los proyectos en curso, ordenado por urgencia; se muestran 6 y se avisa cuántos más hay). Se perdieron "Ganancia neta del mes" y "Actividad reciente" como bloques: es lo que decidió la variante. |
| 07/10 | 10 (panel) | **"Próximo cobro: US$ 2.500 el 15/10" (el detalle del KPI Falta cobrar en el diseño) no se puede calcular**: un Cobro es plata que ya entró, no hay cuotas ni vencimientos. Va "US$ X cobrado este mes" en su lugar. Por lo mismo, "Para resolver" no tiene ítems de "Registrar cobro". |
| 07/10 | 10 (panel) | **El buscador global y el botón "Nuevo ▾" de la barra superior del diseño no se pusieron**: no hay búsqueda transversal en la app ni un menú de alta global. El `SelectorMoneda` queda donde estaba, a la derecha del título. |
| 07/10 | 10 (panel) | **El saludo usa `nombre_usuario`** ("Hola, Agustin", sin tilde): es el único nombre que tiene un usuario. Cada ítem de "Para resolver" lleva a `/proyectos/:id?tab=seguimiento`; `ProyectoDetalle` ahora lee `?tab=` para abrir en esa tab. `describirFaseActual` pasó a `utils/fases.js` (con tests) porque la usan el header del proyecto y el Panel. |
| 07/10 | 10 (panel) | **`TarjetaKpi` pasó a la receta v5** (label `--text-base` muted sin mayúsculas, cifra `--text-3xl` / 700 con el clamp por ancho de celda) y sumó `detalleColor`. La usan también Análisis, Análisis de la fase y Seguimiento, que heredan la cifra más grande. **`PageHeader`** pasó a h1 700 y su chip de conteo ("4 cargados") a texto tenue sin caja ni mayúsculas: lo comparten todas las páginas de listado. |
| 07/10 | 10 (panel) | El gráfico es el de Movimientos v2: cobros en oliva, compras y gastos en `GRIS_CLARO` (nuevo en `colores.js`), barras de 22, grilla en la línea suave, leyenda con cuadraditos. En mobile los KPIs ya no se ocultan: se apilan con una línea entre ellos. `TablaProyectos` dejó de usarse en el Panel; la sigue usando Proyectos hasta el prompt 11. |
| 07/10 | 11 (proyectos) | **`ProyectoCard` es nueva y `TablaProyectos` se borró** (con su `.css`): después del Panel (prompt 10) y de esta pieza no la usaba nadie. Con ella se fue la **tercera copia del semáforo** que había encontrado la pieza 1 (`.panel-tabla-grupo--*` en `TablaProyectos.css`, que pintaba los estados al revés que `estados.js`). La rampa de progreso de los segmentos (`colorSegmentoFase`) se mudó a la card. |
| 07/10 | 11 (proyectos) | **Lo que la card muestra sale todo de `calcularPanel`**, con dos datos nuevos en la fila: `comprasVencidas` (impagas de 90 días o más, para pasar el contador de alertas de ámbar a rojo) y `faseActual`. Los segmentos de fases ahora van en el orden de la obra (`orden`) y no en el que devuelve la API. Cobrado y Gastado van en %, como en el diseño (`pctCobrado`, `pctPresupuesto`); Disponible en la moneda elegida. |
| 07/10 | 11 (proyectos) | **Editar y eliminar quedaron en la card**, en hover con mouse (utilidad `.acciones` + `.fila-con-acciones`) y siempre en touch, al lado del contador de alertas. En "Todos" las cards se ordenan por estado (en curso → a iniciar → terminados) y dentro de cada uno por el orden elegido: es el agrupado que tenía la tabla, sin los separadores. `SelectorMoneda` y "Ordenar por" se mantienen a la derecha de los chips (el diseño no los tiene, pero sacarlos es perder funciones). |
| 07/10 | 11 (proyectos) | **`Buscador` pasó a la receta de §9**: 34px, relleno `--color-base-2`, sin borde, foco con contorno interior oliva + anillo. Lo comparten Proyectos, Proveedores y Comparador. |
| 07/10 | 12 (proveedores) | **"Registrar pago" no tenía contra qué registrarse**: no hay una entidad de pagos, el pago de una compra es su `estado_pago`. Se implementó como lo que es en el modelo: un `ModalConfirmar` que marca pagadas **todas** las compras impagas del proveedor (una por una, con `actualizarCompra`) y avisa que se deshace desde cada compra. Para eso `ModalConfirmar` ganó `tono="neutro"` (botón primario, sin ícono de alerta); el default sigue siendo `"peligro"`. `ModalConfirmar` también perdió el borde superior rojo (el borde de color se retiró de todos los modales en el prompt 9). |
| 07/10 | 12 (proveedores) | **`ProveedorCard` se reemplazó por `ProveedorDeudaCard` + `ProveedorFila`** (`components/proveedores/ProveedorItems.*`). Se perdieron de la lista el rubro y los badges de notas de crédito/débito de cada proveedor: el diseño no los tiene y siguen en la ficha. `calcularResumenProveedor` sumó `comprasImpagas`, `diasDeudaMasVieja` y `ultimaCompra`; las obras de cada deuda salen de las queries de fases y proyectos (una compra guarda la fase, no el proyecto). |
| 07/10 | 12 (proveedores) | **La búsqueda y la categoría filtran sólo "Al día"**, que es donde las pone el diseño: los que tienen deuda se ven siempre porque son lo urgente. `iniciales()` pasó a `utils/formato.js` (la usan el avatar del sidebar y el de los proveedores). Con varias cards de deuda hay varios "Registrar pago" primarios en pantalla, contra la regla de "una primaria por vista"; es lo que dibuja 4N y cada uno resuelve su card. |
| 07/10 | 13 (proveedor) | **El historial dejó de ser un `LibroDeObra`** y pasó a la lista de 4P (cuadradito de fecha, obra, meta, estados, total abajo). Con eso se resolvió el hallazgo del prompt 6: ya no aparece el "Total comprado −$ …" en negativo, porque no hay saldo de caja acá; el total de abajo suma lo filtrado en positivo. Las notas de crédito/débito del proveedor quedaron como una lista corta debajo del historial (antes eran `TarjetaAlerta` arriba de todo). |
| 07/10 | 13 (proveedor) | **Los filtros del historial pasaron a chips en una línea** con `FiltrosLista modo="chips"`: un filtro sin aplicar es un `.chip--agregar` ("+ Pago") con el `<select>` nativo encima e invisible (tocar el chip abre las opciones del sistema, sin desplegable propio y con teclado gratis); las fechas igual con `<input type="date">` y `showPicker()`. Uno aplicado es el chip quitable. Son 7 con fechas; en mobile hacen wrap. |
| 07/10 | 13 (proveedor) | **El badge de estado de compra quedó en un solo componente**, `components/shared/BadgeEstado.*`: el libro y el detalle tenían cada uno su copia desde los prompts 6 y 9, y el historial iba a ser la tercera. |
| 07/10 | 13 (proveedor) | **"Eliminar proveedor" se fue al menú ⋯** (`MenuMas`, en la misma página: es el único menú de la app; si aparece otro, vale moverlo a `shared/`). Editar y eliminar un producto pasaron a íconos en hover. `Tabs` ganó `contador` (número tenue, "Catálogo 7"), distinto del `badge` de pendientes. El rubro de la ficha es el tipo de producto más frecuente (`getTipoProducto`). |
| 07/10 | 13 (proveedor) | Entre 641 y 900px la ficha pasa arriba del contenido y el catálogo oculta Tipo y Categoría; abajo de 640 la fila del historial se apila con áreas de grid (fecha + título/monto, meta, estados). |
| 07/10 | 14 (fases) | **La planilla de fases pasó a la línea de tiempo 4b.** El punto de cada fase es PROGRESO y va en oliva (cerrada: relleno con ✓; actual: borde y número; pendiente: gris); el **estado sigue siendo el badge del semáforo con su ícono**, no el "· En curso" en gris del diseño: con el texto gris una fase terminada y una auditada se ven iguales (las dos tienen ✓). Se fueron la regla de color a la izquierda y el **tachado** de las cerradas: ahora se atenúan (`opacity: .75`), como pide la nota del diseño. |
| 07/10 | 14 (fases) | **"Presupuesto usado" reemplaza la fila de total** de la planilla: un tramo por fase con gasto, en el orden de la obra, más un tramo gris para los gastos **sin fase** (sin él los tramos no sumaban el número de al lado). Si el total pasa el precio acordado la barra entera va en óxido. La barra de cada fase muestra su % real del acordado; el diseño la dibuja al doble (`p*2%`) para que se vea, pero entonces la barra no coincide con el % escrito al lado. |
| 07/10 | 14 (fases) | **Reordenar quedó en dos `.btn-icono--sm` (subir/bajar)** junto a editar y borrar, en hover con mouse y siempre en touch. El diseño dibuja un grip de arrastre, pero la API sólo sabe mover de a un lugar (`moverFase`). Con eso desaparece `.fases-tabla-orden-btn` y su radio de 2px (el prompt pedía pasarlo a `--radius-xs`; ya no queda ninguna regla con radio propio). "En curso hace N días" se sumó a la línea de la descripción. `formatNumero` nuevo en `utils/formato.js` (con test) para los % con coma decimal. Bajo 1100px la tarjeta oculta la barra de avance (el nombre se quedaba sin lugar con el sidebar al lado); bajo 640 se apila en tres renglones. |
| 07/10 | 15 (análisis) | **Análisis abre con el resultado (4d)**: ganancia neta en `--text-4xl` (36px, **paso nuevo de la escala**: el diseño la quiere más grande que un KPI y el máximo era 28), "% de lo cobrado", y la lista Acordado / Cobrado / Gastado / Falta cobrar con el selector de moneda y "Reporte PDF" (`.btn-secondary`; el botón tenía su propia receta oliva). **"Disponible" no está en la lista**: en nuestro modelo las compras ya incluyen sus impuestos, así que Disponible y Ganancia neta son el mismo número (en el diseño difieren porque descuenta impuestos aparte). Los tres `TarjetaKpi` de arriba se fueron; `.analisis-kpis` queda para Análisis de la fase. |
| 07/10 | 15 (análisis) | **La cascada dejó recharts** y pasó a filas HTML (etiqueta / barra / valor escrito), con la misma escala de ticks que antes (`escalaCascada`): suma en oliva, resta en gris claro, subtotal en negro, ganancia neta en oliva o en óxido si es pérdida. El valor se redondea antes de mirar el signo (había un "−US$ 0"). En mobile se oculta el eje: las cifras ya están al lado de cada barra. |
| 07/10 | 15 (análisis) | **`PALETA_GRAFICOS` es la rampa de DESIGN.md §2** (oliva, oliva claro, oliva oscuro, gris, oliva muy claro, gris medio, oliva profundo, gris claro), validada contra las tortas de gastos, impuestos y cobrado-por-fase: dos porciones vecinas siempre se distinguen. `OLIVA_MUY_CLARO` y `OLIVA_PROFUNDO` son nuevos en `colores.js` y sólo para gráficos. **`constants/tipoProducto.js` también tenía hex a mano** (gris frío, ámbar, verde): pasaron a la rampa (equipo oliva oscuro, materiales oliva, mano de obra gris). Los usa además la pastilla de tipo en `ModalCompra`, que se rehace en el prompt 18. El treemap baja la opacidad de los productos hasta 0.6 como mínimo (antes 0.3, y el texto blanco no se leía). |
| 07/10 | 15 (análisis) | Barras de una sola serie (Pagos por tipo de factura, Egresos por fase) en `GRIS_CLARO`: son egresos, como en el Panel. Se sacó la mayúscula del header de `.analisis-tabla`. Quedan sin tocar las tarjetas de notas de crédito/débito (rojo/naranja como "destacado"): no las nombra el diseño. |
| 07/10 | 16 (seguimiento) | **Seguimiento pasó a la bandeja de 4f**: tres cifras (Por pagar a proveedores en pesos, Por cobrar en dólares, Sin comprobante) y una sola lista por urgencia. **Los grupos no son los del diseño** ("Vencido / Esta semana / Para revisar"): el modelo no tiene fechas de vencimiento, así que no hay "esta semana". Quedó **Vencido** (impagas de `DIAS_DEUDA_VENCIDA` o más), **Pendiente** (impagas más nuevas y pedidos sin entregar, por antigüedad, y al final el saldo del contrato) y **Para revisar** (sin comprobante y fases estancadas). La lógica es `armarBandeja` en `utils/seguimiento.js`, con tests. |
| 07/10 | 16 (seguimiento) | **Cada item lleva su acción**: Registrar pago y Marcar entregado usan los mismos toggles que el libro; **Adjuntar** abre el selector de archivos y sube directo; **Registrar cobro** abre `ModalCobro` vacío (como no hay cobros "pendientes", es un item para el saldo del contrato: el contador de la tab no lo cuenta, porque estaría siempre en 1 mientras la obra no esté cobrada); una fase estancada lleva **Ver fase**. Un usuario de lectura ve la lista sin botones. El título de cada item es el botón que abre el detalle (para llegar por teclado). Badges: pago y envío son los de `estadoCompra.js` (rojo desde 90 días, si no "N días sin pagar" en ámbar). |
| 07/10 | 16 (seguimiento) | **Salieron de la pestaña** la tabla "Deuda por proveedor" (está en Proveedores, prompt 12), los `TarjetaKpi` de cobranza y el contador "N cosas pendientes". Las clases viejas de `Seguimiento.css` (`-seccion`, `-tablero`, `-columna`, `-tabla`) se quedan porque las usa **Seguimiento de la fase**, que no tiene diseño y sigue en v4 (con mayúsculas en los títulos de columna). `onIrATab` dejó de usarse. Bajo 1100px la fila pasa a dos renglones; bajo 640, a tres. |
| 07/10 | 17 (fase) | **Acciones de la fase pasó a "lista + panel" (4h)**: `minmax(0,1fr) 288px`, con el panel fijo (`position: sticky`) que muestra lo gastado en la fase (US$ y % del presupuesto **del proyecto**: una fase no tiene presupuesto propio, el "de US$ 4.400 asignados" del diseño no existe en el modelo), compras y gastos en pesos, y los **pendientes** de la fase, que salen de la misma `armarBandeja` del Seguimiento (rojo si la deuda tiene 90 días o más, ámbar si no; los 5 primeros y "Ver N más", que lleva a Seguimiento de la fase). Sin la fila "Cobros" del diseño: los cobros son del proyecto, no de una fase. Bajo 1100px el panel pasa arriba de la lista. |
| 07/10 | 17 (fase) | **El libro de la fase es el mismo `LibroDeObra`, con un modificador nuevo `compacto`**: dos renglones por movimiento (tipo, título + importe / contexto, comprobante y estados), sin el encabezado de columnas ni la columna de saldo. En 808px las siete columnas no entraban (el título quedaba en ~100px). El `saldoLabel="Acumulado"` sigue pasándose y se ve en el libro no compacto; el total de la fase lo da el panel. Los filtros siguen siendo los chips del prompt 7 (el diseño los dibuja como tabs subrayadas). |
| 07/10 | 17 (fase) | **Header de la fase**: "← {proyecto}" en lugar del breadcrumb **y** el "Volver al proyecto" (eran dos caminos al mismo lugar), el número en el punto de la línea de tiempo (`etapaDeFase` pasó a `utils/fases.js`, con test, y la comparten Fases y este header), nombre en `--text-3xl` / 700, badge de estado con ícono, descripción y fechas como meta. **Botones: "Nueva compra" primario y "Gasto" secundario arriba; "Terminar fase" (antes un botón verde lleno) es el secundario del panel**, así que sólo se ve en la tab Acciones. Se fue la regla de color del estado a la izquierda del header. Las tabs de la fase ganaron íconos. |
| 07/10 | 17 (fase) | **Pendiente para la pasada final: "Seguimiento de la fase" sigue en v4** (títulos en óxido, columnas en mayúsculas, `TarjetaMiniSeguimiento`). No tiene diseño; lo natural es que use la misma bandeja que el Seguimiento del proyecto, acotada a la fase. |
| 07/10 | 18a (modales: base) | **Piezas comunes nuevas de los modales de alta**: `ControlOpcion` (`components/shared`), un `radiogroup` de verdad (una parada de Tab, flechas para cambiar) en tres formas: `segmentado` (2–3 opciones, mide 40px como un campo, `.segmentado--campo`), `chips` (`.chip--opcion`, 4–6) y `tiles` (ícono arriba, para el estado de una fase). **`.segmentado` pasó de `FiltrosSegmentados.css` a `index.css`** porque ahora lo usan filtros y formularios. `CampoMonto` (moneda adentro como prefijo, `≈ US$ …` como sufijo mientras se escribe), `AccionesFormulario` (el pie Cancelar + Guardar en `.btn--lg`, que estaba copiado en cada modal), `.campo-hint` + `.campo-hint__accion`, `.modal-form-panel` y `.modal-form-fila--fecha`. |
| 07/10 | 18a (modales: base) | **El dólar pasó a ser un hint**: "Dólar blue $ 1.450,00 del 01/10/2026 · cambiar". Tipo (segmentado) y cotización quedan plegados y se abren con "cambiar", o solos cuando no hay sugerencia o falta el valor al guardar. El "Equivale a …" de abajo se fue: el equivalente ahora está adentro del campo de monto (`textoEquivalente` en `utils/moneda.js`). **`ComprobantesUploader` es la zona de §14**: vacía, franja punteada de 52px con el clip en oliva y "elegí un archivo"; con archivos, una fila por archivo (cuadradito blanco, nombre, tipo · peso, ×) y la acción del primer archivo nuevo al lado — el botón de IA. Exporta `ZonaArchivo` y `FilaArchivo`, que también usa Importar catálogo (su paso de carga dejó `PasoComprobante`: el "Leer catálogo con IA" va en la fila del archivo y "Cargar a mano" en el pie). `BotonIA` pasó de píldora oliva llena a `.btn-marca`. |
| 07/10 | 18a (modales: chicos) | **Fase (5e)**: estado en tiles con el ícono del semáforo, descripción opcional, y el contexto "Fase 6 de Edificio Olleros" a la derecha del título (lo arma `Fases.jsx`). **Proyecto (5f)**: dirección y fecha con ícono adentro, estado en segmentado, y "Acuerdo con el cliente" en panel suave con el precio en US$ (≈ $ al lado) y el dólar de la firma como hint opcional. **Proveedor, producto, categoría, catálogo simple y cotización**: ícono en el header, tipo de producto y tipo de dólar en segmentado (con ícono el de producto), precio y cotización con la moneda adentro, opcionales marcados en el label. Producto ya no tiene un `<select>` vacío obligatorio: si falta el tipo, el error va debajo del control. Todos a 560px. `ModalConfirmar` ya estaba en v5 desde el prompt 12. |
| 07/10 | 18a (modales: base) | Dos arreglos de la caja: el `scrollbar-gutter: stable` de `.modal-contenido` dejaba un hueco a la derecha que cortaba las líneas del header y del pie en todo `ModalShell` (el scroll es del cuerpo, no de la caja); y en un campo de fecha con ícono se veían dos calendarios (el nuestro y el nativo de Chrome): el nativo queda invisible y ocupando todo el input, así se abre clickeando en cualquier parte. |
| 07/10 | 18b (gasto y cobro) | **Gasto (5c) y cobro (5d) dejaron `EditarShell` y son un `ModalShell` de 560px**: título "Nuevo gasto" / "Editar cobro" con el proyecto (o proyecto · fase) a la derecha, **comprobante primero** con "Autocompletar con IA" en la fila del archivo (pasa a "Volver a leer" después de leer), descripción, monto con la moneda adentro y el equivalente al lado, fecha, el dólar como hint, **el tipo de comprobante en chips** (son 6: Factura A/B/C, Remito, Recibo, Otros) y, en gasto, fase y categoría (quedan como select: pueden ser muchas). **Se fue el paso "IA primero"** (la pantalla con sólo la zona de carga y "Cargar los datos a mano"): el formulario está siempre, el archivo arriba. **Se fue el banner "Faltan N campos"**: cada campo muestra su error al tocarlo o al intentar guardar, y el pie dice "Faltan 4 campos: Descripción, Monto, …" (`avisoFaltantes`, con test). Para eso `ModalShell` ganó `validacionPropia` (`noValidate`): el `required` nativo frenaba el submit con su globito. |
| 07/10 | 18b (gasto y cobro) | **El cobro nuevo abre con el avance de cobro del proyecto** (panel suave: "US$ 2.326 de 9.302", barra con lo cobrado en oliva y este cobro en oliva claro, "Con este cobro llegás al N%"); Acciones y Seguimiento le pasan el precio acordado y lo cobrado. En el diseño 5d el comprobante del cobro va al final; quedó **arriba, como en todos** (regla del prompt). **Al editar un cobro con notas** el neto y las notas van en un panel abajo ("Neto con notas"), en lugar del riel de la derecha: a 560px no hay riel. Gasto ya no muestra el total en el pie: el monto se tipea y el equivalente está en su campo. |
| 07/10 | 18c (nota e importar) | **Nota de crédito/débito**: el comprobante (obligatorio) va primero como zona/fila de archivo (era un `<input type="file">` pelado al final), tipo en segmentado con el ícono de cada nota, comprobante y origen en chips (origen suma "Sin especificar", que es el vacío de antes), monto con la moneda adentro. **Se fue el modo "peligro"** (`ModalNota.css`, que pintaba de rojo el foco de los campos): una nota no es un borrado, y el foco es uno solo en toda la app. 560px, y 760 (`shell--ancho`) sólo con la tabla de productos devueltos. |
| 07/10 | 18c (nota e importar) | **`.tabla-form` reemplaza a las secciones v4 de `modal-base.css`** (`.modal-form-seccion*` con título en mayúsculas, `.modal-btn-agregar-fila` en verde `musgo`, `.modal-form-fila-dinamica*` con el subtotal en una caja verde, `.modal-form-resumen`): caja con borde y radio, cabecera en el suave, filas con la línea suave y los totales a la derecha, como la tabla de productos de 5a. "Agregar producto" es un `.btn-secondary` chico. En mobile el producto va en su renglón. **`.campo--sm` ahora gana dentro de `.modal-form`** (el alias de 40px lo pisaba) y el select chico tiene lugar para su chevron. |
| 07/10 | 18c (nota e importar) | **Importar catálogo** usa el ancho de 760 (tenía su propio 860, uno de los cinco anchos de la v4), ícono en el header y el proveedor como contexto; los labels y la cabecera de su tabla dejaron las mayúsculas. **Chips de categorías** (`ChipsCategorias`): usan `.chip` / `.chip--opcion` + `.chip--activo` (eran pastillas propias que se llenaban de oliva), el label es el de un campo, el campo y el botón de "Crear categoría" son `.campo--sm` y `.btn-secondary`, y el estado vacío es un panel suave. |
| 07/10 | 18d (nueva compra) | **Nueva compra es el híbrido 5ab**: 760px, tres pasos (Comprobante y datos / Condiciones / Productos e impuestos) con su barrita de 3px y número o ✓; se puede saltar a un paso clickeando su nombre. "Siguiente" valida el paso (los errores van en cada campo y el pie los cuenta) y Enter en un paso intermedio avanza en vez de guardar. **Al editar se puede guardar desde cualquier paso** ("Guardar cambios" siempre visible; "Siguiente" pasa a secundario): uno entra a cambiar una cosa puntual. Si al guardar hay errores, el modal salta al primer paso que los tiene. |
| 07/10 | 18d (nueva compra) | **Condiciones (paso 2)**: tipo de factura (6) y condición de pago (4) en chips **visibles** (no detrás de un "Editar" como en 5b), **pago y envío en segmentados** con el ícono y el color de texto de su badge — se fueron los `TileEstado` con switch. **Productos (paso 3)**: un select "Agregar del catálogo de {proveedor}…" agrega la línea con cantidad 1 y el precio de catálogo congelado (como antes); las líneas van en `.tabla-form` con el tipo de producto en tenue con su ícono (la pastilla de color con `TINTE_PASTILLA` se fue). Impuestos en filas con su `×`. El diseño 5a dibuja los impuestos como chips con el monto adentro; quedaron como filas porque el monto se tipea (o lo lee la IA) y un input dentro de un chip no es un chip. |
| 07/10 | 18d (nueva compra) | **Pie en dos niveles**: `ModalShell` ganó `desglose` (fila propia en el suave: "Neto $ … (N productos) · impuestos $ … · notas … · ≈ US$ …"), `totalGrande` (`--text-2xl`) y `encabezadoExtra` (los pasos, fijos bajo el header). El total nunca se pierde: el pie es fijo. El proveedor elegido se suma al contexto del header ("Edificio Olleros · CobreSur Materiales"). **Probado de punta a punta** en el navegador: se cargó una compra en los tres pasos y quedó en la base con factura A, contado, pagada y el neto correcto (después se borró). |
| 07/10 | 18d (nueva compra) | **Se borraron `PiezasEditar.jsx` y `ModalEditar.css`** (578 líneas, el shell de edición con riel, `TileEstado`, `BarraComposicion`, `TotalRiel`, `SeccionForm`): gasto, cobro y compra son `ModalShell`. De `PiezasIA` se fueron `PasoComprobante`, `BannerIA` y `ResumenValidacion`. `.campo--error` ahora gana dentro de `.modal-form` (el alias de 40px lo pisaba en selects e inputs sin caja compuesta), y la marca de "leído por la IA" pinta la caja de un campo compuesto y no su input de adentro. Con esto **no queda ninguna mayúscula en el CSS de los modales**. |

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
