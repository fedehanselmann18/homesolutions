import { montoCobroNeto, montoGasto, precioTotalCompra } from "./moneda";
import { armarEvolucion } from "./panel";

// Los períodos del selector del saldo de la obra, en meses.
export const PERIODOS_SALDO = [3, 5, 12];
export const PERIODO_SALDO_DEFAULT = 5;

const sumar = (items, monto) => items.reduce((acc, item) => acc + monto(item), 0);

/**
 * Lo que entró menos lo que salió, de toda la obra. En pesos es el mismo
 * número que la última fila de la columna "Saldo $" del libro (la caja,
 * nominal); en dólares suma las cifras congeladas de cada movimiento.
 */
export function saldoDeObra({ compras = [], gastos = [], cobros = [] }, moneda) {
  return (
    sumar(cobros, (c) => montoCobroNeto(c, moneda)) -
    sumar(compras, (c) => precioTotalCompra(c, moneda)) -
    sumar(gastos, (g) => montoGasto(g, moneda))
  );
}

/**
 * El bloque de arriba del libro: el saldo y los últimos `meses` meses. El
 * gráfico va en dólares (PLAN_TIPO_CAMBIO.md, decisión #6: los gráficos van
 * en USD) porque cobros y egresos tienen que compartir una escala; el texto
 * respeta la moneda de cada uno: cobrado en dólares, gastado en pesos.
 */
export function resumirSaldoObra({ compras = [], gastos = [], cobros = [] }, { meses, hoy }) {
  const evolucionUsd = armarEvolucion(gastos, cobros, compras, hoy, "usd", meses);
  const evolucionArs = armarEvolucion(gastos, cobros, compras, hoy, "ars", meses);

  return {
    saldo: {
      ars: saldoDeObra({ compras, gastos, cobros }, "ars"),
      usd: saldoDeObra({ compras, gastos, cobros }, "usd"),
    },
    cobradoUsd: sumar(evolucionUsd, (m) => m.cobrado),
    gastadoArs: sumar(evolucionArs, (m) => m.gastado),
    gastadoUsd: sumar(evolucionUsd, (m) => m.gastado),
    meses: evolucionUsd.map((m, i) => ({ ...m, gastadoArs: evolucionArs[i].gastado })),
  };
}

const PASOS_REDONDOS = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/**
 * Tope del eje Y para dos divisiones con números redondos: 7.300 -> 8.000
 * (marcas en 0, 4.000 y 8.000). Sin datos devuelve 1.000, para que el eje
 * tenga marcas y las barras en cero se lean como cero.
 */
export function topeDeEje(maximo) {
  if (!(maximo > 0)) return 1000;
  const mitad = maximo / 2;
  const magnitud = 10 ** Math.floor(Math.log10(mitad));
  const paso = PASOS_REDONDOS.find((p) => p * magnitud >= mitad) * magnitud;
  return paso * 2;
}
