import {
  ArrowRightLeft,
  Building2,
  CircleDollarSign,
  FileSignature,
  ListChecks,
  ScrollText,
} from "lucide-react";

/**
 * El contenido de la página Guía (pages/Guia.jsx). Es un dato y no JSX para
 * poder corregir un texto sin tocar componentes.
 *
 * Cada sección: { id, titulo, icono, resumen, bloques }. Los bloques son de
 * cuatro tipos y nada más:
 *   - parrafo: { texto }
 *   - pasos:   { items }   lista numerada
 *   - lista:   { items }   lista con viñetas
 *   - aviso:   { texto }   el error común, que conviene leer antes de cometerlo
 *
 * Lo leen Agus y Aldana, no un dev: castellano rioplatense, de vos, y cada cosa
 * por lo que resuelve. Los nombres de pantallas y botones son los que se ven en
 * la app hoy; si se renombra uno, se corrige acá.
 */
export const SECCIONES_GUIA = [
  {
    id: "primeros-pasos",
    titulo: "Primeros pasos",
    icono: ListChecks,
    resumen: "En qué orden cargar las cosas la primera vez.",
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "La app te va pidiendo datos que ya cargaste antes: una compra necesita un proveedor y una fase, y una fase necesita un proyecto. Por eso conviene cargar de a una cosa y en este orden.",
      },
      {
        tipo: "pasos",
        items: [
          "Proveedores: en Proveedores tocá «Nuevo proveedor».",
          "Productos de cada proveedor: abrí el proveedor, andá a la pestaña «Catálogo» y cargá los productos con «Producto», o traelos de una lista con «Importar».",
          "El dólar del día: en Catálogos, pestaña «Cotizaciones», tocá «Nueva cotización». Si lo cargás ahora, después la app lo sugiere sola en cada compra, gasto y cobro.",
          "El proyecto: en Proyectos tocá «Nuevo proyecto» y poné el precio acordado en dólares.",
          "Las fases: adentro del proyecto, en «Fases del proyecto», tocá «Nueva fase» por cada etapa de la obra.",
          "Los movimientos: en la pestaña «Acciones» del proyecto cargá «Nueva compra», «Gasto» y «Cobro» a medida que pasan.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Una compra siempre se carga dentro de una fase: si el proyecto todavía no tiene fases, no vas a poder elegir ninguna. Creá las fases antes de cargar compras.",
      },
    ],
  },
  {
    id: "proyectos",
    titulo: "Proyectos y fases",
    icono: Building2,
    resumen: "Una obra y las etapas en las que se divide.",
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "Un proyecto es una obra: tiene su precio acordado con el cliente y un estado (A iniciar, En curso o Terminado). Se divide en fases, que son las etapas, por ejemplo «Relevamiento», «Montaje» o «Entrega y garantía».",
      },
      {
        tipo: "parrafo",
        texto:
          "Cada fase tiene su propio estado: Por empezar, En curso, Terminada o Auditada. Se cambia desde «Editar fase». Una fase Auditada cuenta como cerrada, igual que una Terminada.",
      },
      {
        tipo: "lista",
        items: [
          "El orden: las fases se numeran 1, 2, 3… en el orden de la obra. Una fase nueva entra siempre al final.",
          "Para reordenar: en «Fases del proyecto», pasá el mouse por la fase y usá las flechas de subir y bajar. La fase intercambia lugar con la de al lado. En el celular las flechas se ven siempre.",
          "Si borrás una fase del medio, las demás se renumeran solas y no queda ningún hueco.",
          "El «Fase 3 de 4 · Montaje» que ves en un proyecto es la primera fase que está En curso, según este orden.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Una fase terminada no se tacha: se ve un poco más clara que las demás, con un tilde en lugar del número y su etiqueta de estado. Sigue siendo una fase normal y podés abrirla y consultarla.",
      },
      {
        tipo: "parrafo",
        texto:
          "El «En curso hace 12 días» cuenta desde el momento en que pasaste la fase a En curso. Editar el nombre o la descripción no reinicia el contador; en cambio, si la sacás de En curso y la volvés a poner, arranca de cero. Cuando una fase lleva 30 días o más en curso, el Panel la marca como estancada para que no se te pase.",
      },
      {
        tipo: "aviso",
        texto:
          "Al eliminar una fase se eliminan también las compras que cargaste en ella, con sus comprobantes. Los gastos no se pierden: quedan en el proyecto como «Gasto general». Si la fase ya terminó, casi siempre conviene dejarla como Terminada y no borrarla.",
      },
    ],
  },
  {
    id: "moneda",
    titulo: "Dólares y pesos",
    icono: CircleDollarSign,
    resumen: "Qué se carga en cada moneda y para qué sirve el dólar del día.",
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "El precio de la obra y los cobros van en dólares, porque así se acuerdan con el cliente. Las compras y los gastos van en pesos, porque así los pagás. La app guarda siempre las dos cifras, y por eso necesita saber a cuánto estaba el dólar ese día.",
      },
      {
        tipo: "lista",
        items: [
          "Precio acordado y cobros: los cargás en dólares y la app calcula los pesos.",
          "Compras, gastos y sus notas de crédito o débito: los cargás en pesos y la app calcula los dólares.",
          "Cada movimiento queda con el dólar del día en que lo cargaste. Si el dólar sube después, lo que ya cargaste no cambia.",
          "Una nota de crédito o débito tiene su propia fecha y su propio dólar, que pueden ser distintos a los de la compra o el cobro.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "El dólar del día se carga en Catálogos, pestaña «Cotizaciones», con «Nueva cotización»: fecha, tipo de dólar (Blue, Oficial u Otro) y cuántos pesos vale. Al cargar una compra, un gasto o un cobro, la app sugiere el del día del movimiento o, si ese día no hay, el último cargado antes. Podés cambiarlo desde el «cambiar» que aparece debajo del monto.",
      },
      {
        tipo: "parrafo",
        texto:
          "Si no hay ninguna cotización cargada, el formulario te avisa «No hay cotización de este tipo cargada a esa fecha: tipeala a mano» y te pide que escribas el dólar vos. Sin dólar no se puede guardar el movimiento. Y en el análisis en pesos, el precio acordado aparece como «Sin cotización», porque no hay con qué pasarlo a pesos.",
      },
      {
        tipo: "parrafo",
        texto:
          "En la lista de Acciones, cada importe se ve en la moneda en que se cargó y, debajo, su equivalente en la otra. La columna «Saldo restante» muestra los pesos que van quedando en la caja y, debajo, el mismo saldo en dólares.",
      },
      {
        tipo: "aviso",
        texto:
          "El saldo en pesos y el saldo en dólares pueden dar distinto, incluso con signo contrario. No es un error: cada movimiento se pasó a dólares con el dólar de su día. Los pesos cuentan la plata que realmente entró y salió; los dólares son la vara para saber si la obra deja ganancia.",
      },
      {
        tipo: "parrafo",
        texto:
          "Corregir o borrar una cotización en Catálogos no cambia nada de lo que ya está cargado. Sólo afecta a lo que cargues de ahí en adelante.",
      },
    ],
  },
  {
    id: "gastos-compras-cobros",
    titulo: "Compras, gastos y cobros",
    icono: ArrowRightLeft,
    resumen: "Las tres formas en que se mueve la plata de una obra.",
    bloques: [
      {
        tipo: "lista",
        items: [
          "Compra: lo que le comprás a un proveedor de tu lista, con productos de su catálogo. Va siempre a una fase. Se carga en pesos.",
          "Gasto: todo lo que pagás y no es una compra a un proveedor, como un flete, un viático o una changa. Puede ir a una fase o quedar como «Gasto general» del proyecto. Se carga en pesos.",
          "Cobro: lo que te paga el cliente. Va al proyecto, no a una fase. Se carga en dólares.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Se cargan desde la pestaña «Acciones» del proyecto con «Nueva compra», «Gasto» y «Cobro». Las compras y los gastos también se pueden cargar desde adentro de una fase, y ahí la fase ya viene elegida.",
      },
      {
        tipo: "pasos",
        items: [
          "Subí primero el comprobante (la factura, el remito o una foto) y tocá «Autocompletar con IA»: la app lo lee y completa lo que puede.",
          "Revisá lo que completó. Los campos que llenó la IA quedan marcados, y si alguno no lo pudo leer, queda vacío para que lo completes vos.",
          "Completá el resto y guardá.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "En una compra elegís el proveedor y la fase, y después agregás los productos de su catálogo con la cantidad. El precio de cada producto sale del catálogo y queda fijo en esa compra: si el proveedor cambia su lista después, la compra no se modifica. El total no se escribe: se calcula solo con los productos y los impuestos.",
      },
      {
        tipo: "lista",
        items: [
          "Pago: «A pagar» o «Pagado». Una compra que lleva 90 días o más sin pagar se pone en rojo.",
          "Envío: «Sin entregar» o «Entregado».",
          "Las dos cosas se cambian con un toque sobre la etiqueta de la compra en la lista, sin abrirla.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "A un gasto le podés poner una categoría (por ejemplo, fletes o viáticos) para después ver en qué se va la plata. Las categorías se arman en Catálogos, pestaña «Categorías de gasto».",
      },
      {
        tipo: "aviso",
        texto:
          "Un movimiento sin comprobante se puede guardar, pero queda con un triángulo de alerta en la lista hasta que le adjuntes el archivo. Lo adjuntás desde la ficha del movimiento, sin volver a cargarlo.",
      },
    ],
  },
  {
    id: "notas",
    titulo: "Notas de crédito y débito",
    icono: FileSignature,
    resumen: "Cómo corregir una compra o un cobro ya cargado sin tocarlo.",
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "Una nota corrige la plata de una compra o de un cobro que ya cargaste. La de crédito resta y la de débito suma. Sirven para lo que pasa después: una devolución, un descuento que te hicieron o un ajuste de precio con el cliente.",
      },
      {
        tipo: "lista",
        items: [
          "En una compra: crédito si el proveedor te devuelve plata o te descuenta; débito si te factura algo de más.",
          "En un cobro: crédito si le reconocés al cliente una rebaja; débito si le cobrás un ajuste.",
          "Las notas de una compra se cargan en pesos; las de un cobro, en dólares. Cada nota tiene su fecha y su dólar.",
        ],
      },
      {
        tipo: "pasos",
        items: [
          "En la lista de Acciones, pasá el mouse por la compra o el cobro y tocá el ícono de la nota. También lo podés hacer desde su ficha, con «+ Agregar nota de crédito».",
          "Arriba elegí «Crédito» o «Débito».",
          "Completá la fecha, el comprobante, el origen y una descripción corta de qué pasó.",
          "Poné el monto y guardá.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Si es una devolución de productos, elegí el origen «Devolución de producto» y marcá cuáles y cuántos: el monto se calcula solo con el precio que tenían en la compra. Si te mandan productos nuevos en reemplazo, va una nota de débito con origen «Reposición de producto».",
      },
      {
        tipo: "parrafo",
        texto:
          "La compra o el cobro con notas muestra una etiqueta chica, por ejemplo «1 nota de crédito», y su importe ya incluye las notas. Para ver solo esos movimientos, usá el filtro «Con nota de crédito/débito» de la lista.",
      },
      {
        tipo: "aviso",
        texto:
          "No edites la compra para bajarle el precio cuando te devuelven algo: cargá una nota de crédito. Así queda registrado qué pasó y cuándo, y la compra sigue mostrando lo que se compró de verdad.",
      },
    ],
  },
  {
    id: "libro-obra",
    titulo: "La lista de Acciones",
    icono: ScrollText,
    resumen: "Todos los movimientos de la obra, día por día, con el saldo.",
    bloques: [
      {
        tipo: "parrafo",
        texto:
          "La pestaña «Acciones» de cada proyecto es el libro de la obra: todas las compras, gastos y cobros en una sola lista, agrupados por día y del más nuevo al más viejo. Arriba está el saldo de la obra y cuánto se cobró y se gastó contra el contrato.",
      },
      {
        tipo: "lista",
        items: [
          "Importe: en la moneda en que se cargó, con su equivalente en la otra debajo.",
          "Saldo restante: cómo quedó la caja después de ese movimiento, en pesos y debajo en dólares.",
          "Estado: en una compra, si está paga y si llegó. Un gasto o un cobro no tiene nada pendiente.",
          "El clip abre el comprobante; el triángulo avisa que falta.",
        ],
      },
      {
        tipo: "parrafo",
        texto:
          "Tocá cualquier fila para abrir la ficha del movimiento: ahí ves todo el detalle, sumás comprobantes o notas, y editás o eliminás. Con el mouse encima de la fila aparecen además los atajos para agregar una nota, editar y eliminar.",
      },
      {
        tipo: "lista",
        items: [
          "Todo, Compras, Gastos y Cobros: muestran solo ese tipo de movimiento.",
          "Con alertas: lo que falta resolver, es decir, compras sin pagar o sin entregar y movimientos sin comprobante.",
          "Con nota de crédito/débito: las compras y los cobros que tienen alguna nota.",
          "«Filtrar», a la derecha, suma filtros por tipo de factura, comprobante y, según lo que estés viendo, pago, envío o notas.",
        ],
      },
      {
        tipo: "aviso",
        texto:
          "Con un filtro puesto, el saldo de cada fila se calcula solo con lo que estás viendo. El saldo real de la obra es el de arriba de todo, que no cambia con los filtros.",
      },
    ],
  },
];
