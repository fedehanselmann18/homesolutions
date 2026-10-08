# Plan y prompts — página "Guía" (Cómo usar la app)

Página interna de ayuda para que **Agus y Aldana** arranquen solos con la app.
Solo la ven los usuarios con rol `admin`; los de rol `lectura`, no.

Cada PROMPT de abajo es **autónomo** para una sesión de Claude Code que arranca
en frío. Se ejecutan **en orden**, uno por sesión y uno por commit.

**Cómo usarlo:** abrí una sesión y decile

> `Leé docs/PLAN_GUIA.md y ejecutá el PROMPT 1. Nada más que eso.`

---

## Las decisiones ya tomadas

No las vuelvas a discutir en la sesión: están cerradas.

1. **Ruta `/guia`**, link en el sidebar con ícono `BookOpen` de lucide-react,
   último del grupo `ITEMS_NAV` (después de "Comparador"), sin contador.
2. **Visible solo para `admin`.** Dos capas, las dos obligatorias:
   - el link no se renderiza si `!isAdmin` (`useAuth()` ya expone `isAdmin`);
   - `ProtectedRoute` saca de `/guia` a cualquiera que no sea admin aunque
     escriba la URL a mano → `Navigate to="/no-autorizado" replace`. Es el caso
     que `/no-autorizado` venía esperando: acá sí se distingue "estás forzando
     la URL" de "no hay sesión".
   La cuenta "Manager" tiene rol `lectura` y además ya está encerrada en su
   subárbol, así que no necesita un caso aparte.
3. **El contenido es un dato, no JSX.** Vive en `frontend/src/constants/guia.js`
   como un array de secciones. Se edita ahí sin tocar componentes. **No** va a
   la base de datos, **no** se agrega una dependencia de markdown.
4. **Sin componente nuevo de acordeón.** DESIGN.md no define uno y no es el
   momento de inventarlo. La página es: nav de secciones a la izquierda +
   panel de contenido a la derecha, con los tokens de superficie que ya existen
   (§10 Superficies y cards). En mobile el nav pasa arriba.
5. **El PDF viejo es material, no fuente.** `docs/Manual_uso_HS.pdf` (v1_06/26)
   es de agosto: es anterior al cambio de moneda (USD/pesos) y al rediseño v5.
   Sirve para acordarse de qué temas cubrir; **los textos se reescriben**.
6. **"Cotización" está tomada.** En este código `cotización` es el **dólar del
   día** (`useCotizaciones`, `ModalCotizacion`, `SeccionCotizaciones`,
   `cotizacionService`). La guía tiene que usar esa palabra con ese significado
   y nada más. El futuro cotizador de obras se va a llamar **Presupuestos**.
7. **La checklist se calcula con datos reales**, no es un texto con tildes
   dibujados. Usa las queries que ya existen en `hooks/queries.js` — y que el
   Sidebar ya monta, así que vienen del caché de React Query.

---

## Preámbulo — vale para TODOS los prompts

**Antes de empezar**

- Leé `docs/DESIGN.md`: la **Regla principal**, §2 Color, §3 Tipografía,
  §4 Espaciado, §10 Superficies y cards, §13 Navegación, §16 Estados,
  §17 Iconos y §18 Convenciones de CSS. DESIGN.md es la autoridad: si este
  archivo y DESIGN.md se contradicen, **gana DESIGN.md**.
- Leé `docs/PLAN_UIUX_ROLLOUT.md`, tabla **Hallazgos**.
- Mirá `frontend/src/pages/Comparador.jsx` como referencia de cómo se arma una
  página: `usePageTitle`, `PageHeader`, `Cargando`, `EstadoVacio`,
  `EstadoError`, CSS propio al lado del `.jsx`.

**Mientras trabajás**

- **Ningún valor literal donde hay un token.** Si el valor que necesitás no
  existe, anotalo en Hallazgos y usá el token más cercano.
- **No toques lo que el prompt no nombra.** Lo demás va a Hallazgos.
- **Reusá los componentes de `components/shared/`.** Antes de escribir algo
  nuevo, mirá qué hay ahí: `PageHeader`, `Buscador`, `Tabs`, `EstadoVacio`,
  `TarjetaAlerta`, `BadgeEstado`, `Cargando`, `EstadoError`.
- **Si un test busca una clase o un texto que cambiás, actualizalo en el MISMO
  commit.**
- **La guía la leen Agus y Aldana, no un dev.** Nada de "endpoint", "payload",
  "query". Se escribe en castellano rioplatense, de vos, corto. Cada cosa se
  explica por lo que resuelve, no por cómo está hecha.

**Terminado cuando**

- `npm run lint` y `npm test` pasan en `frontend/`.
- Un commit solo, con mensaje en castellano.

---

## PROMPT 1 — El esqueleto de la página

Armá la página `/guia` funcionando, con la estructura y **tres** secciones de
contenido escritas. El resto del contenido es el PROMPT 2.

