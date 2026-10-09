// constants/estadoCompra.js
//
// Estado de pago y de envío de una compra. Misma forma que estados.js:
// { color, bg, fg, label, icono } -- `color` es el pleno (lo usan las piezas
// que pintan un solo color) y `bg`/`fg` el par plano del badge (DESIGN.md §2).
//
// v5: los colores salen de colores.js. Este archivo tenía los hex escritos a
// mano, y eran los de la paleta vieja (#16a34a, #64748b, #6b7280) -- por eso
// el estado de una compra seguía en el verde y el gris fríos de la v4 después
// de cambiar los tokens.
//
// El criterio es el semáforo de los accents: resuelto en oliva (pagado,
// entregado), requiere atención en ámbar (a pagar, sin entregar) y problema en
// rojo, que sólo aparece cuando un plazo de pago está vencido (oct 2026:
// antes era "impaga hace 90 días o más"; ahora cada compra tiene sus plazos).
import { Wallet, Truck } from "lucide-react";
import {
  OLIVA,
  OLIVA_TINT,
  OLIVA_OSCURO,
  ATENCION,
  ATENCION_TINT,
  ATENCION_TEXTO,
  ERROR,
  ERROR_TINT,
  ERROR_TEXTO,
  TINTA_MUTED,
  RELLENO,
} from "./colores";

const RESUELTO = { color: OLIVA, bg: OLIVA_TINT, fg: OLIVA_OSCURO };
const PAR_ATENCION = { color: ATENCION, bg: ATENCION_TINT, fg: ATENCION_TEXTO };
const PAR_PROBLEMA = { color: ERROR, bg: ERROR_TINT, fg: ERROR_TEXTO };
const PAR_NEUTRO = { color: TINTA_MUTED, bg: RELLENO, fg: TINTA_MUTED };

const ESTADO_PAGO = {
  pendiente: { ...PAR_ATENCION, label: "A pagar", icono: Wallet },
  pagado: { ...RESUELTO, label: "Pagado", icono: Wallet },
};

const ESTADO_ENVIO = {
  pedido: { ...PAR_ATENCION, label: "Sin entregar", icono: Truck },
  entregado: { ...RESUELTO, label: "Entregado", icono: Truck },
};

export function getEstadoPago(estado) {
  return ESTADO_PAGO[estado] ?? { ...PAR_NEUTRO, label: estado, icono: null };
}

export function getEstadoEnvio(estado) {
  return ESTADO_ENVIO[estado] ?? { ...PAR_NEUTRO, label: estado, icono: null };
}

/**
 * El estado de pago con su vencimiento: una compra (o gasto) con un plazo
 * vencido sin pagar pasa a rojo y dice hace cuántos días ("Vencida hace 12
 * días"); si no venció nada, es el "A pagar" de siempre. `diasVencida` sale
 * de utils/plazos.js (null si no hay nada vencido). Es lo que muestra una
 * fila; `getEstadoPago` es el estado pelado.
 */
export function getEstadoPagoConVencimiento(estado, diasVencida) {
  const base = getEstadoPago(estado);
  if (estado !== "pendiente" || !diasVencida) return base;
  return {
    ...base,
    ...PAR_PROBLEMA,
    label: `Vencida hace ${diasVencida} ${diasVencida === 1 ? "día" : "días"}`,
  };
}
