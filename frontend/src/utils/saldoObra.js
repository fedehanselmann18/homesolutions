import { montoCobroNeto, montoGasto, precioTotalCompra, saldoPorCobrar } from "./moneda";
import { esCompraImpaga } from "./seguimiento";

const sumar = (items, monto) => items.reduce((acc, item) => acc + monto(item), 0);

/**
 * Lo que entró menos lo que salió, de toda la obra. En pesos es el mismo
 * número que la última fila de la columna "Saldo restante" del libro (la caja,
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
 * Las dos barras del bloque de arriba del libro: lo cobrado y lo gastado de
 * toda la obra contra el precio acordado, en dólares (el contrato es en USD).
 * No es una línea de tiempo a propósito: los cobros llegan en dos o tres
 * pagos sueltos y un gráfico por fecha quedaba casi todo plano. Lo que sirve
 * arriba de los movimientos es dónde está la obra contra el contrato.
 *
 * `escala` es el 100% de las barras: el precio acordado, o lo que lo pase si
 * se cobró o se gastó de más (así la barra que se pasa se ve pasada y la
 * marca del contrato queda antes del final). Sin precio acordado la escala es
 * el mayor de los dos y no hay porcentajes.
 *
 * `sinPagar` son las compras pendientes de pago (el mismo criterio que
 * Seguimiento): ya están dentro de `gastado`, la barra las muestra como el
 * tramo comprometido que todavía no salió.
 */
export function barrasDeContrato({ compras = [], gastos = [], cobros = [] }, precioAcordadoUsd) {
  const acordado = Number(precioAcordadoUsd) || 0;
  const cobrado = sumar(cobros, (c) => montoCobroNeto(c, "usd"));
  const gastado = saldoDeObra({ compras, gastos }, "usd") * -1;
  const sinPagar = sumar(compras.filter(esCompraImpaga), (c) => precioTotalCompra(c, "usd"));
  const escala = Math.max(acordado, cobrado, gastado);
  const pct = (monto) => (acordado > 0 ? (monto / acordado) * 100 : null);

  return {
    acordado,
    cobrado,
    gastado,
    sinPagar,
    escala,
    pctCobrado: pct(cobrado),
    pctGastado: pct(gastado),
    faltaCobrar: acordado > 0 ? saldoPorCobrar(acordado, cobrado) : 0,
    gastoPasado: acordado > 0 && gastado > acordado,
  };
}