**Archivos**

- `frontend/src/constants/guia.js` — nuevo. El contenido.
- `frontend/src/pages/Guia.jsx` + `frontend/src/pages/Guia.css` — nuevos.
- `frontend/src/pages/Guia.test.jsx` — nuevo.
- `frontend/src/router/AppRouter.jsx` — la ruta, con `lazy` como las demás.
- `frontend/src/router/ProtectedRoute.jsx` — la guardia por rol.
- `frontend/src/components/Sidebar.jsx` — el link.

**La forma del contenido** en `constants/guia.js`:

```js
export const SECCIONES_GUIA = [
  {
    id: "proyectos",
    titulo: "Proyectos y fases",
    icono: Building2,              // lucide-react, el mismo que usa el sidebar
    resumen: "Una obra y las etapas en las que se divide.",
    bloques: [
      { tipo: "parrafo", texto: "..." },
      { tipo: "pasos", items: ["...", "..."] },      // lista numerada
      { tipo: "lista", items: ["...", "..."] },      // lista con viñetas
      { tipo: "aviso", texto: "..." },               // el error común
    ],
  },
];
```

Cuatro tipos de bloque y nada más: `parrafo`, `pasos`, `lista`, `aviso`.
`aviso` se renderiza con `TarjetaAlerta` si encaja; si no encaja, con los
tokens del accent de atención (DESIGN.md §2 "Accents funcionales"), **no** con
el semáforo de estado.

**Las tres secciones de este prompt** — escribilas leyendo el código de cada
pantalla, no de memoria:

1. **`primeros-pasos`** — el orden en que hay que cargar las cosas la primera
   vez: proveedores → catálogo de productos → el proyecto → las fases → gastos,
   compras y cobros. Por ahora texto fijo; en el PROMPT 3 se vuelve una
   checklist con datos reales.
2. **`proyectos`** — proyecto, fases, el campo `orden`, cómo se reordena, qué
   significa que una fase quede tachada, de dónde sale "en curso hace X días".
3. **`moneda`** — la que más los va a confundir: precio acordado y cobros en
   USD, compras y gastos en pesos convertidos al dólar del día, dónde se carga
   la cotización del día y qué pasa si no está cargada. Leé
   `docs/PLAN_TIPO_CAMBIO.md` antes de escribir esta sección.

**La página**

- `usePageTitle("Guía")` + `PageHeader`.
- Nav de secciones (el `titulo` + el `icono` de cada una) que scrollea o
  cambia el panel de contenido — elegí una y dejá el por qué en un comentario.
- Sin estado que haya que persistir: la sección activa es estado local.

**Los tests** (`Guia.test.jsx`)

- Renderiza los títulos de las tres secciones.
- Un usuario con rol `lectura` no ve el link en el Sidebar.
- Un usuario con rol `lectura` que entra a `/guia` termina en `/no-autorizado`.

---

## PROMPT 2 — El contenido completo

Con el esqueleto andando, escribí las secciones que faltan en
`constants/guia.js`. **No toques** `Guia.jsx` ni el CSS salvo que una sección
necesite un tipo de bloque que no existe — y si lo necesita, pensá dos veces
antes de agregarlo.

Secciones a cubrir, en este orden:

- **`proveedores`** — cargar un proveedor, el CUIT/CUIL (qué pasa si está mal:
  el mensaje es el motivo real, no uno genérico), el catálogo por proveedor.
- **`catalogo`** — productos, categorías, tipos de producto. **"Importar
  catálogo"**: para qué sirve, qué archivo acepta, qué hace la IA, qué hay que
  revisar siempre antes de confirmar.
- **`gastos-compras-cobros`** — la diferencia entre los tres, cuál va a la fase
  y cuál al proyecto, el comprobante, las categorías de gasto.
- **`libro-obra`** — qué se anota y para qué sirve después.
- **`comparador`** — las dos vistas y cuándo sirve cada una.
- **`panel`** — qué significa cada número del Panel y el punto verde/rojo del
  sidebar (el "disponible" por obra).
- **`preguntas`** — FAQ de 8 a 12 entradas, en forma de "¿Cómo hago para...?".
  Cada una: una o dos líneas y adónde ir. Sale de las dudas reales que tiene
  alguien que recién entra, no de la estructura del código.
- **`glosario`** — fase, libro de obra, precio acordado, cotización (el dólar
  del día), disponible, imprevisto. Una línea cada uno.

**Material de referencia:** `docs/Manual_uso_HS.pdf` para no olvidarte un tema
(está viejo: no copies sus textos), y el código de cada pantalla para que lo
que digas sea cierto hoy.

**Terminado cuando** además: ninguna sección menciona una pantalla, un botón o
un campo que no exista en `main`. Eso se verifica leyendo el código, una
sección a la vez.

---

## PROMPT 3 — La checklist viva y el buscador

Dos cosas que hacen que la guía no sea un texto que leen una vez.

