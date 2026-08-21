# Sistema de diseño — HomeSolutions

Este documento es la contraparte escrita de `frontend/src/index.css`. El CSS
tiene los valores; acá está **por qué son ésos y cuándo usar cada uno**.

Los tokens de marca (color y tipografía) salen del Manual de uso de la marca
(`HS_IID_Manual`, v1_06/26). Todo lo demás —escala de texto, espaciado,
componentes— se decidió mirando lo que la app ya hacía y quedándose con la
versión que más se repetía o que estaba mejor resuelta.

---

## Regla principal

> **Si dos elementos cumplen la misma función, tienen que verse y comportarse
> igual. Si cumplen funciones distintas pueden verse distinto, pero tienen que
> seguir perteneciendo al mismo lenguaje visual.**

De ahí salen las dos reglas operativas que más importan en el día a día:

1. **Ningún valor literal donde hay un token.** Nada de `font-size: 0.8rem`,
   `color: #6b7280` ni `padding: 7px 13px` sueltos. Si el valor que necesitás
   no existe como token, el problema es la decisión, no el token.
2. **Si un componente compartido no encaja, va un modificador — no un bloque
   nuevo.** `.campo--sm`, `.btn--sm`, `.badge--sm` existen para eso. Redeclarar
   la receta entera en el `.css` del componente es exactamente lo que produjo
   las siete geometrías de input y las veintiún pastillas que hubo que
   deshacer.

---

## 1. Cómo usar este documento

**Antes de escribir CSS nuevo**, buscá si lo que necesitás ya existe:

| Necesito… | Usá | Vive en |
|---|---|---|
| Un botón | `.btn` + variante | `index.css` |
| Un botón de sólo ícono | `.btn-icono` + variante | `index.css` |
| Un input / select / textarea | `.campo` | `index.css` |
| Una etiqueta de estado | `.badge` + variante | `index.css` |
| Una tabla de filas | `.planilla` | `index.css` |
| Un label en mayúsculas | `.label-ficha` | `index.css` |
| Un encabezado de página | `<PageHeader>` | `components/shared/` |
| Una búsqueda de lista | `<Buscador>` | `components/shared/` |
| Un modal de formulario | `<ModalShell>` | `components/modals/` |
| Una lista vacía / un error | `<EstadoVacio>` / `<EstadoError>` | `components/shared/` |
| Un modal con teclado correcto | `useModal()` | `hooks/` |

**Un canario barato para CI**, que corta de raíz la deriva más común:

```bash
grep -rn --include="*.css" -E 'font-size: *[0-9.]+(rem|px|em);' frontend/src
```

Tiene que devolver cero resultados. Hoy los devuelve.

---

## 2. Color

La paleta es la del manual de marca. **No se agregan colores nuevos** salvo que
el manual los tenga; si hace falta un tono intermedio, primero va como token acá
y recién después se usa.

### Marca

| Token | Valor | Para qué |
|---|---|---|
| `--color-terracota` | `#6f7f45` | Acento de marca (el oliva). Acción primaria, foco, estado activo. |
| `--color-terracota-dark` | `#535f34` | Hover del acento; también texto oliva sobre fondo claro. |
| `--color-terracota-tint` | `#eef0e9` | Fondo tenue del acento (badge, chip activo, selección). |

El nombre `terracota` viene de una paleta anterior y quedó para no tocar cada
`.css` que lo consume. **El nombre no describe el color; describe el rol**: es
el acento de marca. Lo mismo vale para `musgo`, `arcilla`, `acero`.

### Semánticos

Cada uno viene en tres piezas: el color pleno, su `-tint` (fondo) y —donde hizo
falta— su `-texto` (versión oscurecida, porque el pleno no llega a contraste
suficiente sobre su propio tint).

| Rol | Pleno | Tint | Texto sobre tint |
|---|---|---|---|
| Éxito / positivo | `--color-musgo` `#16a34a` | `--color-musgo-tint` | `--color-musgo-dark` |
| Atención | `--color-arcilla` `#d97706` | `--color-arcilla-tint` | `--color-arcilla-texto` |
| Error / negativo | `--color-oxido` `#dc2626` | `--color-oxido-tint` | — |
| Neutro / informativo | `--color-acero` `#64748b` | `--color-acero-tint` | `--color-acero-texto` |
| Marca | `--color-terracota` | `--color-terracota-tint` | `--color-terracota-texto` |

