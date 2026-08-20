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
export const OLIVA = "#6f7f45"; // --color-terracota (acento de marca)
export const OLIVA_TINT = "#eef0e9"; // --color-terracota-tint
export const OLIVA_CLARO = "#a8b36a"; // --color-oliva-claro (tramo de impuestos de la barra de composición)
export const VERDE = "#16a34a"; // --color-musgo
export const ROJO = "#dc2626"; // --color-oxido
export const NARANJA = "#d97706"; // --color-arcilla
export const AZUL = "#64748b"; // --color-acero
export const GRIS = "#64748b"; // --color-acero (mismo valor, alias semántico usado en listas neutras)
export const TINTA_MUTED = "#6b7280"; // --color-tinta-muted
export const LINEA = "#e4e4e7"; // --color-linea

// Paleta categórica para los gráficos de torta/treemap, donde hacen falta más
// series que colores tiene la marca. Arranca con los de marca y sigue con
// neutros que no compiten con el semáforo verde/naranja/rojo de los estados.
export const PALETA_GRAFICOS = [OLIVA, VERDE, NARANJA, AZUL, "#7c3aed", "#0891b2", ROJO, "#52525b"];