**1. "Primeros pasos" con datos reales.** La sección `primeros-pasos` deja de
ser texto fijo y pasa a ser una checklist que se marca sola:

| Paso | Hecho cuando | Lleva a |
|---|---|---|
| Cargar proveedores | hay ≥ 1 proveedor | `/proveedores` |
| Cargar el catálogo | hay ≥ 1 producto | `/catalogos` |
| Cargar la cotización del día | hay ≥ 1 cotización | `/catalogos` |
| Crear la primera obra | hay ≥ 1 proyecto | `/proyectos` |
| Dividirla en fases | hay ≥ 1 fase | el proyecto |
| Registrar el primer movimiento | hay ≥ 1 gasto, compra o cobro | el proyecto |

- Los datos salen de `useProveedores`, `useProductos`, `useCotizaciones`,
  `useProyectos`, `useFases`, `useGastos`, `useCompras`, `useCobros` —
  **todas ya existen** en `hooks/queries.js` y el Sidebar ya monta la mayoría,
  así que vienen del caché.
- Un paso pendiente muestra un link a la pantalla donde se resuelve.
- Mientras las queries cargan: `Cargando`. Si fallan: la checklist se oculta y
  queda el texto de la sección — un error acá no puede romper la página de
  ayuda. Si **todos** los pasos están hechos, la checklist se reemplaza por una
  línea de "ya está todo cargado" y no ocupa la pantalla.
- El criterio de "hecho" va en una función pura en `frontend/src/utils/guia.js`
  con su propio test, igual que `utils/panel.js`.

**2. Buscador.** `Buscador` de `components/shared/` arriba del nav: filtra las
secciones y las entradas del FAQ por texto, sin resaltado ni ranking. Si no hay
resultados, `EstadoVacio`.

**Los tests**

- `utils/guia.js`: cada paso, con datos y sin datos.
- La checklist marca los pasos según los datos mockeados.
- Con las queries en error, la página sigue renderizando las secciones.
- El buscador filtra.

---

## Hallazgos

Lo que aprenda cada prompt va acá, para el siguiente.

| # | Prompt | Hallazgo |
|---|---|---|
| 1 | 1 | **Ninguna fase se tacha.** Una fase terminada se atenúa (`opacity: .75`, DESIGN.md §16) y lleva un tilde en vez del número. El tachado era de una versión vieja (ver el comentario de arriba de `Fases.css`). La sección `proyectos` explica cómo se ve hoy. |
| 2 | 1 | **El catálogo de productos no está en `/catalogos`.** Catálogos tiene impuestos, categorías y cotizaciones; los productos se cargan en la ficha de cada proveedor (pestaña «Catálogo», botones «Producto» e «Importar»). En la tabla del PROMPT 3, el paso «Cargar el catálogo» tiene que llevar a `/proveedores`, no a `/catalogos`. |
| 3 | 1 | **El `aviso` no usa los colores de atención.** El plan los pedía, pero DESIGN.md §2 deja el ámbar sólo para badges y errores de campo, «nunca como fondo de un bloque», y DESIGN.md gana. Quedó como panel suave (§10) con `TriangleAlert` en muted. `TarjetaAlerta` no encaja: es una fila con monto y color inline. |
| 4 | 1 | **Borrar una fase borra sus compras** (cascade en el modelo, con sus comprobantes); los gastos quedan como «Gasto general». El modal de confirmación sólo dice «no se puede deshacer». La guía lo avisa; el modal no se tocó. |
| 5 | 1 | Agregué un paso «El dólar del día» en `primeros-pasos` entre productos y proyecto, como en la tabla del PROMPT 3. |
| 6 | 1 | El link es un item de `ITEMS_NAV` con `soloAdmin: true`; la guardia es `RUTAS_SOLO_ADMIN` en `ProtectedRoute`. Una próxima página sólo para admin se suma ahí. |
| 7 | 1 (pedido aparte) | **Se adelantaron tres secciones del PROMPT 2**, a pedido: `gastos-compras-cobros`, `libro-obra` (titulada «La lista de Acciones», que es como se llama la pestaña) y una nueva, `notas` (notas de crédito y débito), que la lista del PROMPT 2 no tenía. El PROMPT 2 las encuentra escritas: revisarlas, no reescribirlas. Van después de `moneda`; `proveedores` y `catalogo` se insertan antes. |
| 8 | 1 (pedido aparte) | **El botón de la ficha dice «+ Agregar nota de crédito» aunque abre el modal donde también se elige débito** (`SeccionNotas.jsx`). La guía lo explica; el botón no se tocó. |

---

## Después de esto

El **cotizador de obras** (que se llama **Presupuestos**, ver decisión 6) es el
otro pedido y es mucho más grande: tiene backend, modelo de datos, factores
históricos y una capa de IA. Va en su propio plan — `docs/PLAN_PRESUPUESTOS.md`
— y no se arranca hasta que la guía esté mergeada.
