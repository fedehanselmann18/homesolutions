import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { formatMoneda, formatNumero } from "../../utils/formato";
import {
  PERIODOS_SALDO,
  PERIODO_SALDO_DEFAULT,
  resumirSaldoObra,
  topeDeEje,
} from "../../utils/saldoObra";

import "./SaldoObra.css";

const textoPeriodo = (meses) => `Últimos ${meses} meses`;

/**
 * El bloque de arriba del libro (Movimientos v2): el saldo de la obra, lo
 * cobrado y lo gastado en el período, y un gráfico de barras por mes.
 *
 * Se calcula sobre los movimientos que Acciones ya tiene cargados (TODOS, sin
 * los filtros de la planilla: el saldo es de la obra, no de lo que se ve). El
 * backend no expone una agregación mensual y no hace falta: la planilla ya
 * trae cada movimiento con sus dos cifras congeladas.
 */
export function SaldoObra({ compras, gastos, cobros, hoy }) {
  const [meses, setMeses] = useState(PERIODO_SALDO_DEFAULT);
  const resumen = useMemo(
    () => resumirSaldoObra({ compras, gastos, cobros }, { meses, hoy: hoy ?? new Date() }),
    [compras, gastos, cobros, meses, hoy]
  );

  const maximo = Math.max(...resumen.meses.flatMap((m) => [m.cobrado, m.gastado]));
  const tope = topeDeEje(maximo);
  const alto = (monto) => `${Math.max(0, (monto / tope) * 100)}%`;
  const descripcionGrafico = resumen.meses
    .map(
      (m) =>
        `${m.etiquetaCompleta}: cobrado ${formatMoneda(m.cobrado, "usd")}, gastado ${formatMoneda(
          m.gastado,
          "usd"
        )}`
    )
    .join("; ");

  return (
    <section className="saldo-obra" aria-labelledby="saldo-obra-titulo">
      <div className="saldo-obra__cabecera">
        <div className="saldo-obra__cifras">
          <span id="saldo-obra-titulo" className="saldo-obra__titulo">
            Saldo de la obra
          </span>
          <span className="saldo-obra__saldo">
            {formatMoneda(resumen.saldo.ars)}
            <span className="saldo-obra__saldo-usd">{formatMoneda(resumen.saldo.usd, "usd")}</span>
          </span>
          <span className="saldo-obra__resumen">
            Cobrado {formatMoneda(resumen.cobradoUsd, "usd")} · Gastado{" "}
            {formatMoneda(resumen.gastadoArs)} (≈ {formatMoneda(resumen.gastadoUsd, "usd")}) en los
            últimos {meses} meses
          </span>
        </div>

        <label className="btn saldo-obra__periodo">
          {textoPeriodo(meses)}
          <ChevronDown size={14} aria-hidden="true" />
          <select
            value={meses}
            onChange={(e) => setMeses(Number(e.target.value))}
            aria-label="Período del gráfico"
          >
            {PERIODOS_SALDO.map((p) => (
              <option key={p} value={p}>
                {textoPeriodo(p)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="saldo-obra__grafico">
        <div className="saldo-obra__eje" aria-hidden="true">
          <span>{formatNumero(tope)}</span>
          <span>{formatNumero(tope / 2)}</span>
          <span>0</span>
        </div>
        <div
          className="saldo-obra__barras"
          role="img"
          aria-label={`Cobrado y gastado por mes, en dólares. ${descripcionGrafico}`}
          style={{ gridTemplateColumns: `repeat(${resumen.meses.length}, minmax(0, 1fr))` }}
        >
          {resumen.meses.map((m) => (
            <div key={m.mes} className="saldo-obra__mes">
              <div
                className="saldo-obra__barra saldo-obra__barra--cobro"
                style={{ height: alto(m.cobrado) }}
                title={`${m.etiquetaCompleta} · cobrado ${formatMoneda(m.cobrado, "usd")}`}
              />
              <div
                className="saldo-obra__barra saldo-obra__barra--egreso"
                style={{ height: alto(m.gastado) }}
                title={`${m.etiquetaCompleta} · compras y gastos ${formatMoneda(
                  m.gastadoArs
                )} (≈ ${formatMoneda(m.gastado, "usd")})`}
              />
            </div>
          ))}
          {!(maximo > 0) && (
            <span className="saldo-obra__vacio">Sin movimientos en los últimos {meses} meses</span>
          )}
        </div>
        <span />
        <div
          className="saldo-obra__meses"
          aria-hidden="true"
          style={{ gridTemplateColumns: `repeat(${resumen.meses.length}, minmax(0, 1fr))` }}
        >
          {resumen.meses.map((m) => (
            <span key={m.mes}>{m.label}</span>
          ))}
        </div>
      </div>

      <div className="saldo-obra__leyenda" aria-hidden="true">
        <span>
          <span className="saldo-obra__muestra saldo-obra__muestra--cobro" />
          Cobros
        </span>
        <span>
          <span className="saldo-obra__muestra saldo-obra__muestra--egreso" />
          Compras y gastos
        </span>
        <span className="saldo-obra__unidad">en US$</span>
      </div>
    </section>
  );
}

export default SaldoObra;
