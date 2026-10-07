import { HandCoins, Receipt, ShoppingCart, FileMinus, FilePlus } from "lucide-react";

import { EXITO, ERROR, ATENCION, NEUTRO } from "./colores";

/**
 * Identidad visual de cada tipo de movimiento: qué color, qué ícono, cómo se
 * lo nombra y para qué lado mueve la caja.
 *
 * Única fuente de verdad. Antes esto estaba escrito en cinco lugares (el
 * mapa TIPOS de LibroDeObra, el TIPOS_MOVIMIENTO del Panel, y los imports
 * sueltos de color+ícono de cada uno de los seis modales de compra/cobro/
 * gasto), así que "de qué color es una compra" dependía de qué archivo
 * estabas mirando.
 *
 * `signo` es el efecto sobre el saldo: +1 entra plata, -1 sale. Las notas
 * siguen el criterio de la cuenta corriente -- la de crédito resta (te
 * devuelven) y la de débito suma (te refacturan).
 */
export const TIPOS_MOVIMIENTO = {
  compra: {
    singular: "Compra",
    plural: "Compras",
    color: NEUTRO,
    icono: ShoppingCart,
    signo: -1,
  },
  gasto: {
    singular: "Gasto",
    plural: "Gastos",
    color: ATENCION,
    icono: Receipt,
    signo: -1,
  },
  cobro: {
    singular: "Cobro",
    plural: "Cobros",
    color: EXITO,
    icono: HandCoins,
    signo: 1,
  },
  nota_credito: {
    singular: "Nota de crédito",
    plural: "Notas de crédito",
    color: ERROR,
    icono: FileMinus,
    signo: -1,
  },
  nota_debito: {
    singular: "Nota de débito",
    plural: "Notas de débito",
    color: ATENCION,
    icono: FilePlus,
    signo: 1,
  },
};

export function getTipoMovimiento(tipo) {
  return (
    TIPOS_MOVIMIENTO[tipo] ?? {
      singular: tipo,
      plural: tipo,
      color: ATENCION,
      icono: null,
      signo: -1,
    }
  );
}

/** "+" / "−" (menos tipográfico, no guion) para mostrar al lado de un importe. */
export function signoTexto(signo) {
  return signo > 0 ? "+" : "−";
}

/**
 * Opacidad del fondo de una pastilla de estado pintada con el color del tipo.
 * Se concatena al hex (`${color}${TINTE_PASTILLA}`). Estaba escrito a mano en
 * doce lugares con tres valores distintos (1c, 1f, 14), así que el mismo chip
 * salía con tres intensidades según la pantalla.
 */
export const TINTE_PASTILLA = "1c";