**El semáforo es siempre el mismo**: verde = resuelto, naranja = en curso o
requiere atención, rojo = problema o saldo negativo, gris = neutro o pendiente.
No inventar otro mapeo por pantalla.

### Superficies y texto

| Token | Valor | Para qué |
|---|---|---|
| `--color-base-1` | `#fafafa` | Fondo de página; también fondo de input en reposo. |
| `--color-base-2` | `#f0f0f2` | Fondo de un elemento apoyado sobre base-1 (hover de botón fantasma). |
| `--color-superficie` | `#ffffff` | Card, modal, fila de tabla. Lo que "flota" sobre el fondo. |
| `--color-linea` | `#e4e4e7` | Todo borde y todo separador. Un solo gris de línea. |
| `--color-tinta` | `#18181b` | Texto principal. |
| `--color-tinta-muted` | `#6b7280` | Texto secundario, labels, meta-texto, placeholders. |

**Sólo dos niveles de texto.** Si algo necesita un tercer gris "entre" tinta y
muted, casi siempre lo que necesita es otro peso o tamaño, no otro color.

### Superficies oscuras

La navegación es oscura y el contenido claro (`--color-oscuro` es negro puro).
Se usa en el sidebar, en el panel izquierdo del login y en el header de los
modales de detalle. Sus tokens (`--color-oscuro-*`) **no se mezclan** con los de
contenido claro: un componente vive en un mundo o en el otro.

### Color desde el dato

Cuando el color viene de un dato (el estado de una fase, el tipo de
movimiento), **no va en el CSS**: sale de `constants/colores.js` y se aplica
inline. `colores.js` es el único lugar donde puede vivir un hex en JS, y sus
valores están duplicados a mano desde los tokens porque `recharts` y el atributo
`style` necesitan el hex plano. **Si cambia la paleta, hay que tocar los dos
lugares.**

Para el fondo tenue de esas pastillas se concatena `TINTE_PASTILLA` (`"1c"`, un
alfa en hex) al color: `` `${color}${TINTE_PASTILLA}` ``.

---

## 3. Tipografía

**Public Sans** es la fuente de marca (manual §4). `--font-display` y
`--font-ui` apuntan a la misma familia: la distinción es semántica, no visual —
`display` para títulos y cifras grandes, `ui` para todo lo demás. Se cargan los
pesos 400–800 desde Google Fonts en `index.html`.

### Escala

Diez pasos. **No hay tamaños fuera de esta lista.**

| Token | Valor | Rol |
|---|---|---|
| `--text-2xs` | `0.66rem` | Micro-label en mayúsculas: contador del sidebar, header de tabla en un modal, `badge--sm`. |
| `--text-xs` | `0.72rem` | Label de ficha, chip, meta-texto, badge. |
| `--text-sm` | `0.82rem` | Texto secundario, filtros, mensajes de error de campo. |
| `--text-btn` | `0.85rem` | **Sólo controles**: texto de botón, opción de select flotante. |
| `--text-base` | `0.9rem` | Texto de UI por defecto. |
| `--text-md` | `0.95rem` | Valor dentro de un input. |
| `--text-lg` | `1.05rem` | Título de sección, título de card. |
| `--text-xl` | `1.25rem` | Título de modal, encabezado de pestaña, cifra destacada. |
| `--text-2xl` | `1.6rem` | Título de una página de detalle (proyecto, fase, proveedor). |
| `--text-3xl` | `2rem` | Título de una página de listado; número grande de KPI. |

`--text-btn` está fuera de orden (cae entre `sm` y `base`) y es la única
concesión de la escala: existe porque `.btn` ya usaba ese valor en 27 lugares.
**Para texto no se usa** — va `--text-sm` o `--text-base`.

### Jerarquía de títulos

Tres escalones, y se respetan:

```
Página de listado    --text-3xl   (Panel, Proyectos, Proveedores, Comparador, Cuentas)
Página de detalle    --text-2xl   (un proyecto, una fase, un proveedor)
  Pestaña / modal    --text-xl
    Sección          --text-lg
```

