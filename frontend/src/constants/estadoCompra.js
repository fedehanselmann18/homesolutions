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
// rojo, que sólo aparece cuando la deuda tiene DIAS_DEUDA_VENCIDA o más.
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

// Desde cuántos días una compra impaga pasa de "a pagar" a deuda vencida.
// Es el mismo corte que usa la lista de proveedores (variante 4N).
export const DIAS_DEUDA_VENCIDA = 90;

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

const CONDICION_PAGO = {
  contado: "Contado",
  cuenta_corriente: "Cuenta corriente",
  cheque: "Cheque",
  transferencia: "Transferencia",
};

export function getEstadoPago(estado) {
  return ESTADO_PAGO[estado] ?? { ...PAR_NEUTRO, label: estado, icono: null };
}

export function getEstadoEnvio(estado) {
  return ESTADO_ENVIO[estado] ?? { ...PAR_NEUTRO, label: estado, icono: null };
}

/**
 * El estado de pago con su antigüedad: una compra impaga dice hace cuántos
 * días lo está ("118 días sin pagar") y pasa a rojo desde DIAS_DEUDA_VENCIDA.
 * Es lo que muestra una fila; `getEstadoPago` es el estado pelado.
 */
export function getEstadoPagoConAntiguedad(estado, dias) {
  const base = getEstadoPago(estado);
  if (estado !== "pendiente" || dias == null) return base;
  if (dias >= DIAS_DEUDA_VENCIDA)
    return { ...base, ...PAR_PROBLEMA, label: `${dias} días sin pagar` };
  return base;
}

export function getCondicionPagoLabel(condicion) {
  return CONDICION_PAGO[condicion] ?? condicion;
}
