// Plazos de pago de compras y gastos (ver backend app/plazos.py, que es la
// fuente de verdad: acá sólo se lee lo que guardó y se previsualiza).
//
// Fechas como "YYYY-MM-DD" (sin hora): se suman días y se comparan como
// texto, sin pasar por UTC (ver la trampa de toISOString en CLAUDE.md).

import { hoyISO } from "./formato";
import { precioTotalCompra } from "./moneda";

const MS_POR_DIA = 24 * 60 * 60 * 1000;

const aUTC = (iso) => {
  const [a, m, d] = iso.split("-").map(Number);
  return Date.UTC(a, m - 1, d);
};

const deUTC = (ms) => {
  const f = new Date(ms);
  return `${f.getUTCFullYear()}-${String(f.getUTCMonth() + 1).padStart(2, "0")}-${String(
    f.getUTCDate()
  ).padStart(2, "0")}`;
};

/** "2026-03-01" + 30 -> "2026-03-31". */
export function sumarDias(iso, dias) {
  return deUTC(aUTC(iso) + dias * MS_POR_DIA);
}

/** Días de `desde` a `hasta` (negativo si `hasta` es antes). */
export function diasEntre(desde, hasta) {
  return Math.round((aUTC(hasta) - aUTC(desde)) / MS_POR_DIA);
}

/** Partes iguales a centavos; el último absorbe el redondeo (como el backend). */
export function dividir(total, partes) {
  const centavos = Math.round((Number(total) || 0) * 100);
  const base = Math.floor(centavos / partes);
  return Array.from({ length: partes }, (_, i) =>
    i === partes - 1 ? (centavos - base * (partes - 1)) / 100 : base / 100
  );
}

/**
 * Cómo van a quedar los plazos de una condición, para mostrar antes de
 * guardar ("2 pagos: 31/03 y 30/04, $ 500.000 c/u"). Contado = uno el día de
 * la factura.
 */
export function previsualizarPlazos(dias = [], fecha, total) {
  const lista = dias.length ? dias : [0];
  const montos = dividir(total, lista.length);
  return lista.map((d, i) => ({
    dias: d,
    fecha_vencimiento: fecha ? sumarDias(fecha, d) : null,
    monto: montos[i],
  }));
}

/** "Un pago, el día de la factura" / "A 30 días" / "A 30, 60 y 90 días". */
export function describirDias(dias = []) {
  if (!dias.length) return "Un pago, el día de la factura";
  if (dias.length === 1) return `A ${dias[0]} días`;
  return `A ${dias.slice(0, -1).join(", ")} y ${dias.at(-1)} días`;
}

/**
 * Los plazos de un movimiento. Uno sin plazos (no debería pasar después de
 * la migración) se trata como contado por su total.
 */
export function plazosDe(movimiento, total) {
  if (movimiento.plazos?.length) return movimiento.plazos;
  return [
    {
      id: null,
      numero: 1,
      dias: 0,
      fecha_vencimiento: movimiento.fecha,
      monto: total,
      pagado: movimiento.estado_pago !== "pendiente",
      fecha_pago: movimiento.estado_pago !== "pendiente" ? movimiento.fecha : null,
    },
  ];
}

/**
 * Días que lleva vencido el plazo pendiente más viejo, o null si no hay
 * ninguno vencido. Reemplaza a "días desde la fecha ≥ 90" como alerta.
 */
export function diasVencida(movimiento, hoy) {
  const dia = typeof hoy === "string" ? hoy : hoyISO(hoy ?? new Date());
  // Sin plazos (datos viejos de prueba): contado, vence el día de la factura.
  const plazos = movimiento.plazos?.length
    ? movimiento.plazos
    : movimiento.estado_pago === "pendiente"
      ? [{ pagado: false, fecha_vencimiento: movimiento.fecha }]
      : [];
  const vencidos = plazos
    .filter((p) => !p.pagado && p.fecha_vencimiento < dia)
    .map((p) => diasEntre(p.fecha_vencimiento, dia));
  return vencidos.length ? Math.max(...vencidos) : null;
}

/** Lo que falta pagar (suma de los plazos pendientes), en pesos. */
export function montoPendiente(movimiento) {
  return (movimiento.plazos ?? [])
    .filter((p) => !p.pagado)
    .reduce((acc, p) => acc + Number(p.monto), 0);
}

/**
 * Lo que falta pagar de una compra, en la moneda pedida: los plazos
 * pendientes (en dólares, con la cotización congelada de la compra). Sin
 * plazos, el total si está impaga. Es la "deuda" de verdad: una compra a
 * 30/60 con el primer plazo pagado debe sólo la mitad.
 */
export function pendienteCompra(compra, moneda = "ars") {
  if (!compra.plazos?.length) {
    return compra.estado_pago === "pendiente" ? precioTotalCompra(compra, moneda) : 0;
  }
  const pesos = montoPendiente(compra);
  return moneda === "ars" ? pesos : pesos / Number(compra.cotizacion_dolar || 1);
}

/** "1/2" para el plazo 1 de 2; nada si es uno solo. */
export function etiquetaPlazo(plazo, total) {
  return total > 1 ? `${plazo.numero}/${total}` : "";
}

/** La condición que se usa si no se elige otra: «Contado» (protegida). */
export function condicionPorDefecto(condiciones = []) {
  return condiciones.find((c) => c.protegido) ?? condiciones[0] ?? null;
}

/**
 * La condición no se puede cambiar si ya hay plazos pagados (lo rechaza el
 * backend). Excepción: si estaba todo pagado y en esta edición se pasa a "A
 * pagar", el backend desmarca primero y ahí sí se puede (un gasto cargado
 * como Contado pagado por error).
 */
export function condicionBloqueada(movimiento, estadoForm) {
  const hayPagados = (movimiento?.plazos ?? []).some((p) => p.pagado);
  const despagando = movimiento?.estado_pago === "pagado" && estadoForm === "pendiente";
  return hayPagados && !despagando;
}

/** "30/60/90", "30 60 90" o "30, 60" -> [30, 60, 90]; null si no se entiende. */
export function leerDias(texto) {
  const partes = texto
    .split(/[\s/,;-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (partes.length === 0) return [];
  const dias = partes.map(Number);
  if (dias.some((d) => !Number.isInteger(d) || d < 1 || d > 365)) return null;
  return [...new Set(dias)].sort((a, b) => a - b);
}

/** [30, 60] -> "30/60 días". */
export const nombreSugerido = (dias) => (dias.length ? `${dias.join("/")} días` : "");
