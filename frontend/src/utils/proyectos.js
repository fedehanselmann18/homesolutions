// Lo que se va a borrar junto con una obra, para el aviso del modal.
//
// Borrar una obra se lleva en cascada sus fases con sus compras, sus gastos y
// sus cobros: las tres cosas se listan, porque las tres se pierden.
//
// Los conteos salen de los datos que la pantalla YA tiene en caché (las mismas
// queries que alimentan calcularPanel), no de una estimación: si el modal dice
// 3 compras, se borran 3.

import { pluralizar } from "./formato";

/**
 * Cuántas compras, gastos y cobros se van con la obra.
 *
 * Las compras cuelgan de una FASE, no del proyecto: se cuentan por las fases
 * de esa obra, igual que en calcularPanel. Los gastos y los cobros cuelgan
 * del proyecto.
 */
export function contarParaBorrar({
  proyectoId,
  fases = [],
  gastos = [],
  compras = [],
  cobros = [],
}) {
  const fasesDeLaObra = new Set(
    fases.filter((fase) => fase.proyecto_id === proyectoId).map((fase) => fase.id)
  );
  return {
    compras: compras.filter((compra) => fasesDeLaObra.has(compra.fase_id)).length,
    gastos: gastos.filter((gasto) => gasto.proyecto_id === proyectoId).length,
    cobros: cobros.filter((cobro) => cobro.proyecto_id === proyectoId).length,
  };
}

// El sustantivo de cada cuenta, en singular: el plural lo arma pluralizar().
// Va acá al lado de la cuenta (y no en constants/) porque el texto ES la
// cuenta: "3 compras" no se puede armar sin saber que son 3. El orden es el
// orden en que se leen las líneas; los cobros al final, que es lo más caro
// de perder.
const NOMBRES = [
  ["compras", "compra"],
  ["gastos", "gasto"],
  ["cobros", "cobro"],
];

/**
 * Las líneas del aviso, en el orden en que se leen: "3 compras", "1 gasto"...
 *
 * Lo que está en cero no se lista (una obra sin gastos no muestra "0 gastos").
 * Una obra recién creada no deja ninguna línea.
 */
export function lineasDeBorrado(conteos) {
  return NOMBRES.filter(([clave]) => conteos[clave]).map(([clave, singular]) =>
    pluralizar(conteos[clave], singular)
  );
}
