// Eje X de fechas de los gráficos de Métricas (acumulado y avance de obra):
// los puntos son días (milisegundos locales) y las marcas, primeros de mes.

const MAX_MARCAS = 8;

/** Un tick por mes entre `min` y `max` (ms); salteando meses si son muchos. */
export function ticksMensuales(min, max) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [];
  const desde = new Date(min);
  const ticks = [];
  for (
    let fecha = new Date(desde.getFullYear(), desde.getMonth() + (desde.getDate() > 1 ? 1 : 0), 1);
    fecha.getTime() <= max;
    fecha = new Date(fecha.getFullYear(), fecha.getMonth() + 1, 1)
  ) {
    ticks.push(fecha.getTime());
  }
  const paso = Math.ceil(ticks.length / MAX_MARCAS) || 1;
  return ticks.filter((_, i) => i % paso === 0);
}

/** "oct", o "oct 25" si el eje cruza de año. */
export function etiquetaMes(ms, conAnio) {
  const fecha = new Date(ms);
  const mes = fecha.toLocaleDateString("es-AR", { month: "short" }).replace(".", "");
  return conAnio ? `${mes} ${String(fecha.getFullYear()).slice(2)}` : mes;
}

export const cruzaAnio = (min, max) => new Date(min).getFullYear() !== new Date(max).getFullYear();
