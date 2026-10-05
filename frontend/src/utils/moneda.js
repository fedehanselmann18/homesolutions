// Doble moneda (ver docs/PLAN_TIPO_CAMBIO.md). Cada movimiento trae del
// backend sus DOS cifras ya congeladas (sufijos _ars/_usd), así que acá no
// se convierte nada al leer: solo se elige qué columna mirar según la moneda.
// Son la contraparte de _Montos en backend/app/reportes/calculos.py -- si
// cambia una, cambia la otra.
import { formatCotizacion, formatMoneda, formatMonedaDual } from "./formato";

export const MONEDAS = {
  usd: { key: "usd", label: "US$" },
  ars: { key: "ars", label: "Pesos" },
};

// USD por default en el análisis: es la vara de rentabilidad (decisión #5).
export const MONEDA_ANALISIS_DEFAULT = "usd";

export const TIPOS_CAMBIO = [
  { value: "blue", label: "Blue" },
  { value: "oficial", label: "Oficial" },
  { value: "otro", label: "Otro" },
];

export const getTipoCambioLabel = (tipo) =>
  TIPOS_CAMBIO.find((t) => t.value === tipo)?.label ?? tipo;

const num = (valor) => Number(valor) || 0;

export const montoGasto = (gasto, moneda) => num(gasto[`monto_${moneda}`]);

/** Cobrado NETO de notas (Cobro.monto_neto_* del backend). */
export const montoCobroNeto = (cobro, moneda) => num(cobro[`monto_neto_${moneda}`]);

export const precioNetoCompra = (compra, moneda) => num(compra[`precio_neto_${moneda}`]);

/** Neto + impuestos +- notas, cada nota con su propio dólar (lo arma el backend). */
export const precioTotalCompra = (compra, moneda) => num(compra[`precio_total_${moneda}`]);

export const montoNota = (nota, moneda) => num(nota[`monto_${moneda}`]);

/**
 * Los impuestos de una compra se guardan solo en pesos: en USD heredan la
 * cotización congelada de SU compra (CompraImpuesto.monto_usd en el backend).
 * Lo mismo vale para el detalle de productos (cantidad x precio_unitario).
 */
export const enMonedaDeCompra = (montoArs, compra, moneda) =>
  moneda === "ars" ? num(montoArs) : num(montoArs) / num(compra.cotizacion_dolar);

/**
 * El precio acordado es USD; en pesos NO tiene cifra congelada: se muestra
 * con la última cotización cargada ("cuánto vale hoy el contrato", decisión
 * #8). Sin cotización cargada devuelve null -- quien lo muestre decide cómo
 * decir "sin dato" en vez de inventar un número.
 */
export function precioAcordado(proyecto, moneda, cotizacionActual) {
  const usd = num(proyecto?.precio_acordado_usd);
  if (moneda === "usd") return usd;
  return cotizacionActual ? usd * num(cotizacionActual.valor) : null;
}

/**
 * "≈ US$ 41.379 · dólar blue $ 1.450,00": la otra cifra congelada de un
 * movimiento y la cotización con que se cargó, para mostrar debajo de su
 * total en las fichas de detalle.
 */
export function leyendaOtraMoneda(montoOtraMoneda, otraMoneda, movimiento) {
  const partes = [formatMoneda(montoOtraMoneda, otraMoneda)];
  if (movimiento?.cotizacion_dolar) {
    partes.push(
      `dólar ${getTipoCambioLabel(movimiento.tipo_cambio).toLowerCase()} ${formatCotizacion(
        movimiento.cotizacion_dolar
      )}`
    );
  }
  return partes.join(" · ");
}

/**
 * Un item ya normalizado con { monto, montoOtra, moneda } (ver
 * utils/seguimiento.js): su moneda primero y la otra entre paréntesis.
 */
export function formatMontoDeItem({ monto, montoOtra, moneda }) {
  return moneda === "usd"
    ? formatMonedaDual(montoOtra, monto)
    : formatMonedaDual(monto, montoOtra, { principal: "ars" });
}