Un título de sección dentro de un modal o de un panel embebido **no** es un
título de sección de página: ésos son más chicos y se resuelven con
`.label-ficha` o con la clase del propio componente.

### Pesos

| Peso | Para qué |
|---|---|
| 400 | Cuerpo, valor de input. |
| 500 | Énfasis suave (raro). |
| 600 | Títulos, labels, botones. **El default de cualquier cosa destacada.** |
| 700 | Cifras y badges. |

Nada de 800. Nada de 300.

### Mayúsculas

**Reservadas a labels y meta-texto**, mediante `.label-ficha`
(`--text-xs` / 600 / `letter-spacing: 0.03em` / muted). **Nunca en un título**:
un `<h1>`–`<h4>` va en caja normal, siempre. Las mayúsculas acá significan "esto
es una etiqueta de un dato", no "esto es importante".

---

## 4. Espaciado

Escala de 4px, con dos medios pasos.

| Token | Valor |
|---|---|
| `--space-1` | `4px` |
| `--space-1-5` | `6px` |
| `--space-2` | `8px` |
| `--space-2-5` | `10px` |
| `--space-3` | `12px` |
| `--space-4` | `16px` |
| `--space-6` | `24px` |
| `--space-8` | `32px` |
| `--space-12` | `48px` |
| `--space-16` | `64px` |

**Por qué 6px y 10px si rompen la escala:** eran los dos gaps más usados de la
app (41 y 19 apariciones, más que `--space-2`). La densidad de las filas y de
las pastillas se apoya en ellos. Forzarlos a 4/8/12 cambiaba el aspecto de media
app para ganar pureza de escala. Se reconocen como paso en vez de pelearlos —
pero **no se agrega ningún otro valor intermedio**.

Guía rápida:

- `--space-1` / `--space-1-5` — entre un ícono y su texto.
- `--space-2` / `--space-2-5` — entre controles de un mismo grupo.
- `--space-3` / `--space-4` — padding interno de una card o una fila.
- `--space-6` — entre bloques de una misma sección.
- `--space-8` / `--space-12` — entre secciones de una página.

**El espaciado lo pone el layout, no cada elemento.** Preferí `gap` en un
contenedor flex o grid antes que márgenes sueltos en cada hijo: los márgenes se
colapsan, se duplican y hay que acordarse de sacar el último.

---

## 5. Layout y responsive

`MainLayout` es sidebar fijo + contenido. El contenido tiene
`padding: --space-8 --space-12` en desktop y `--space-4` en móvil.

### Breakpoints

**Tres, y uno estructural.** Antes había once, y cuatro de ellos (600, 640, 700,
720) resolvían exactamente lo mismo: al achicar la ventana los componentes
colapsaban en cascada desordenada.

| Breakpoint | Qué cambia |
|---|---|
| `max-width: 640px` | Móvil. Las grillas pasan a una columna, los encabezados se apilan, los botones ocupan el ancho. |
| `max-width: 900px` | Tablet. Las planillas pasan a scroll horizontal con columnas de ancho fijo; los modales anchos pierden el riel. |
| `max-width: 768px` | **Sólo el sidebar.** Es un cambio estructural (de columna lateral a barra superior), no de densidad, y por eso tiene el suyo. Lo comparten `Sidebar.css` y `MainLayout.css`, que tienen que moverse juntos. |

Responsive no es sólo "que entre": el sistema visual tiene que ser el mismo en
las tres. Si un componente se comporta distinto en móvil, tiene que haber una
razón — y va comentada.

---

## 6. Movimiento

Una sola duración: `--transicion` (`0.15s ease`). Se anima **color, fondo y
borde**; no se animan tamaños ni posiciones salvo que el componente lo pida
(la barra de progreso del KPI, la entrada del modal).

La app entera respeta `prefers-reduced-motion` con una regla global en
`index.css`. **No hace falta repetirla por componente.**

---

## 7. Geometría — radios y sombras

| Token | Valor | Para qué |
|---|---|---|
| `--radius-sm` | `6px` | **Todo**: card, input, botón, modal, tile, tabla. |
| `--radius-pill` | `999px` | **Sólo badges, chips y puntos de estado.** |
| `--shadow-overlay` | `0 16px 40px rgba(24,24,27,.16)` | **Sólo lo que flota**: modal, popover, toast, tooltip. |

