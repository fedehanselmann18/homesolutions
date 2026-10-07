import { useMemo } from "react";

import { formatMoneda } from "../../utils/formato";
import { TOLERANCIA_COBRO_USD } from "../../utils/moneda";
import { barrasDeContrato, saldoDeObra } from "../../utils/saldoObra";

import "./SaldoObra.css";

const ancho = (monto, escala) => `${escala > 0 ? Math.min(100, (monto / escala) * 100) : 0}%`;
const conPct = (monto, pct) =>
  pct == null ? formatMoneda(monto, "usd") : `${formatMoneda(monto, "usd")} · ${Math.round(pct)}%`;

/**
 * El bloque de arriba del libro: el saldo de la obra y dos barras, lo cobrado
 * y lo gastado contra el precio acordado (ver barrasDeContrato). La línea
 * vertical de cada barra es el contrato; si una barra la pasa, se ve pasada.
 *
 * Se calcula sobre los movimientos que Acciones ya tiene cargados (TODOS, sin
 * los filtros de la planilla: el saldo es de la obra, no de lo que se ve).
 */
export function SaldoObra({ compras, gastos, cobros, precioAcordadoUsd }) {
  const saldo = useMemo(
    () => ({
      ars: saldoDeObra({ compras, gastos, cobros }, "ars"),
      usd: saldoDeObra({ compras, gastos, cobros }, "usd"),
    }),
    [compras, gastos, cobros]
  );
  const b = useMemo(
    () => barrasDeContrato({ compras, gastos, cobros }, precioAcordadoUsd),
    [compras, gastos, cobros, precioAcordadoUsd]
  );

  const hayContrato = b.acordado > 0;
  // La línea del contrato solo cuando una barra lo pasa de verdad: un dólar
  // de más por redondeo la dibujaba pegada al final de la barra.
  const marcaContrato =
    hayContrato && b.escala - b.acordado >= TOLERANCIA_COBRO_USD
      ? ancho(b.acordado, b.escala)
      : null;
  const pagado = b.gastado - b.sinPagar;

  return (
    <section className="saldo-obra" aria-labelledby="saldo-obra-titulo">
      <div className="saldo-obra__cabecera">
        <div className="saldo-obra__cifras">
          <span id="saldo-obra-titulo" className="saldo-obra__titulo">
            Saldo de la obra
          </span>
          <span className="saldo-obra__saldo">
            {formatMoneda(saldo.ars)}
            <span className="saldo-obra__saldo-usd">{formatMoneda(saldo.usd, "usd")}</span>
          </span>
        </div>
        <span className="saldo-obra__contrato">
          {hayContrato ? (
            <>
              Contrato <strong>{formatMoneda(b.acordado, "usd")}</strong>
            </>
          ) : (
            "Sin precio acordado"
          )}
        </span>
      </div>

      <dl className="saldo-obra__barras">
        <div className="saldo-obra__fila">
          <dt>Cobrado</dt>
          <dd className="saldo-obra__pista">
            <span
              className="saldo-obra__tramo saldo-obra__tramo--cobro"
              style={{ width: ancho(b.cobrado, b.escala) }}
            />
            {marcaContrato && (
              <span className="saldo-obra__marca" style={{ left: marcaContrato }} />
            )}
          </dd>
          <dd className="saldo-obra__valor">
            <strong>{conPct(b.cobrado, b.pctCobrado)}</strong>
            {hayContrato && (
              <span>
                {b.faltaCobrar > 0
                  ? `Falta cobrar ${formatMoneda(b.faltaCobrar, "usd")}`
                  : "Contrato cobrado"}
              </span>
            )}
          </dd>
        </div>

        <div className="saldo-obra__fila">
          <dt>Gastado</dt>
          <dd className="saldo-obra__pista">
            <span
              className={`saldo-obra__tramo saldo-obra__tramo--egreso${
                b.gastoPasado ? " saldo-obra__tramo--pasado" : ""
              }`}
              style={{ width: ancho(pagado, b.escala) }}
            />
            {b.sinPagar > 0 && (
              <span
                className={`saldo-obra__tramo saldo-obra__tramo--sin-pagar${
                  b.gastoPasado ? " saldo-obra__tramo--pasado" : ""
                }`}
                style={{ width: ancho(b.sinPagar, b.escala) }}
              />
            )}
            {marcaContrato && (
              <span className="saldo-obra__marca" style={{ left: marcaContrato }} />
            )}
          </dd>
          <dd className="saldo-obra__valor">
            <strong className={b.gastoPasado ? "saldo-obra__pasado" : undefined}>
              {conPct(b.gastado, b.pctGastado)}
            </strong>
            {b.sinPagar > 0 && <span>{formatMoneda(b.sinPagar, "usd")} sin pagar</span>}
          </dd>
        </div>
      </dl>
    </section>
  );
}

export default SaldoObra;
