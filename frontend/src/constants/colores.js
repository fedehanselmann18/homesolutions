// Colores compartidos para gráficos (recharts) y estilos inline. Los valores
// están duplicados de los tokens de marca en index.css porque recharts y el
// atributo `style` necesitan el hex plano, no la CSS var -- si cambia la
// paleta de marca, actualizar ambos lugares.
//
// Nadie debería agregar un hex suelto en un .jsx: si hace falta un color
// nuevo, primero va como token en index.css y después acá con el mismo valor.
// Antes cada componente redeclaraba los suyos (`const ROJO = "#dc2626"` en
// cuatro archivos, un `#c2662d` en la ficha del proveedor que no existía en
// ninguna otra parte de la app), así que el mismo concepto salía de distinto
// color según la pantalla.
// Paleta v5 "dirección cálida" (ver docs/DESIGN.md §2). La paleta del manual
// tiene exactamente cinco colores -- oliva, oliva claro, gris claro, gris
// oscuro y negro -- y todo lo demás se deriva de ellos. Dos consecuencias acá:
//
//   - VERDE ya no es verde: #16a34a no está en el manual, así que todo lo
//     positivo (pagado, entregado, terminado, al día) va en oliva. El nombre
//     queda hasta el renombre de DESIGN.md §20.
//   - AZUL y GRIS eran #64748b, un gris frío que tampoco está en el manual.
//     Pasan al gris cálido del manual.
export const OLIVA = "#6f7f45"; // --color-terracota (acento de marca)
export const OLIVA_TINT = "#eef0e3"; // --color-terracota-tint
export const OLIVA_OSCURO = "#4f5b30"; // --color-terracota-dark (texto sobre el tint)
export const OLIVA_CLARO = "#a8b36a"; // --color-oliva-claro (tramo de impuestos de la barra de composición)
// VERDE sigue siendo verde, un poco más oscuro que antes (#16a34a daba 3.30:1
// sobre blanco y se usa como COLOR DE TEXTO en ProveedorCard, Dashboard y
// ProveedorDetalle, donde eso no alcanza; #15803d da 5.02:1). No se unificó al
// oliva porque VERDE no es sólo "terminado": es la semántica financiera de
// positivo / entrada / cobrado en media app, y eso sí quiere un verde.
export const VERDE = "#15803d"; // --color-musgo
export const ROJO = "#dc2626"; // --color-oxido
export const NARANJA = "#d97706"; // --color-arcilla
// OJO: AZUL ya no es azul. Era #64748b, un gris frío, y nunca se usó como "el
// azul del estado" sino como NEUTRO: el subtotal de la cascada del análisis, el
// relleno de una barra y un tipo de movimiento. Repuntarlo al azul del semáforo
// habría pintado todo eso de azul brillante. Queda como el gris cálido que ya
// era en la práctica; el nombre se corrige en el renombre de DESIGN.md §20.
export const AZUL = "#5a5a58"; // --color-acero (neutro, NO el azul de estado)
export const GRIS = "#5a5a58"; // --color-acero (mismo valor, alias semántico usado en listas neutras)

// ── Paleta FUNCIONAL de estados ───────────────────────────────────────────────
// No son colores de marca A PROPÓSITO (ver DESIGN.md §2): un estado tiene que
// leerse de un vistazo, y para eso hacen falta tonos bien separados entre sí, no
// cinco variantes del oliva. Si `en_curso` y `terminado` comparten el oliva, el
// semáforo deja de ser un semáforo.
//
// El set completo es: sin empezar (GRIS) · en curso (azul) · terminado (VERDE) ·
// auditada (violeta) · requiere atención (NARANJA) · problema (ROJO). Los seis
// pares fondo/texto dan >=4.5:1 sobre su propio tint y >=6:1 sobre blanco.
//
// IMPORTANTE: las seis luminancias caen entre 0.07 y 0.12, así que los estados
// NO se distinguen por claridad, sólo por tono -- para alguien con deuteranopia
// verde y rojo quedan casi iguales. El `icono` de cada estado en estados.js es
// lo que carga el significado: es estructural, no decorativo. No dejar nunca un
// badge de estado sin su ícono.
export const ESTADO_CURSO = "#1d4ed8"; // azul — en curso
export const ESTADO_VERIFICADO = "#6b21a8"; // violeta — auditada

// Pares fondo/texto del badge de estado (estados.js los arma). El texto es un
// token aparte del pleno aunque hoy en azul y violeta valgan lo mismo: el rol
// es "texto sobre mi propio tint", y en verde ya no coinciden.
export const ESTADO_CURSO_TINT = "#e7edfb"; // --color-info-tint
export const ESTADO_CURSO_TEXTO = "#1d4ed8"; // --color-info-texto
export const ESTADO_VERIFICADO_TINT = "#f3e8ff"; // --color-verificado-tint
export const ESTADO_VERIFICADO_TEXTO = "#6b21a8"; // --color-verificado-texto
export const VERDE_TINT = "#dcf3e3"; // --color-musgo-tint
export const VERDE_OSCURO = "#11672f"; // --color-musgo-dark (texto sobre el tint)
export const BASE_2 = "#f3f2ee"; // --color-base-2 (fondo del par neutro)
// Pares de los accents funcionales (DESIGN.md §2): atención y problema. Para
// los badges que arma el JS (estado de pago/envío de una compra); en CSS son
// --color-arcilla-tint/-texto y --color-oxido-tint/-texto.
export const NARANJA_TINT = "#fef3e2"; // --color-arcilla-tint
export const NARANJA_TEXTO = "#9a4a07"; // --color-arcilla-texto
export const ROJO_TINT = "#fdecea"; // --color-oxido-tint
export const ROJO_TEXTO = "#b42318"; // --color-oxido-texto
export const TINTA_MUTED = "#5a5a58"; // --color-tinta-muted
export const TINTA_TENUE = "#8c8b86"; // --color-tinta-tenue (meta-texto, íconos decorativos)
export const LINEA = "#e6e4df"; // --color-linea
export const GRIS_CLARO = "#d9d7d2"; // --color-gris-claro-marca (egresos en un gráfico, eje)
export const LINEA_SUAVE = "#efeee9"; // --color-linea-suave (separador entre filas)

// Paleta categórica para los gráficos de torta/treemap, donde hacen falta más
// series que colores tiene la marca (DESIGN.md §2).
//
// v5: una rampa monocroma del oliva más los grises cálidos, en vez de inventar
// colores. Antes tenía un violeta y un cian que no existían en ningún otro
// lugar del sistema, y un naranja y un rojo que en el resto de la app quieren
// decir "atención" y "error": una categoría de gasto pintada de rojo se leía
// como un problema. Las series de una torta no tienen orden semántico, así que
// no necesitan tonos distintos sino que dos vecinas se distingan: el orden
// alterna claro / oscuro y oliva / gris para eso.
export const OLIVA_MUY_CLARO = "#c9cfae"; // sólo gráficos: 5° paso de la rampa
export const OLIVA_PROFUNDO = "#3d4624"; // sólo gráficos: 7° paso de la rampa
export const PALETA_GRAFICOS = [
  OLIVA,
  OLIVA_CLARO,
  OLIVA_OSCURO,
  GRIS,
  OLIVA_MUY_CLARO,
  TINTA_TENUE,
  OLIVA_PROFUNDO,
  GRIS_CLARO,
];