Éste es el punto donde el sistema es más estricto a propósito:

- **Un solo radio.** Si algo tiene un radio distinto de 6px y no es una pastilla,
  está mal. (La app es plana y de cantos suaves; el radio no es decoración.)
- **El radio grande es la marca de "esto es una etiqueta"**, no de "esto es
  redondeado y queda lindo". Por eso está reservado a `.badge` y a los chips: es
  lo que le dice al usuario que ese texto es un estado y no un dato.
- **Nada de sombras en el contenido.** Una card no lleva sombra: se separa del
  fondo con `--color-linea` y con `--color-superficie`. La sombra significa
  "esto está por encima de la página", y si se usa en todos lados deja de
  significar eso.

---

## 8. Botones

`.btn` da la forma; una variante da el color. Siempre las dos clases.

```html
<button class="btn btn-primary">Nuevo proyecto</button>
```

Base: `padding: 10px 18px`, `--text-btn`, peso 600, `--radius-sm`, borde de 1px
(transparente en las variantes rellenas, así todas miden igual).

| Variante | Cuándo |
|---|---|
| `.btn-primary` | La acción principal de la pantalla. **Una sola por vista.** Oliva relleno. |
| `.btn-secondary` | Todo lo demás. Contorno gris. |
| `.btn-marca` | Acción secundaria que pertenece a la marca — hoy, "Importar catálogo" con IA. Contorno oliva. |
| `.btn-peligro` | Eliminar. Contorno rojo que se rellena en hover. |
| `.btn--sm` | Modificador de tamaño, combinable con cualquiera. Para encabezados densos y acciones de fila. |

`.btn-marca` existe por un motivo concreto: "Importar catálogo" es la misma
acción en dos pantallas y estaba implementada dos veces con dos estilos
inventados por separado, los dos oliva en contorno. **Si la acción no es de
marca, va `.btn-secondary`** — no es un secundario alternativo.

### Botones de sólo ícono

`.btn-icono`, 28×28 (`--sm`: 24×24), con el ícono siempre a **14px**.

| Modificador | Cuándo |
|---|---|
| `.btn-icono--sm` | Dentro de una fila de tabla o una card compacta. |
| `.btn-icono--contorno` | Cuando tiene que leerse como control aunque la fila no esté en hover. |
| `.btn-icono--peligro` | Eliminar. |

**Siempre con `aria-label`.** Un ícono solo no tiene nombre accesible, y `title`
no alcanza (no se muestra en touch).

Las acciones de fila **se ven siempre**, no sólo en hover: en touch el hover no
existe y las acciones quedaban inalcanzables.

---

## 9. Campos y formularios

`.campo` es la geometría única de input, select y textarea:
`padding: 9px 12px`, `--text-md`, borde `--color-linea`, fondo `--color-base-1`.
En foco: borde oliva y fondo blanco.

| Modificador | Cuándo |
|---|---|
| `.campo--sm` | Fila de tabla editable, donde el campo estándar rompe el alto de fila. |
| `.campo--error` | Validación fallida. |

Los campos de los modales y de los formularios de auth y de cuentas **no llevan
la clase en el markup** (son decenas de inputs): se enganchan por descendencia
al mismo bloque, desde `index.css`. Eso es un alias, no una segunda receta.

Otras piezas:

- **Label**: `.label-ficha`, arriba del campo. Mayúsculas, muted.
- **Error**: `.campo-error` debajo del campo, en `--color-oxido`. Se muestra
  `onChange`, no recién al hacer submit.
- **Validación nativa**: `:user-invalid`, nunca `:invalid` — este último pinta
  de rojo campos que el usuario todavía no tocó.
- **Búsqueda**: `<Buscador>`. Nunca un input suelto adentro de un div con borde:
  eso fue lo que dejó dos de las tres búsquedas de la app sin ningún indicador
  de foco visible.

**Formularios que hacen lo mismo tienen que sentirse iguales.** Login, alta de
cuenta y los modales de carga comparten altura de campo, label y mensaje de
error.

