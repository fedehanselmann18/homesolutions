# Sistema de diseño — HomeSolutions

Este documento es la contraparte escrita de `frontend/src/index.css`. El CSS
tiene los valores; acá está **por qué son ésos y cuándo usar cada uno**.

Los tokens de marca (color y tipografía) salen del Manual de uso de la marca
(`HS_IID_Manual`, v1_06/26), que vive en `docs/Manual_uso_HS.pdf`. Todo lo demás
—escala de texto, espaciado, componentes— sale de los diseños de Claude Design
(prototipos `.dc.html` ya retirados del repo; quedan en el historial de git).

> **Estado: v5 — dirección cálida.** Esta versión reemplaza la v4 ("estilo
> Spotify": navegación oscura, grises fríos). El documento está **acordado pero
> todavía no implementado**: describe el destino, no lo que hoy se ve en
> producción. Mientras `index.css` no se actualice, hay desfasaje a propósito
> entre este documento y el código. Ver §19 para el orden de ejecución.

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

Esas dos reglas son la razón por la que este rediseño es viable: hoy **no hay un
solo hex suelto fuera de `index.css`** en los 53 archivos `.css` de la app. Casi
todo el cambio de estética se hace cambiando valores de token, no componentes.

---

## 0. La dirección visual, en una página

La v4 era **navegación oscura + contenido claro, con grises fríos**. La v5 es
**una sola superficie blanca, con grises cálidos y el oliva como único acento**.

Cuatro decisiones la definen:

| | v4 (hasta ahora) | v5 (esta) |
|---|---|---|
| Sidebar | Negro puro | **Blanco**, con borde derecho e item activo en oliva |
| Fondo de página | `#fafafa` con cards blancas que "flotan" | **Blanco**; la separación la hacen los bordes |
| Grises | Fríos (`#e4e4e7`, `#6b7280`, `#18181b`) | **Cálidos**, derivados del gris del manual |
| Positivo | Verde semáforo `#16a34a` | **Oliva** — el verde no está en el manual |

**La idea de fondo: jerarquía por borde y por peso, no por fondo ni por sombra.**
En la v4 un bloque se destacaba poniéndole un fondo distinto o una sombra. En la
v5 se destaca con un borde de 1px y con el peso del texto. Eso es lo que hace
que la app se sienta más liviana sin perder estructura, y es también lo que la
vuelve menos tolerante al desorden: sin fondos de colores que tapen, un padding
inconsistente se ve.

---

## 1. Cómo usar este documento

**Antes de escribir CSS nuevo**, buscá si lo que necesitás ya existe:

| Necesito… | Usá | Vive en |
|---|---|---|
| Un botón | `.btn` + variante | `index.css` |
| Un botón de sólo ícono | `.btn-icono` + variante | `index.css` |
| Un input / select / textarea | `.campo` | `index.css` |
| Una etiqueta de estado | `.badge` + variante | `index.css` |
| Un chip interactivo (filtro, opción) | `.chip` + variante | `index.css` |
| Una tabla de filas | `.planilla` | `index.css` |
| Un label de campo | `.label-campo` | `index.css` |
| Un encabezado de página | `<PageHeader>` | `components/shared/` |
| Una búsqueda de lista | `<Buscador>` | `components/shared/` |
| Un modal de formulario | `<ModalShell>` | `components/modals/` |
| Una lista vacía / un error | `<EstadoVacio>` / `<EstadoError>` | `components/shared/` |
| Un modal con teclado correcto | `useModal()` | `hooks/` |

**Dos canarios baratos para CI**, que cortan de raíz la deriva más común:

```bash
# 1. Ningún tamaño de texto literal.
grep -rn --include="*.css" -E 'font-size: *[0-9.]+(rem|px|em);' frontend/src

# 2. Ningún hex fuera de index.css y colores.js.
grep -rn --include="*.css" -E '#[0-9a-fA-F]{3,8}\b' frontend/src \
  | grep -v 'src/index.css'
```

Los dos tienen que devolver cero. Hoy lo hacen, y **mantenerlo así es lo que
permite que el próximo rediseño también sea un cambio de valores.**

---

## 2. Color

La paleta del manual tiene **exactamente cinco colores** (manual §5):

| Nombre en el manual | Valor |
|---|---|
| Oliva | `#6f7f45` |
| Oliva claro | `#a8b36a` |
| Gris claro | `#d9d7d2` |
| Gris oscuro | `#5a5a58` |
| Negro | `#000000` |

De ahí sale **la regla de color de la app**:

> **5 colores de marca + su rampa derivada + 2 accents funcionales. Nada más.**

Todo lo demás se construye a partir de esos cinco. Los grises cálidos de
superficie son aclarados de **gris claro**; el tercer nivel de texto es un
aclarado de **gris oscuro**; el tint y el shade del oliva salen del oliva. Por
eso la paleta nueva se siente coherente y la vieja no: `#e4e4e7` y `#6b7280` no
derivaban de nada del manual.

### Marca

| Token | Valor | Para qué |
|---|---|---|
| `--color-oliva` | `#6f7f45` | Acento de marca (el oliva). Acción primaria, foco, estado activo. |
| `--color-oliva-dark` | `#4f5b30` | Texto oliva sobre su propio tint. Hover del acento relleno. |
| `--color-oliva-tint` | `#eef0e3` | Fondo tenue del acento: badge de éxito, anillo de foco. |
| `--color-oliva-sel` | `#f1f2ea` | Fondo de **selección/activo** en un control (nav item, chip activo). |
| `--color-oliva-claro` | `#a8b36a` | Tramo completado de una barra de progreso; segunda serie de un gráfico. |

`--color-oliva-tint` (`#eef0e3`) y `--color-oliva-sel` (`#f1f2ea`) son
casi el mismo color y tienen roles distintos a propósito: **el tint dice "este
dato está resuelto", el sel dice "este control está activo".** En los diseños
nunca aparecen juntos, y separarlos evita que un badge de "Pagado" y un tab
seleccionado terminen siendo la misma cosa.

> Hasta el prompt 20 del rollout este token se llamaba `--color-terracota`, de
> una paleta anterior. Los nombres de color ahora dicen el rol (§20).

### Rampa de grises cálidos

Cinco pasos derivados de **gris claro `#d9d7d2`**, de más claro a más oscuro:

| Token | Valor | Para qué |
|---|---|---|
| `--color-superficie` | `#ffffff` | Toda superficie: página, card, fila, modal, sidebar. |
| `--color-superficie-suave` | `#f9f8f6` | Hover de fila, header de tabla, panel sin borde. |
| `--color-relleno` | `#f3f2ee` | Relleno de un control: buscador, avatar, cuadrito de ícono. |
| `--color-linea-suave` | `#efeee9` | Separador **entre filas de una misma lista**. Y el track del segmentado. |
| `--color-linea` | `#e6e4df` | Todo borde de contorno: card, input, divisor de sección. |
| `--color-linea-fuerte` | `#d9d7d2` | Hover de borde, separador de breadcrumb, chip punteado. |

**Dos niveles de línea, y no es capricho.** `--color-linea` (`#e6e4df`) es el
contorno de algo: dice "acá empieza y termina este bloque". `--color-linea-suave`
(`#efeee9`) separa filas *dentro* de ese bloque: si usás el contorno para separar
filas, la lista se lee como veinte cajas apiladas en vez de una tabla. Es la
diferencia entre `border` y `border-bottom` en los diseños, y está en todos.

**`--color-base-1` se fue.** Era a la vez el fondo de página y el fondo de
input en reposo, dos roles que ahora son distintos: la página es blanca y el
input también (se define por su borde). Sus otros usos (header de planilla,
hover de fila) son `--color-superficie-suave`. El único control con relleno gris
es el buscador, que usa `--color-relleno`.

### Texto

| Token | Valor | Para qué |
|---|---|---|
| `--color-tinta` | `#000000` | Texto principal, títulos, cifras. |
| `--color-tinta-muted` | `#5a5a58` | Texto secundario, label de campo, descripción. |
| `--color-tinta-tenue` | `#8c8b86` | Meta-texto, contador, ícono decorativo, placeholder. |

**Tres niveles, no dos.** La v4 tenía la regla "sólo dos niveles de texto; si
hace falta un tercero, lo que hace falta es otro peso o tamaño". Esa regla
funcionaba con un fondo gris y cards blancas, donde el fondo ya hacía parte de la
jerarquía. En una app toda blanca el texto tiene que cargar sola esa jerarquía, y
los diseños usan los tres niveles de forma muy consistente: **204 usos de
`#5a5a58` y 65 de `#8c8b86`, nunca intercambiados.**

La división es funcional, no de intensidad:

- **`--color-tinta`** — el dato.
- **`--color-tinta-muted`** — cómo se llama el dato, o qué significa.
- **`--color-tinta-tenue`** — algo que está ahí para contar, no para leer: un
  contador al lado de un tab, un chevron al final de una fila, el ícono dentro
  de un input.

Si dudás entre muted y tenue, la pregunta es: **¿si esto desapareciera, el
usuario perdería información?** Si sí, es muted. Si sólo perdería orientación, es
tenue.

### Accents funcionales

Ámbar y rojo **no están en el manual** y se usan igual, porque no se puede
señalar una deuda vencida con oliva. Entran bajo tres restricciones:

1. **Sólo en badges y en mensajes de error de campo.** Nunca en un botón, nunca
   como fondo de un bloque, nunca en un gráfico.
2. **Siempre apagados**, en la versión tint + texto. El pleno (`#dc2626`,
   `#d97706`) queda sólo para el borde de un input inválido y para el punto de
   alerta del sidebar.
3. **No son colores de marca.** Si aparecen en más de dos lugares de una
   pantalla, la pantalla está mal.

| Rol | Fondo | Texto | Cuándo |
|---|---|---|---|
| Resuelto / positivo | `--color-oliva-tint` `#eef0e3` | `--color-oliva-dark` `#4f5b30` | Pagado, entregado, terminado, al día |
| Atención | `--color-atencion-tint` `#fef3e2` | `--color-atencion-texto` `#9a4a07` | Vence pronto, sin entregar, sin comprobante |
| Problema | `--color-error-tint` `#fdecea` | `--color-error-texto` `#b42318` | Deuda vencida, saldo negativo, campo inválido |
| Neutro / pendiente | `--color-relleno` `#f3f2ee` | `--color-tinta-muted` `#5a5a58` | Presupuestado, sin empezar, opcional |

**El semáforo tiene cuatro posiciones, no cinco**: oliva = resuelto, ámbar =
requiere atención, rojo = problema, gris = neutro o todavía no empezó. No
inventar otro mapeo por pantalla.

### Lo que se retira

| Token | Valor | Por qué se va |
|---|---|---|
| `--color-acero` y derivados | `#64748b` | Gris frío, tampoco está en el manual. Pasa a `--color-tinta-muted` (y su tint a `--color-relleno`). |
| `--color-base-1` | `#fafafa` | Dos roles distintos que se separan (ver arriba). Lo que queda es `--color-superficie-suave`. |
| `--color-oscuro-*` | negro + grises | Dejan de ser "las superficies oscuras de la app". Quedan **sólo para el panel izquierdo del login**, que es la única pieza que sigue siendo de marca y no de producto. |

`--color-musgo` **no se retiró**: quedó como el verde del estado "terminado"
del semáforo funcional, oscurecido a `#15803d` para que alcance contraste como
texto (ver `constants/colores.js`). En el renombre de §20 pasó a llamarse
`--color-exito` (y `VERDE` a `EXITO` en `colores.js`).

### Progreso y datos

| Cosa | Color |
|---|---|
| Segmento de fase completado | `--color-oliva-claro` `#a8b36a` |
| Segmento de fase actual | `--color-oliva` `#6f7f45` |
| Segmento de fase pendiente | `--color-linea` `#e6e4df` |
| Punto de proyecto con alerta | `--color-error` `#dc2626` |
| Punto de proyecto sin alerta | `--color-oliva` `#6f7f45` |

En la cascada de rentabilidad (§análisis, variante 4d): **lo que suma va en
oliva, lo que resta en gris claro, los subtotales en negro**, y el valor va
escrito sobre cada barra — no se depende del tooltip para leer el número.

### Color desde el dato

Cuando el color viene de un dato (el estado de una fase, el tipo de
movimiento), **no va en el CSS**: sale de `constants/colores.js` y se aplica
inline. `colores.js` es el único lugar donde puede vivir un hex en JS, y sus
valores están duplicados a mano desde los tokens porque `recharts` y el atributo
`style` necesitan el hex plano. **Si cambia la paleta, hay que tocar los dos
lugares** — y en este rediseño hay que tocarlos.

Para el fondo tenue de esas pastillas se concatena `TINTE_PASTILLA` (`"1c"`, un
alfa en hex) al color: `` `${color}${TINTE_PASTILLA}` ``.

**`PALETA_GRAFICOS` se rehízo en el prompt 15.** Era
`[OLIVA, VERDE, NARANJA, AZUL, "#7c3aed", "#0891b2", ROJO, "#52525b"]`: un
violeta y un cian que no existen en ningún otro lugar del sistema. Para torta y
treemap hacen falta más series que colores tiene la marca, pero la salida no es
inventar colores nuevos — es **una rampa monocroma del oliva más los grises
cálidos**, que además es lo correcto para series que no tienen orden semántico.
Quedó así (con las constantes de `colores.js`):

```js
export const PALETA_GRAFICOS = [
  "#6f7f45", // oliva
  "#a8b36a", // oliva claro
  "#4f5b30", // oliva oscuro
  "#5a5a58", // gris oscuro
  "#c9cfae", // oliva muy claro
  "#8c8b86", // gris medio
  "#3d4624", // oliva profundo
  "#d9d7d2", // gris claro
];
```

---

## 3. Tipografía

**Public Sans** es la fuente de marca (manual §4), y la única: títulos y UI usan
`--font-ui`. (Hubo un `--font-display` con el mismo valor; se colapsó, ver §20.)
Se cargan los pesos 400–700 desde Google
Fonts en `index.html`.

> **Nota:** los diseños usan sólo 400/500/600/700. El peso 800 que se cargaba y
> nunca se usó se puede sacar del `<link>`.

### Escala

Nueve pasos, **recalibrados a los px exactos de los diseños**, más `--text-4xl`
(36px), la cifra única de una pantalla. Se mantienen los nombres de token y
cambian los valores.

| Token | v4 | v5 | = px | Rol |
|---|---|---|---|---|
| `--text-2xs` | `0.66rem` | `0.6875rem` | 11px | Abreviatura de mes, `badge--sm`. |
| `--text-xs` | `0.72rem` | `0.75rem` | 12px | Meta-texto, contador, hint, header de tabla, badge. |
| `--text-sm` | `0.82rem` | `0.8125rem` | 13px | **El tamaño más usado.** Texto secundario, label de campo, botón, chip. |
| `--text-base` | `0.9rem` | `0.875rem` | 14px | Texto de UI por defecto, valor de input, nombre en una fila. |
| `--text-md` | `0.95rem` | `0.9375rem` | 15px | Nombre destacado en una fila, título de bloque de formulario. |
| `--text-lg` | `1.05rem` | `1rem` | 16px | Título de sección, nombre en una card. |
| `--text-xl` | `1.25rem` | `1.125rem` | 18px | Título de modal. |
| `--text-2xl` | `1.6rem` | `1.5rem` | 24px | Título de una página de detalle, total grande de modal. |
| `--text-3xl` | `2rem` | `1.75rem` | 28px | Título de una página de listado; número grande de KPI. |

**Por qué rem y no px**, aunque los diseños estén en px: el usuario que subió el
tamaño de fuente del navegador sigue viendo la app más grande. Pasar a px rompe
eso en toda la app para ganar una coincidencia exacta con el mockup que nadie va
a medir. Los valores de arriba **son** los px del diseño a 16px de base.

**`--text-btn` ya no existe.** En la v4 estaba fuera de orden (`0.85rem`, entre
`sm` y `base`); en los diseños el texto de botón es 13px, o sea exactamente
`--text-sm`, y quedó un tiempo como alias. Se colapsó en el prompt 20 (§20).

**Los títulos bajan.** `--text-3xl` pasa de 32px a 28px y `--text-2xl` de 25.6 a
24. Los diseños usan títulos más chicos y apoyan la jerarquía en el peso 700 y en
el `letter-spacing` negativo, no en el tamaño.

### Jerarquía de títulos

```
Página de listado    --text-3xl   (Panel, Proyectos, Proveedores, Comparador, Cuentas)
Página de detalle    --text-2xl   (un proyecto, una fase, un proveedor)
  Modal              --text-xl
    Sección          --text-lg
      Bloque de form --text-md
```

Un título de sección dentro de un modal **no** es un título de sección de
página.

### Pesos

| Peso | Para qué |
|---|---|
| 400 | Cuerpo, valor de input, descripción. |
| 500 | **Label de campo, item de navegación inactivo.** |
| 600 | Nav activo, botón, valor en una fila, título de bloque. El default de cualquier cosa destacada. |
| 700 | `<h1>`, título de sección, totales, badges, cifras grandes. |

Nada de 800. Nada de 300. El peso 500 deja de ser "énfasis suave (raro)" y pasa
a tener un rol concreto: **es el peso de lo que nombra un control.**

### Letter-spacing y cifras

- `letter-spacing: -0.02em` en todo texto de 24px o más (`--text-2xl`,
  `--text-3xl`) y en el total de un modal. A tamaño grande el tracking por
  defecto de Public Sans se abre demasiado.
- `font-variant-numeric: tabular-nums` en **toda cifra que pueda alinearse con
  otra**: columna de importes, total, KPI. Es la utilidad `.cifra`.

### Mayúsculas

**Se retiran.** En la v4 los micro-labels iban en mayúsculas con
`letter-spacing: 0.03em` vía `.label-ficha`. En los diseños de la v5 las
mayúsculas aparecen **una sola vez en todo el material**: la abreviatura de mes
dentro del cuadradito de fecha de una fila de compra.

El label de campo pasa a ser **caja normal, 13px, peso 500, `--color-tinta-muted`**,
pegado arriba del campo con `gap: --space-1-5`. Por eso `.label-ficha` se
renombra a **`.label-campo`**: el nombre viejo describía una ficha de datos en
mayúsculas que ya no existe. Son 8 archivos `.jsx` y 2 `.css`.

El sufijo de opcionalidad va en el mismo label, en `--color-tinta-tenue` y peso
400: `Fase <span>(opcional)</span>`.

---

## 4. Espaciado

Escala de 4px con dos medios pasos, **más tres pasos nuevos** que los diseños
usan y la v4 no tenía.

| Token | Valor | |
|---|---|---|
| `--space-1` | `4px` | |
| `--space-1-5` | `6px` | medio paso |
| `--space-2` | `8px` | |
| `--space-2-5` | `10px` | medio paso |
| `--space-3` | `12px` | |
| `--space-4` | `16px` | |
| `--space-5` | `20px` | **nuevo** |
| `--space-6` | `24px` | |
| `--space-7` | `28px` | **nuevo** |
| `--space-8` | `32px` | |
| `--space-9` | `36px` | **nuevo** |
| `--space-10` | `40px` | **nuevo** |
| `--space-12` | `48px` | |
| `--space-16` | `64px` | |

**Por qué 6px y 10px si rompen la escala:** eran los dos gaps más usados de la
app (41 y 19 apariciones, más que `--space-2`), y los diseños los confirman — 6px
es el gap canónico entre un ícono y su texto, en los tres archivos.

**Por qué los cuatro nuevos:** 20, 28, 36 y 40 aparecen en los diseños con roles
que no se pueden resolver con los vecinos. 20 es el gap entre secciones del
sidebar y entre bloques del cuerpo de un modal chico; 28 es el gap vertical del
`<main>` y el gap horizontal entre tabs; 36 separa la ficha lateral del contenido
en el detalle de proveedor; 40 es el padding horizontal del `<main>`. Redondearlos
a 24/32/48 cambiaría la densidad de todas las pantallas.

**Fuera de esta lista no se agrega nada.** Doce pasos ya es mucho; la disciplina
está en los padding canónicos de abajo, no en tener pocos tokens.

### Padding canónicos

Lo que más importa no es la escala sino que **las mismas cosas midan lo mismo**:

| Cosa | Padding |
|---|---|
| `<main>` de una página | `--space-8 --space-10` (32 / 40) |
| Card | `18px`† |
| Panel suave (sin borde) | `--space-4` |
| Cuerpo de modal | `--space-6` |
| Pie de modal | `--space-4 --space-6` |
| Header de modal | `0 --space-6`, alto 64px |
| Fila de tabla | vertical según alto de fila; horizontal `0` o `--space-4` |
| Badge | `0 --space-2` con `line-height: 22px` |

† **18px es la única excepción a la escala de 4** y es deliberada: es el padding
de card en todos los diseños. 16 deja la card apretada contra su borde y 20 la
infla. Se declara como `--space-card: 18px`, con nombre de rol y no de número,
justamente para que no se use como paso general.

**El espaciado lo pone el layout, no cada elemento.** Preferí `gap` en un
contenedor flex o grid antes que márgenes sueltos en cada hijo.

---

## 5. Layout y responsive

`MainLayout` es sidebar fijo + contenido. El contenido tiene
`padding: --space-8 --space-10` en desktop y `--space-4` en móvil.

**El sidebar pasa de 212px a 232px** (el valor de los diseños). Sigue siendo
`position: sticky` midiendo el alto del viewport (`100dvh`, con `100vh` de
fallback): el único tramo que scrollea por dentro es `.sidebar-nav`, así el
footer (usuario + cerrar sesión) queda siempre visible. `dvh` y no `vh` porque
con la barra de direcciones retráctil de Safari/iOS `100vh` es el viewport
*grande* y el footer cae abajo del borde visible, sin forma de alcanzarlo.

**La red de contención de scroll horizontal va `overflow-x: hidden` en `html` y
`overflow-x: clip` en `body` — nunca `hidden` en los dos.** `hidden` en el
`body` lo convierte en contenedor de scroll propio, y desde ahí todo
`position: sticky` de adentro se pega al scrollport del body (que nunca
scrollea) en vez de al del viewport: el sidebar deja de quedarse fijo. `clip`
recorta igual sin crear contenedor de scroll.

### Breakpoints

**Tres, y uno estructural.** Antes había once, y cuatro de ellos (600, 640, 700,
720) resolvían exactamente lo mismo.

| Breakpoint | Qué cambia |
|---|---|
| `max-width: 640px` | Móvil. Las grillas pasan a una columna, los encabezados se apilan, los botones ocupan el ancho. |
| `max-width: 900px` | Tablet. Las planillas pasan a scroll horizontal con columnas de ancho fijo; los modales anchos pierden el riel; la ficha lateral del detalle de proveedor pasa arriba del contenido. |
| `max-width: 768px` | **Sólo el sidebar.** Es un cambio estructural (de columna lateral a barra superior), no de densidad. Lo comparten `Sidebar.css` y `MainLayout.css`, que tienen que moverse juntos. |

Responsive no es sólo "que entre": el sistema visual tiene que ser el mismo en
las tres.

---

## 6. Movimiento

Una sola duración: `--transicion` (`0.15s ease`). Se anima **color, fondo,
borde y sombra**; no se animan tamaños ni posiciones salvo que el componente lo
pida (la barra de progreso del KPI, la entrada del modal).

La sombra entra en la lista porque en la v5 el hover de una card clickeable
agrega sombra (§7). Sin transición, aparece de golpe y se lee como un salto.

La app entera respeta `prefers-reduced-motion` con una regla global en
`index.css`. **No hace falta repetirla por componente.**

---

## 7. Geometría — radios y sombras

### Radios

La v4 tenía un solo radio (6px) y la regla "si algo tiene un radio distinto y no
es una pastilla, está mal". La v5 tiene **cinco, y el radio pasa a codificar
escala**: cuanto más grande el contenedor, más grande el radio.

| Token | Valor | Para qué |
|---|---|---|
| `--radius-xs` | `4px` | **Badge de estado.** Nada más. |
| `--radius-sm` | `6px` | Control chico: botón de toolbar, item de nav, buscador, botón de sólo ícono. |
| `--radius-md` | `8px` | Input (40px de alto), botón de modal, avatar de 32px, chip-opción, cuadrito de ícono. |
| `--radius-lg` | `10px` | Card, panel suave, cuadrito de fecha de 48px. |
| `--radius-xl` | `14px` | **Modal.** Nada más. |
| `--radius-pill` | `999px` | Chip de filtro, punto de estado, barra de progreso. |

**La regla para no volver al desorden**: el radio sale del **alto del elemento**,
no del gusto.

| Alto del elemento | Radio |
|---|---|
| ≤ 22px (badge) | `--radius-xs` |
| 28–36px | `--radius-sm` |
| 38–44px | `--radius-md` |
| contenedor con padding propio | `--radius-lg` |
| modal | `--radius-xl` |
| cualquier cosa que sea una pastilla | `--radius-pill` |

Si tenés que elegir un radio y no sabés cuál, medí el alto. Si el elemento no
tiene alto fijo, es un contenedor: `--radius-lg`.

**Se invierte el significado del radio pill.** En la v4 el radio grande era "la
marca de que esto es una etiqueta" y los badges eran pills. En la v5 es al
revés: **el badge de estado es un rectángulo de 4px, y el pill está reservado a
los controles** (chip de filtro) y a las formas que son geométricamente
redondas (punto, barra de progreso). El motivo es que en los diseños los badges
aparecen pegados a cifras y a texto en filas densas, y la pastilla redonda
compite visualmente con el texto; el rectángulo de 4px se apoya en la línea de
base y desaparece como forma. Es el cambio de detalle que más se nota.

### Sombras

La v5 sigue siendo **plana + borde**. Una card en reposo **no lleva sombra**: se
separa con `--color-linea`. La sombra significa "esto está por encima de la
página", y si se usa en todos lados deja de significarlo.

| Token | Valor | Para qué |
|---|---|---|
| `--shadow-hover` | `0 4px 16px rgba(0,0,0,.05)` | **Sólo hover de card clickeable**, junto con el borde a `--color-linea-fuerte`. |
| `--shadow-overlay` | `0 12px 32px rgba(24,24,27,.16)` | Lo que flota dentro de la página: popover, select flotante, tooltip, toast. |
| `--shadow-modal` | `0 24px 64px rgba(0,0,0,.22)` | **Sólo el modal.** |
| `--shadow-foco` | `0 0 0 3px #eef0e3` | Anillo de foco (ver §15). No es elevación: es estado. |

Tres niveles de elevación con tres sombras bien separadas. Que el modal tenga su
propia sombra, mucho más profunda que la del popover, es lo que hace que el
overlay al 55% no tenga que trabajar solo.

---

## 8. Botones

`.btn` da la forma; una variante da el color. Siempre las dos clases.

```html
<button class="btn btn-primary">Nuevo proyecto</button>
```

**La base pasa de padding a alto fijo.** En la v4 era `padding: 10px 18px` y el
alto salía del contenido. En los diseños los botones tienen alto declarado, y eso
es lo que los hace alinear con los inputs y con las filas sin pelear.

| Tamaño | Alto | Radio | Texto | Padding | Dónde |
|---|---|---|---|---|---|
| `.btn--sm` | 30px | `--radius-sm` | `--text-sm` | `0 --space-3` | Acción de fila, encabezado denso |
| `.btn` (default) | 32px | `--radius-sm` | `--text-sm` | `0 --space-3` | Toolbar de página |
| `.btn--lg` | 38px | `--radius-md` | `--text-base` | `0 --space-4` (relleno: `0 18px`) | **Pie de modal** |

Gap ícono–texto: `--space-1-5` (6px), siempre.

| Variante | Cuándo |
|---|---|
| `.btn-primary` | La acción principal de la pantalla. **Una sola por vista.** Oliva relleno, texto blanco. |
| `.btn-secondary` | Todo lo demás. Fondo blanco, borde `--color-linea`, texto `--color-tinta`. |
| `.btn-marca` | Acción secundaria que pertenece a la marca — hoy, "Importar catálogo" y "Autocompletar con IA". Fondo `--color-oliva-tint`, borde `#d6dbbf`, texto `--color-oliva-dark`. |
| `.btn-peligro` | Eliminar. Contorno rojo que se rellena en hover. |

**`.btn-marca` cambia de forma, no de rol.** En la v4 era contorno oliva; en los
diseños la acción de IA es un botón **relleno en tint oliva** con borde en un
oliva desaturado. Se lee como acento de marca sin competir con el primario, que
es el único oliva sólido de la pantalla. Si la acción no es de marca, va
`.btn-secondary` — no es un secundario alternativo.

**El borde de 1px va en todas las variantes**, transparente en las rellenas, así
todas miden igual.

### Botones de sólo ícono

`.btn-icono`, **32×32** (`--sm`: 28×28), radio `--radius-sm`, con el ícono a
**16px** (`--sm`: 14px). En la v4 eran 28/24 con ícono a 14; los diseños los usan
a 32 para que midan igual que el botón de toolbar que tienen al lado.

| Modificador | Cuándo |
|---|---|
| `.btn-icono--sm` | Dentro de una fila de tabla o una card compacta. |
| `.btn-icono--contorno` | Cuando tiene que leerse como control aunque la fila no esté en hover. |
| `.btn-icono--peligro` | Eliminar. |

**Siempre con `aria-label`.** Un ícono solo no tiene nombre accesible, y `title`
no alcanza (no se muestra en touch).

### Acciones de fila: la excepción que se mantiene

Los diseños muestran las acciones de fila **apareciendo en hover** (está escrito
explícitamente en las notas de 4a y de 4p). **No se adopta tal cual.** En touch
el hover no existe y las acciones quedan inalcanzables, que es el bug que la v4
ya arregló una vez.

La regla de la v5: **las acciones de fila se ven siempre en touch y en pantallas
chicas, y aparecen en hover en desktop con puntero fino.**

```css
@media (hover: hover) and (pointer: fine) {
  .planilla__fila .acciones { opacity: 0; }
  .planilla__fila:hover .acciones,
  .planilla__fila:focus-within .acciones { opacity: 1; }
}
```

El `:focus-within` no es opcional: sin él las acciones son inalcanzables por
teclado, que es el mismo bug en otra forma.

---

## 9. Campos y formularios

`.campo` es la geometría única de input, select y textarea.

| Propiedad | Valor |
|---|---|
| Alto | **40px** (textarea: alto libre, mismo padding) |
| Radio | `--radius-md` (8px) |
| Borde | `1px solid --color-linea` |
| Fondo | `--color-superficie` (**blanco**, no gris) |
| Texto | `--text-base` (14px) |
| Padding | `0 --space-3` |
| Gap interno | `--space-2` (ícono, prefijo, chevron) |
| Ícono / chevron | `--color-tinta-tenue`, 16px |

**El campo pasa a fondo blanco.** En la v4 el input en reposo era `#fafafa` sobre
una página `#fafafa`: se definía por el borde igual, pero el gris no hacía nada.
En una página blanca, el campo blanco con borde es más limpio y hace que el único
control con relleno (el buscador) se lea como distinto a propósito.

| Modificador | Cuándo |
|---|---|
| `.campo--sm` | Fila de tabla editable (alto 32px, radio `--radius-sm`). |
| `.campo--error` | Validación fallida. Borde `--color-error`. |
| `.campo--monto` | Monto destacado: `--text-lg` / 600 / `.cifra`, con la moneda como prefijo tenue adentro. |

### Anatomía de un campo

```
label            --text-sm / 500 / --color-tinta-muted
  ↕ --space-1-5
caja             40px / --radius-md / borde --color-linea
  ↕ --space-1-5
hint o error     --text-xs / --color-tinta-muted o --color-error-texto
```

- **Label**: `.label-campo`, caja normal (ver §3). El `(opcional)` va adentro del
  label, en `--color-tinta-tenue` / 400.
- **Error**: `.campo-error` debajo del campo, con ícono de alerta a 14px, en
  `--color-error-texto`. Se muestra `onChange`, no recién al hacer submit.
- **Validación nativa**: `:user-invalid`, nunca `:invalid` — este último pinta
  de rojo campos que el usuario todavía no tocó.
- **Hint**: misma posición que el error, en `--color-tinta-muted`. Nunca los dos
  a la vez.

### Foco

Borde a `--color-oliva` **más** `--shadow-foco` (`0 0 0 3px #eef0e3`). El
anillo de 3px en tint oliva es lo que hace el foco inequívoco sin un outline que
se pelee con el radio del campo. Es el mismo tratamiento en input, select,
textarea y chip-opción.

### El monto y la conversión

El campo de monto **lleva la moneda adentro** como prefijo en
`--color-tinta-tenue`, y la conversión a la otra moneda **al lado, dentro de la
misma caja**, en `--text-xs` / `--color-tinta-muted`:

```
┌──────────────────────────────────────┐
│ $   28.000              ≈ US$ 19     │
└──────────────────────────────────────┘
```

Se actualiza mientras se escribe. Debajo, como hint, de dónde sale la cotización
y un link para cambiarla: `Dólar blue $ 1.450 del 01/10 · cambiar`.

### Controles de opción

Tres formas, y **cuál se usa depende de cuántas opciones hay y si son
excluyentes**:

| Forma | Cuándo | Geometría |
|---|---|---|
| **Segmentado** | 2–3 opciones excluyentes y cortas (Pago: contado/cuenta corriente). | Track `--color-linea-suave`, padding 3px, radio `--radius-md`; botones de 32px, radio `--radius-sm`, el activo en blanco con `--shadow-hover` |
| **Chip-opción** | 4–6 opciones excluyentes (Tipo de factura, Condición de pago). | 34px, radio `--radius-md`, borde; activo: borde `--color-oliva` + fondo `--color-oliva-sel` |
| **Chip de filtro** | Filtros acumulables de una lista o un historial. | 28–30px, `--radius-pill`; el de "agregar" con borde punteado `--color-linea-fuerte` |

**Nada de switches ni de desplegables para esto.** Es el cambio de criterio más
fuerte de los modales: en la v4 el tipo de factura era un `<select>` y los
estados eran switches. Un desplegable esconde las opciones y cuesta dos clicks;
un switch miente sobre que hay dos estados simétricos cuando en realidad son dos
valores de un dato. Con 6 opciones o menos, **se muestran todas**.

### Búsqueda

`<Buscador>`: alto 32–36px, radio `--radius-sm`, fondo `--color-relleno`,
**sin borde**, texto e ícono en `--color-tinta-muted`. Es el único control de la
app con relleno gris, y eso es lo que lo hace reconocible de un vistazo.

Nunca un input suelto adentro de un div con borde: eso fue lo que dejó dos de las
tres búsquedas de la app sin ningún indicador de foco visible.

**Formularios que hacen lo mismo tienen que sentirse iguales.** Login, alta de
cuenta y los modales de carga comparten altura de campo, label y mensaje de
error.

---

## 10. Superficies y cards

Una card es: fondo `--color-superficie`, borde `1px solid --color-linea`,
`--radius-lg`, padding `--space-card` (18px), gap interno `--space-4`.
**Sin sombra en reposo.**

Si es clickeable, en hover: borde a `--color-linea-fuerte` **y**
`--shadow-hover`. En la v4 el hover oscurecía el borde a tinta y pintaba el
fondo; en la v5 el fondo queda blanco y el cambio lo hace la sombra. Con un
fondo de página blanco, pintar el fondo de la card en hover la hacía desaparecer.

Una card de algo **terminado o inactivo** va con `opacity: .75`. No se tacha y no
se pinta de gris: atenuar conserva la legibilidad y dice "esto ya pasó" sin
agregar un color al sistema.

**Panel suave**: la variante sin borde, para resúmenes embebidos (el "Comprado
histórico" de la ficha de proveedor). Fondo `--color-superficie-suave`, sin
borde, `--radius-lg`, padding `--space-4`. Se usa cuando el bloque está *dentro*
de otra cosa y un borde más sería una caja dentro de una caja.

**No hay un componente `<Card>` genérico y es a propósito.** Las cards de la app
(proveedor, mini-seguimiento, nota, ítem de cuenta) comparten la receta de
superficie pero tienen contenidos y densidades genuinamente distintas: un
componente único terminaría con seis props de layout y sería peor que el CSS de
cada uno. Lo compartido es la receta, no la estructura.

Lo que sí tiene que ser igual: **cards que cumplen la misma función tienen el
mismo padding y el mismo alto.**

---

## 11. Tablas y listas

`.planilla` es la tabla en grid de la app. Da el chrome y **cada uso pone nada
más sus `grid-template-columns`**.

```html
<div class="planilla mi-tabla">
  <div class="planilla__header mi-tabla-header">…</div>
  <div class="planilla__fila mi-tabla-fila">…</div>
</div>
```

| Parte | v5 |
|---|---|
| Contenedor | **Sin borde ni radio propios.** Es una lista, no una caja. |
| Header | Sólo cuando hace falta: alto 32px, fondo `--color-superficie-suave`, `--text-xs` / 600 / `--color-tinta-muted`. En una lista de página se puede omitir. |
| Fila | `min-height: 54px`, `border-bottom: 1px solid --color-linea-suave`, gap `--space-4` |
| Hover de fila | `--color-superficie-suave` |
| Última fila | sin borde |
| Total | fila propia, `--text-base` / 700, sin borde, con `.cifra` |
| Números | `.cifra` (`tabular-nums`), alineados a la derecha |
| Chevron final | 16px, `--color-tinta-tenue` |

**La planilla pierde su caja.** En la v4 tenía borde y radio: era una card con
filas adentro. En los diseños las listas no tienen contorno — las filas se
separan entre sí con `--color-linea-suave` y la lista se apoya directamente en el
blanco de la página. Es el cambio que más aire le da a las pantallas de listado,
y es también por qué hacen falta dos niveles de línea (§2).

El header deja de ser obligatorio. En una lista donde cada fila ya dice qué es
cada dato (nombre arriba, meta abajo, importe a la derecha), el header es una
fila de labels que no agrega nada. Se usa en tablas de verdad —columnas de
números comparables— y dentro de modales.

**En `max-width: 900px`** pasa a scroll horizontal con columnas de ancho fijo.

**Cuando definas un ancho o un overflow que compita con `.planilla`, usá doble
clase** (`.planilla.mi-tabla`): las dos tienen la misma especificidad y sin eso
quién gana depende del orden en que Vite arma el bundle — que a su vez depende
del camino de navegación del usuario, porque el CSS sale code-splitteado por
ruta. Es un bug real que ya pasó una vez con el padding de los modales.

Lista vacía: `<EstadoVacio>`, nunca un `<p>` suelto.

---

## 12. Badges y chips

### Badge

`.badge` da **la forma**; el color lo pone quien la usa.

```html
<span class="badge badge--exito">Pagado</span>
<span class="badge" style="{{ color, backgroundColor }}">En curso</span>
```

Base: `padding: 0 --space-2`, `line-height: 22px`, `--text-xs`, peso 600,
**`--radius-xs`** (4px). `.badge--sm` (`0 --space-1-5`, `line-height: 20px`,
`--text-2xs`) para dentro de una fila densa.

El `line-height` en vez de padding vertical es lo que mantiene el alto exacto en
22px sin importar la fuente. No le pongas `padding-block`.

Variantes: `--neutro`, `--exito`, `--atencion`, `--peligro`, `--marca`. Los pares
fondo/texto salen de la tabla de §2. Cuando el color viene del dato, va inline.

Un badge puede llevar un ícono a 14px con gap `--space-1` (`{icono}Pagado`), y es
lo que hace legible tener dos badges seguidos: `🗒 Pagado` + `🚚 Entregado`.

### Chip

`.chip` es **un control**, no un badge: tiene hover, foco y estado. Vive en
`index.css` como utilidad propia justamente para que nadie vuelva a resolverlo
con `.badge` y un `onClick`.

| Variante | Forma |
|---|---|
| `.chip` | 30px, `--radius-pill`, borde `--color-linea`, fondo blanco |
| `.chip--activo` | borde `--color-oliva`, fondo `--color-oliva-sel`, peso 600 |
| `.chip--agregar` | borde `1px dashed --color-linea-fuerte`, texto muted, con `+` a la izquierda |
| `.chip--quitable` | con una `×` a la derecha a 20px, fondo `--color-relleno` |
| `.chip--opcion` | 34px, `--radius-md` — el de formularios (§9) |

Un chip puede llevar un contador a la derecha en `--text-xs` /
`--color-tinta-tenue`: `Todos 5`.

**Ojo con el ancho fijo.** `.badge` es `inline-flex`, así que `text-align:
center` no centra nada: el texto es un ítem flex y lo alinea `justify-content`.

---

## 13. Navegación

### Sidebar

**Blanco**, 232px, sticky. Es el cambio más visible de la v5.

| Parte | Spec |
|---|---|
| Contenedor | fondo `--color-superficie`, `border-right: 1px solid --color-linea`, padding `--space-6 --space-4 --space-4`, gap `--space-6` |
| Logo | isotipo a 28px + "Home Solutions" en `--text-sm` / 700 / `line-height: 1.1` |
| Item de nav | alto 36px, `--radius-sm`, padding `0 --space-2`, gap `--space-3`, ícono 16px |
| Item inactivo | texto `--color-tinta-muted`, peso 500 |
| Item activo | texto e ícono `--color-oliva`, fondo `--color-oliva-sel`, peso 600 |
| Hover | fondo `--color-relleno` |
| Contador | a la derecha, `--text-xs`, `--color-tinta-tenue` |
| Grupo "En curso" | label en `--text-xs` / 600 / `--color-tinta-tenue`; items de 32px con punto de 7px |
| Footer | avatar 32px `--radius-pill` en tint oliva, nombre `--text-base` / 600, rol `--text-xs` muted, separado por `border-top` |

**El item activo pierde el borde izquierdo.** En la v4 era fondo tenue + borde
izquierdo oliva + ícono oliva. En los diseños es fondo + texto e ícono en oliva,
sin borde. Un indicador alcanza, y el borde izquierdo peleaba con el radio del
item.

Los `--color-oscuro-*` quedan **sólo para el panel izquierdo del login**.

### Tabs

Alto 40px, gap `--space-7` (28px) entre tabs, `border-bottom: 1px solid
--color-linea` en el contenedor. La activa: `border-bottom: 2px solid
--color-oliva` con `margin-bottom: -1px`, texto `--color-tinta` / 600. Las
demás: `--color-tinta-muted` / 500. Ícono a 15px, contador a la derecha en
`--text-xs` / `--color-tinta-tenue`.

El `margin-bottom: -1px` es lo que hace que la línea de 2px tape la de 1px del
contenedor en vez de apilarse debajo.

Una tab puede llevar un badge de pendientes: `--text-2xs` / 700 /
`line-height: 18px` / `min-width: 18px` / `--radius-pill`, en el par de atención.

### Breadcrumbs y título

- **Breadcrumbs** (`<Breadcrumbs>`): en toda página de detalle, siempre.
  `--text-sm`, muted, separador `/` en `--color-linea-fuerte`, último tramo en
  `--color-tinta` / 500.
- **Título de página**: `<PageHeader>`, siempre. Nunca un `<h1>` suelto. Puede
  llevar un badge de estado al lado, y debajo una fila de meta-datos con íconos a
  15px en muted (`gap: --space-1-5 --space-5`).

El estado activo se marca **siempre** con oliva, en los tres.

---

## 14. Modales

### Anchos

**Tres, y se cierra el pendiente de la v4** (que tenía cinco: 440, 620, 660, 860,
900).

| Ancho | Cuándo |
|---|---|
| **560px** | Todo alta y edición por formulario: gasto, cobro, fase, proyecto, producto, proveedor, categoría, confirmación. |
| **760px** | Carga en pasos — hoy sólo Nueva compra. |
| **960px** | Formulario con riel de resumen fijo de 300px. |

Los cuatro modales chicos de los diseños venían en 560/560/520/560; **se unifican
en 560**. Que "Nueva fase" sea 40px más angosto porque tiene menos campos no es
información para el usuario, es ruido.

### Estructura común

| Parte | Spec |
|---|---|
| Overlay | `rgb(0 0 0 / 55%)`, `z-index: 1000`. Click afuera cierra. |
| Caja | blanco, `--radius-xl` (14px), `--shadow-modal` |
| **Alto** | **variable, `max-height: 88vh`** — ver abajo |
| Header | alto 64px, padding `0 --space-6`, `border-bottom: 1px solid --color-linea` |
| Cuerpo | padding `--space-6`, gap `--space-5` a `--space-7` entre bloques, scroll propio |
| Pie | padding `--space-4 --space-6`, `border-top`, acciones a la derecha con gap `--space-2` |

**El alto es variable y es un arreglo, no un detalle.** En los diseños el frame
está en 880px fijo con el cuerpo en `flex: 1`, así que con pocos ítems cargados
queda un hueco muerto entre el último campo y el pie. Con `max-height: 88vh` y el
cuerpo en `flex: 0 1 auto`, el modal se encoge hasta su contenido y el hueco
desaparece. El scroll aparece sólo cuando de verdad hace falta.

**El borde superior de 4px en oliva se retira.** Era de la v4 y no está en
ninguno de los seis modales diseñados; con un radio de 14px una franja de color
arriba corta la curva.

### Header

Cuadradito de 32px (`--radius-md`, fondo `--color-relleno`) con el ícono del tipo
de operación, título en `--text-xl` / 700, y **el contexto del proyecto a la
derecha del título**, separado por `border-left: 1px solid --color-linea` y
`padding-left: --space-3`, en `--text-sm` / muted con su ícono.

**El header oscuro se retira y los dos shells se unifican.** En la v4 había dos:
`<ModalShell>` con header claro para alta/edición, y `DetalleShell`/`EditarShell`
con header **oscuro** para ver un movimiento, "porque el header oscuro es lo que
distingue mirar de cargar". En la v5 eso lo dice el ícono y el título, no el
color de fondo: un header negro en una app sin superficies oscuras es un resto de
la v4. Esto permite colapsar `ModalDetalle.css` y `ModalEditar.css` contra el
shell, que es el otro pendiente de la v4.

### El proyecto deja de ser un campo

Cuando el modal se abre parado en un proyecto, el proyecto **no es un campo
deshabilitado**: va en el header como contexto. Un campo que no se puede editar
le pide al usuario que lo lea como si fuera una decisión suya.

### Comprobante primero

El archivo se sube **arriba de todo**, antes de los campos, y "Autocompletar con
IA" va **al lado del archivo** — no en la toolbar ni en el pie. El botón necesita
el archivo para funcionar, así que tiene que estar donde el archivo está.

Zona de drop vacía: alto 52px, `border: 1px dashed #c9cfae`, fondo `#fbfbf7`,
`--radius-lg`, con el ícono de clip en oliva. Con archivo cargado: fila de 60px
con el ícono en un cuadrito blanco, nombre + tipo/peso, el botón de IA
(`.btn-marca`) y una `×` para quitarlo.

### Nueva compra: el híbrido 5ab

De los dos diseños (5a "formulario + riel", 5b "3 pasos") se toma un mix:

- **Shell de 5b**: 760px, 3 pasos con barritas de progreso de 3px arriba del
  label de cada paso.
- **Alto variable** (`max-height: 88vh`), por lo de arriba.
- **Chips de 5a**: *Tipo de factura* y *Condición de pago* quedan **visibles y
  clickeables** como chip-opción en el paso que les toca. No se colapsan detrás
  de un link *Editar*: son dos decisiones de una sola vez, y esconderlas para
  ahorrar alto en un modal que ahora se encoge solo no compra nada.
- **Pie en dos niveles**: el desglose (`Neto $ … · impuestos $ … · ≈ US$ …`) en
  su propia fila sobre `--color-superficie-suave`, y abajo el total en
  `--text-2xl` / 700 / `.cifra` a la izquierda con los botones a la derecha. En
  5b el total de 22px y su subline de 12px se peleaban en una barra de 14px de
  padding.

El total **nunca se pierde de vista** al llenar el formulario: el pie es fijo.

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

## 15. Drawers

**No hay drawers en la app y la v5 no los introduce.**

Vale dejarlo escrito porque es la pregunta que aparece sola al ver el detalle de
proveedor (variante 4p): ahí hay un panel lateral de 272px con la ficha del
proveedor. **Eso no es un drawer**: es una columna del layout de la página
(`grid-template-columns: 272px minmax(0,1fr)` con `gap: --space-9`), siempre
visible, que en `max-width: 900px` pasa arriba del contenido. Lo mismo el panel
de 288px de la variante 4h.

Un drawer —un panel que entra desde el borde por encima del contenido— no
aparece en ninguno de los diseños. **Si en algún momento hace falta uno, se
define acá primero**, y el default razonable será: mismas reglas de teclado que
el modal (`useModal`), `--shadow-modal`, radio sólo en los dos cantos que no
tocan el borde, y ancho de 400px. Pero no se implementa "por si acaso": un
contenedor sin un caso de uso concreto termina siendo un modal con otra
animación.

---

## 16. Estados

| Estado | Componente | Se ve como |
|---|---|---|
| Cargando (página o sección) | `<Cargando>` | Isotipo de marca pulsando + texto de qué se está cargando. `compacto` para una sección. |
| Esperando (dentro de un control) | `<LogoCargando>` | El mismo isotipo, a 13–14px, reemplazando al ícono del botón. |
| Cargando (Panel) | `.skeleton` | **Excepción a propósito.** Sólo donde el layout es estable y conocido de antemano. No replicar. |
| Vacío | `<EstadoVacio>` | Isotipo de marca a baja opacidad + mensaje muted. `grande` para página entera. |
| Error | `<EstadoError>` | Ícono `CircleAlert` + mensaje en `--color-error-texto`, con `role="alert"`. |
| Éxito | `<ToastStack>` | Toast abajo a la derecha, con borde izquierdo del color del resultado. |
| Deshabilitado | `:disabled` | `opacity: .5` (controles) o `.6` (campos) + `cursor: not-allowed`. |
| Inactivo / terminado | `opacity: .75` | Card o fila de algo que ya pasó. **No se tacha.** |

**Un error nunca se ve como un vacío.** Son situaciones opuestas: una es normal,
la otra pide una acción.

**Lo terminado se atenúa, no se tacha.** Está explícito en las notas de los
diseños de fases. El tachado hace el texto más difícil de leer para decir algo
que la posición en la lista y el badge ya dicen.

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
- **La variante importa.** Sobre un fondo oliva sólido (`.btn-primary`) va
  `variante="blanco"`: el isotipo oliva es exactamente `--color-oliva`, así
  que sobre ese fondo queda invisible. Sobre `.btn-marca`, que ahora es tint
  oliva con texto oscuro, va la variante normal.

No rota ni rebota a propósito: el pulso lento se lee como "procesando",
mientras que girar o rebotar se siente más a "cargando indefinidamente".

### Foco

Dos mecanismos, y **cuál se usa depende de si el elemento tiene borde propio**:

- **Campos y chips** (tienen borde): borde a `--color-oliva` +
  `--shadow-foco`. Ver §9.
- **Todo lo demás** (botones, links, filas, `[tabindex]`): la regla global de
  `:focus-visible` — outline oliva de 2px con `offset: 2px`.

**Cualquier control custom tiene que caer en una de las dos o replicarla.** Si le
ponés `outline: none` a un input anidado, acordate de pintar el foco en el
contenedor con `:focus-within`.

---

## 17. Iconos

**`lucide-react`, sin excepciones.** No mezclar con SVGs sueltos ni con otra
librería. Ya está en `package.json`.

| Tamaño | Cuándo |
|---|---|
| 14px | Dentro de un badge, en una fila muy densa. |
| 15px | Meta-dato de un header, ícono de tab, ícono de contacto. |
| 16px | **Estándar**: item de nav, botón, campo, chevron de fila. |
| 20px | Destacado: encabezado de sección, estado vacío. |

**`strokeWidth={1.75}` por defecto**, no 2. Es el valor de los diseños, en los
seis archivos, y es lo que hace que los íconos no pesen más que el texto al que
acompañan ahora que el texto es negro puro. A 14px o menos se permite `2`, donde
el trazo fino se pierde.

El trazo nunca varía dentro de una misma fila o grupo: un ícono a 2 al lado de
uno a 1.75 se ve más oscuro y parece un estado distinto.

Color: `currentColor` cuando el ícono acompaña al texto (hereda el nivel que
corresponda), `--color-tinta-tenue` cuando es decorativo o de orientación
(chevron, ícono dentro de un campo, clip de adjunto).

Un ícono decorativo lleva `aria-hidden="true"`. Un ícono que **es** el control
lleva `aria-label`.

---

## 18. Convenciones de CSS

- **BEM**: `bloque__elemento--modificador`, en kebab-case. Aplica a las clases
  propias de cada componente, no a las utilidades globales (`.btn`, `.badge`,
  `.chip`, `.campo`, `.planilla`, `.label-campo`, `.cifra`, `.campo-error`), que
  son intencionalmente globales.
- **Un `.css` por componente**, importado desde su `.jsx`.
- **Los selectores genéricos se definen en un solo archivo.** Los `.modal-*` van
  sólo en `modal-base.css`; las utilidades sólo en `index.css`.
- **Cuidado con la especificidad.** El CSS sale code-splitteado por ruta, así que
  entre dos selectores de igual especificidad gana el que Vite ponga último — y
  eso depende de por dónde navegó el usuario. Si necesitás ganarle a una
  utilidad, usá doble clase, no `!important`.
- **`!important` está prohibido** salvo en la regla de `prefers-reduced-motion`.
- **Comentá el porqué, no el qué.** El valor se lee solo; lo que no se lee es qué
  problema resolvía.

---

## 19. Ejecución

El orden importa: cada fase tiene que poder mirarse en la app y revertirse sola.

| Fase | Qué | Riesgo |
|---|---|---|
| **0** | Este documento. | Ninguno. |
| **1** | Valores de token en `index.css` + `colores.js`. Paleta cálida, escala recalibrada, radios y sombras nuevas. **Sin tocar un solo componente.** | Bajo. Es un commit reversible. Al final: mirar la app entera y anotar qué quedó raro antes de seguir. |
| **2** | Sidebar blanco + fondo blanco (`Sidebar.css`, `MainLayout.css`, `App.css`). | Medio. Es el salto estético visible. |
| **3** | Utilidades de `index.css`: `.btn` a alto fijo, `.campo` a 40px, `.badge` a radio 4, `.planilla` sin caja, `.chip` nueva, `.label-ficha` → `.label-campo`. | Medio-alto: toca todo a la vez, pero en un solo archivo. |
| **4** | Modales: unificar shells, anchos a 560/760/960, alto variable, header claro, comprobante primero, chips en vez de selects y switches. | Alto. Son 14 modales. Ir de a uno. |
| **5** | Pantallas, en el orden de las variantes elegidas: Panel (4i), Proyectos (4L), Proveedores (4N), Proveedor detalle (4P), Proyecto fases (4b), análisis (4d), seguimiento (4f), fase (4h), Movimientos (v2). | Medio por pantalla. |

**Entre fase y fase se mira la app, no se encadena.** El motivo de empezar por
los tokens es justamente poder ver el 70% del cambio antes de haber tocado
ningún componente.

> **Nota sobre git:** `device_bash` no puede correr comandos git de escritura en
> este repo (deja `.git/index.lock` trabado). Los commits los hace Fede a mano.

---

## 20. Pendientes

Cosas que el sistema todavía no resuelve, anotadas para que no se descubran de
nuevo desde cero:

- **~~Renombrar los tokens de color.~~ Hecho en el prompt 20**, en un commit
  propio sin ningún cambio de valor (los canarios en cero, los tests verdes y
  capturas de cuatro pantallas idénticas píxel a píxel antes y después).
  Mapeo final:

  | Antes | Ahora |
  |---|---|
  | `--color-terracota*` | `--color-oliva*` |
  | `--color-musgo*` | `--color-exito*` (no se borró: es el verde de "terminado") |
  | `--color-arcilla*` | `--color-atencion*` |
  | `--color-oxido*` | `--color-error*` |
  | `--color-acero`, `--color-acero-texto` | `--color-tinta-muted` (mismo valor) |
  | `--color-acero-tint` | `--color-relleno` (mismo valor) |
  | `--color-base-1` | `--color-superficie-suave` (mismo valor) |
  | `--color-base-2` | `--color-relleno` |
  | `--color-gris-claro-marca` | `--color-linea-fuerte` |
  | `AZUL` · `VERDE` · `NARANJA` · `ROJO` (JS) | `NEUTRO` · `EXITO` · `ATENCION` · `ERROR` |
  | `VERDE_TINT` · `NARANJA_TINT` · `ROJO_TINT` · `BASE_2`… | `EXITO_TINT` · `ATENCION_TINT` · `ERROR_TINT` · `RELLENO`… |

- **~~`--text-btn` es un alias de `--text-sm`.~~ Se colapsó** (prompt 20): sus
  16 usos pasaron a `--text-sm`. Como marcador semántico de "texto de un
  control" no servía: la mayoría estaban en estados vacíos, toasts y textos de
  carga, no en botones.
- **~~`--font-display` y `--font-ui` son la misma familia.~~ Se colapsaron en
  `--font-ui`** (prompt 20). Ningún diseño usa una fuente de títulos distinta;
  la jerarquía la dan el peso y el tracking.
- **~~`PALETA_GRAFICOS` tiene un violeta y un cian.~~** Rehecha en el prompt 15
  con la rampa monocroma de §2.
- **~~Los diseños no cubren Catálogos, Comparador, Manager, Auth.~~** Se
  pasaron en la pasada final del rollout siguiendo a la pantalla rediseñada más
  parecida (§0: borde y peso, no fondo y sombra): Catálogos y Comparador a
  Proveedores y al catálogo de un proveedor (4N/4P), Manager a las listas, Auth
  y la pantalla de error al panel 4c, y el Seguimiento de la fase a la bandeja
  4f del proyecto. Siguen sin diseño propio: si alguna vez se diseñan, se parte
  de lo que hay.
- **Sin modo oscuro.** La app es sólo clara. Con el sidebar en blanco ya no queda
  ninguna superficie oscura fuera del login, así que si alguna vez se hace, se
  hace de cero y no reciclando los `--color-oscuro-*`.

---

## Apéndice — el material de diseño

Los prototipos `.dc.html` (`HS General`, `HSSidebar`, `HSProyectoHeader`, `HS Proyecto`, `Movimientos v2`, `HS Modales`) se retiraron del repo; siguen en el historial de git. Los códigos de variante (`4i`–`4p`, `5a`–`5f`) que citan el código y este documento se refieren a ellos.

**`Movimientos.dc.html` es material descartado.** Usa la paleta vieja fría
(`#18181b`, `#6b7280`, `#e4e4e7`, verde `#16a34a`), tamaños en `rem` y
micro-labels en mayúsculas. Es de la dirección anterior; el reemplazo es
`Movimientos v2.dc.html`. Si alguien lo abre buscando referencia, no es ésta.

### Variantes elegidas

| Pantalla | Variante | Por qué |
|---|---|---|
| Panel | **4i** | Números + gráfico + dos listas |
| Lista de proyectos | **4L** | Cards |
| Lista de proveedores | **4N** | Primero a quién se le debe |
| Proveedor detalle | **4P** | Ficha lateral + historial de compras |
| Proyecto · Fases | **4b** | Línea de tiempo |
| Proyecto · Análisis | **4d** | Resultado primero + cascada horizontal |
| Proyecto · Seguimiento | **4f** | Lista por urgencia con acción |
| Fase · Acciones | **4h** | Lista + panel de la fase |
| Nueva compra | **5ab** | Híbrido: shell de 5b + chips de 5a + pie de dos niveles (§14) |
| Gasto / cobro / fase / proyecto | **5c / 5d / 5e / 5f** | Los cuatro a 560px |
| Movimientos | **v2** | |

Las cuatro de Proyecto comparten criterio: **contar la historia y resolver en el
lugar**, en vez de mostrar la grilla y hacer navegar. El panel lateral de 4h y el
resultado-primero de 4d se apoyan mutuamente.

### Referencias históricas en el código

Varios comentarios del código citan un directorio `claudedesign/` con
"direcciones" numeradas (1a, 3a, 3b, 5c) que nunca estuvo en el repo. Lo que cada
una terminó siendo:

| Referencia | Qué es en la app |
|---|---|
| Dirección 1a — "Planilla" | La tabla en grid con una fila por proyecto. Hoy es `.planilla`. |
| Dirección 3a | El modal de detalle de movimiento: header oscuro, total grande y barra que descompone el total. **El header oscuro se retira en la v5** (§14). |
| Dirección 3b | El libro de obra. |
| Dirección 5c | El shell de modal con header fijo, cuerpo scrolleable y footer fijo (`ModalShell`). |

Ojo con la colisión de nombres: esa "dirección 5c" **no** es la variante `5c`
("Nuevo gasto") de `HS Modales`.