---

## 10. Superficies y cards

Una card es: fondo `--color-superficie`, borde de 1px `--color-linea`,
`--radius-sm`, padding `--space-4`. Si es clickeable, en hover el borde pasa a
`--color-tinta` y el fondo a `--color-base-1`. **Sin sombra** (ver §7).

**No hay un componente `<Card>` genérico y es a propósito.** Las cards de la app
(proveedor, mini-seguimiento, nota, ítem de cuenta) comparten la receta de
superficie pero tienen contenidos y densidades genuinamente distintas: un
componente único terminaría con seis props de layout y sería peor que el CSS de
cada uno. Lo compartido es la receta, no la estructura.

Lo que sí tiene que ser igual: **cards que cumplen la misma función tienen el
mismo padding y el mismo alto.** Si dos listas muestran lo mismo, sus ítems
miden lo mismo.

---

## 11. Modales

Hay **dos shells**, y la diferencia es información, no inconsistencia:

| Shell | Cuándo | Header |
|---|---|---|
| `<ModalShell>` | Alta y edición por formulario. | Claro. |
| `DetalleShell` / `EditarShell` (`Piezas*.jsx`) | Ver o editar un movimiento (compra, gasto, cobro). | **Oscuro**, con el tipo de movimiento. |

El header oscuro es lo que distingue "estoy mirando un movimiento" de "estoy
cargando algo". Por eso no se unificaron.

Lo que sí es común a todos y vive en `modal-base.css`:

- **Overlay** `rgb(0 0 0 / 55%)`, `z-index: 1000`. Click afuera cierra.
- **Caja** blanca, `--radius-sm`, borde superior de 4px en oliva,
  `--shadow-overlay`, entrada de `0.15s`.
- **Estructura** header fijo → cuerpo scrolleable → footer fijo. El total y el
  botón de guardar **nunca** se pierden de vista al llenar un formulario largo.
- **Acciones** abajo a la derecha, cancelar (`.btn-secondary`) antes que
  confirmar (`.btn-primary`).
- **Cierre** con `.btn-icono` arriba a la derecha, con `aria-label`.

### Teclado — obligatorio

Todo modal usa `useModal(onCerrar, deshabilitado)`, que resuelve:

- **Escape** cierra (y no cierra mientras se está guardando).
- **Foco atrapado** adentro del diálogo.
- **Foco inicial** en el diálogo, para que el lector de pantalla lo anuncie.
- **Foco restaurado** al elemento que lo abrió.

Con `role="dialog"` y `aria-modal="true"` le estás prometiendo al lector de
pantalla que el resto de la página quedó inerte. Sin el trap, esa promesa es
falsa. **No se declara uno sin el otro.**

Un modal abierto desde otro (crear una nota parada en el detalle de una compra)
usa `capaSuperior` para subir el `z-index` a 1100.

---

## 12. Badges

`.badge` da **la forma**; el color lo pone quien la usa.

```html
<span class="badge badge--exito">Pagado</span>
<span class="badge" style="{{ color, backgroundColor }}">En curso</span>
```

Base: `padding: 3px 10px`, `--text-xs`, peso 600, `--radius-pill`.
`.badge--sm` (`1px 7px`, `--text-2xs`) para dentro de una tarjeta densa o una
fila de formulario.

Variantes semánticas: `--neutro`, `--marca`, `--exito`, `--peligro`. Cuando el
color viene del dato, va inline (ver §2).

**Qué no es un badge:** un chip interactivo. `.chips-cat-chip`,
`.filtros-seg__btn`, `.detalle__chip` son **controles** — tienen hover, foco y
estado, y por eso no usan esta clase aunque se parezcan.

**Ojo con el ancho fijo.** `.badge` es `inline-flex`, así que `text-align:
center` no centra nada: el texto es un ítem flex y lo alinea `justify-content`.
Si le ponés ancho fijo para alinear una columna, usá `justify-content: center`.

---

## 13. Tablas y listas

`.planilla` es la tabla en grid de la app. Da el chrome —borde, radio, header
con fondo `--color-base-1`, filas con separador y hover— y **cada uso pone nada
más sus `grid-template-columns`**.

```html
<div class="planilla mi-tabla">
  <div class="planilla__header mi-tabla-header">…</div>
  <div class="planilla__fila mi-tabla-fila">…</div>
</div>
```

- Header: `--space-2-5 --space-4`, labels con `.label-ficha`.
- Fila: `--space-3 --space-4`, hover `--fila-hover` (que cada fila puede setear
  para llevar el color de su estado) con caída a `--color-base-1`.
- Números: `font-variant-numeric: tabular-nums`, alineados a la derecha.
- En `max-width: 900px` pasa a scroll horizontal con columnas de ancho fijo.

**Cuando definas un ancho o un overflow que compita con `.planilla`, usá doble
clase** (`.planilla.mi-tabla`): las dos tienen la misma especificidad y sin eso
quién gana depende del orden en que Vite arma el bundle — que a su vez depende
del camino de navegación del usuario, porque el CSS sale code-splitteado por
ruta. Es un bug real que ya pasó una vez con el padding de los modales.

Lista vacía: `<EstadoVacio>`, nunca un `<p>` suelto.

---

## 14. Navegación

- **Sidebar** oscuro, sticky, 212px. Item activo: fondo tenue + borde izquierdo
  oliva + ícono oliva. El oliva es acento de estado, **no relleno**.
- **Tabs** (`<Tabs>`): borde inferior de 2px en oliva para la activa, texto
  muted para las demás.
- **Breadcrumbs** (`<Breadcrumbs>`): en toda página de detalle, siempre.
- **Título de página**: `<PageHeader>`, siempre. Nunca un `<h1>` suelto.

El estado activo se marca **siempre** con oliva, en los tres.

---

## 15. Estados

| Estado | Componente | Se ve como |
|---|---|---|
| Cargando (página o sección) | `<Cargando>` | Isotipo de marca pulsando + texto de qué se está cargando. `compacto` para una sección. |
| Esperando (dentro de un control) | `<LogoCargando>` | El mismo isotipo, a 13–14px, reemplazando al ícono del botón. |
| Cargando (Panel) | `.skeleton` | **Excepción a propósito.** Sólo donde el layout es estable y conocido de antemano, que es el único caso en que un skeleton aporta algo. No replicar en otras pantallas. |
| Vacío | `<EstadoVacio>` | Isotipo de marca a baja opacidad + mensaje muted. `grande` para página entera. |
| Error | `<EstadoError>` | Ícono `CircleAlert` + mensaje en `--color-oxido`, con `role="alert"`. |
| Éxito | `<ToastStack>` | Toast abajo a la derecha, con borde izquierdo del color del resultado. |
| Deshabilitado | `:disabled` | `opacity: .5` (controles) o `.6` (campos) + `cursor: not-allowed`. |

**Un error nunca se ve como un vacío.** Son situaciones opuestas: una es normal,
la otra pide una acción. Antes los dos salían en gris apagado y sin ícono.

Dentro de un modal o de un formulario, el hueco vacío se dice con la clase del
propio componente (`.modal-form-seccion-vacio`, `.comprobantes-vacio`): ahí el
isotipo de marca al lado de un campo sería ruido, no orientación.

### El indicador de espera es uno solo

Cargar una página, guardar un formulario y esperar a que la IA lea un
comprobante **son la misma cosa para el usuario**: algo está pasando y hay que
esperar. Por eso las tres usan el mismo indicador — el isotipo de la marca
pulsando (`<LogoCargando>`), que es el producto haciendo de spinner en vez de
un spinner genérico.

- **Dentro de un control**: reemplaza al ícono del botón, a 13–14px, y el texto
  pasa al gerundio ("Guardando…", "Leyendo…", "Creando…").
- **En una página o sección**: `<Cargando>`, centrado, con el texto debajo.
- **La variante importa.** Sobre un fondo oliva sólido (`.btn-primary`,
  `.ia-boton`) va `variante="blanco"`: el isotipo oliva es exactamente
  `--color-terracota`, así que sobre ese fondo queda invisible.

No rota ni rebota a propósito: el pulso lento se lee como "procesando",
mientras que girar o rebotar se siente más a "cargando indefinidamente".

### Foco

Hay una regla global de `:focus-visible` (outline oliva de 2px con offset) que
cubre links, botones, inputs, selects, textareas y `[tabindex]`. **Cualquier
control custom tiene que caer en esa regla o replicarla.** Si le ponés
`outline: none` a un input anidado, acordate de pintar el foco en el contenedor
con `:focus-within`.

---

## 16. Iconos

**`lucide-react`, sin excepciones.** No mezclar con SVGs sueltos ni con otra
librería.

| Tamaño | Cuándo |
|---|---|
| 14px | Inline: dentro de un botón, en una fila densa. |
| 16px | Estándar. |
| 20px | Destacado: encabezado de sección, estado vacío. |

`strokeWidth={2}` por defecto. `2.25` se permite sólo a 14px o menos, donde el
trazo fino se pierde. Un ícono a 2.25 al lado de uno a 2 se ve más pesado, y a
tamaños chicos se nota.

Un ícono decorativo lleva `aria-hidden="true"`. Un ícono que **es** el control
lleva `aria-label`.

---

## 17. Convenciones de CSS

- **BEM**: `bloque__elemento--modificador`, en kebab-case. Aplica a las clases
  propias de cada componente, no a las utilidades globales (`.btn`, `.badge`,
  `.campo`, `.planilla`, `.label-ficha`, `.cifra`, `.campo-error`), que son
  intencionalmente globales.
- **Un `.css` por componente**, importado desde su `.jsx`.
- **Los selectores genéricos se definen en un solo archivo.** Los `.modal-*` van
  sólo en `modal-base.css`; las utilidades sólo en `index.css`. Cada componente
  puede tener lo suyo, pero bajo una clase que le pertenezca.
- **Cuidado con la especificidad.** El CSS sale code-splitteado por ruta, así que
  entre dos selectores de igual especificidad gana el que Vite ponga último — y
  eso depende de por dónde navegó el usuario. Si necesitás ganarle a una
  utilidad, usá doble clase, no `!important`.
- **`!important` está prohibido** salvo en la regla de `prefers-reduced-motion`,
  donde es la forma estándar. Si sentís que lo necesitás, el problema es que
  estás pisando una utilidad en vez de usar un modificador.
- **Comentá el porqué, no el qué.** El valor se lee solo; lo que no se lee es qué
  problema resolvía.

---

## 18. Pendientes

Cosas que el sistema todavía no resuelve, anotadas para que no se descubran de
nuevo desde cero:

- **Anchos de modal**: hay cinco (440 base, 620 detalle y edición, 660 shell
  ancho, 860 importar catálogo, 900 edición con riel). Deberían ser tres:
  chico, normal, ancho.
- **`ModalDetalle.css` y `ModalEditar.css`** todavía reimplementan el footer y
  el total del shell con valores propios. Las piezas de forma se compartieron
  (cierre, campos, botones); el footer no.
- **Botones de reordenar fase** (`.fases-tabla-orden-btn`) siguen con radio de
  2px, el único fuera de `--radius-sm`.
- **`--font-display` y `--font-ui` son la misma familia.** La distinción es
  semántica y hoy no produce ninguna diferencia visual; o se le da una fuente
  distinta a display, o se colapsan en un token.
- **Sin modo oscuro.** La app es sólo clara; las superficies oscuras son de
  marca, no un tema.

---

## Apéndice — referencias históricas en el código

Varios comentarios del código citan un directorio `claudedesign/` con
"direcciones" numeradas (1a, 3a, 3b, 5c). **Ese material no está en el repo.**
Las citas se dejaron porque explican por qué un componente es como es; lo que
cada dirección terminó siendo en el código:

| Referencia | Qué es en la app |
|---|---|
| Dirección 1a — "Planilla" | La tabla en grid con una fila por proyecto, en vez de tarjetas que repiten el label de cada dato. Hoy es `.planilla`. |
| Dirección 3a | El modal de detalle de movimiento: header oscuro, total grande y barra que descompone el total en neto / impuestos / notas. |
| Dirección 3b | El libro de obra. |
| Dirección 5c | El shell de modal con header fijo, cuerpo scrolleable y footer fijo (`ModalShell`). |

Si aparece el material original, conviene traerlo a `docs/` y reemplazar estas
citas por links.
