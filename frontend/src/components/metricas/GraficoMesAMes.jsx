import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ETIQUETAS_METRICAS } from "../../constants/metricas";
import { OLIVA, GRIS_CLARO, TINTA_MUTED, TINTA_TENUE, LINEA_SUAVE } from "../../constants/colores";
import { formatMoneda, formatMonedaCorta } from "../../utils/formato";

const E = ETIQUETAS_METRICAS;

// Mes a mes: columnas de ingresos y egresos de cada mes, y encima la línea
// del saldo acumulado desde el inicio del período ("cuánto me queda"). Cada
// mes se lee solo; la línea cuenta cómo viene la caja. La línea de cero
// marca cuándo el saldo pasa a negativo.

const BARRAS = [
  { clave: "ingresos", label: E.ingresos, color: OLIVA },
  { clave: "egresos", label: E.egresos, color: GRIS_CLARO },
];

function TooltipMes({ active, payload, moneda }) {
  if (!active || !payload?.length) return null;
  const mes = payload[0].payload;
  return (
    <div className="metricas-tooltip">
      <strong>{mes.etiquetaCompleta}</strong>
      {BARRAS.map((b) => (
        <span key={b.clave}>
          {b.label} {formatMoneda(mes[b.clave], moneda)}
        </span>
      ))}
      <span className="metricas-tooltip__fuerte">
        {E.saldoAcumulado} {formatMoneda(mes.resultadoAcumulado, moneda)}
      </span>
    </div>
  );
}

/** "oct" o, si el período cruza de año, "oct 25" para no repetir meses. */
function conEtiquetas(meses) {
  const anios = new Set(meses.map((m) => m.mes.slice(0, 4)));
  if (anios.size < 2) return meses;
  return meses.map((m) => ({ ...m, label: `${m.label} ${m.mes.slice(2, 4)}` }));
}

export function GraficoMesAMes({ meses, moneda }) {
  return (
    <section className="metricas-seccion" aria-label={E.mesAMes}>
      <div className="metricas-seccion__header">
        <h2 className="metricas-seccion__titulo">{E.mesAMes}</h2>
        <div className="metricas-leyenda">
          {BARRAS.map((b) => (
            <span key={b.clave} className="metricas-leyenda__item">
              <span className="metricas-leyenda__cuadro" style={{ background: b.color }} />
              {b.label}
            </span>
          ))}
          <span className="metricas-leyenda__item">
            <span className="metricas-leyenda__linea" style={{ background: TINTA_MUTED }} />
            {E.saldoAcumulado}
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <ComposedChart
          data={conEtiquetas(meses)}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
          barGap={4}
        >
          <CartesianGrid vertical={false} stroke={LINEA_SUAVE} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: TINTA_TENUE }}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={(v) => formatMonedaCorta(v, moneda)}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: TINTA_TENUE }}
            width={72}
          />
          <ReferenceLine y={0} stroke={GRIS_CLARO} />
          <Tooltip content={<TooltipMes moneda={moneda} />} cursor={{ fill: LINEA_SUAVE }} />
          {BARRAS.map((b) => (
            <Bar
              key={b.clave}
              dataKey={b.clave}
              name={b.label}
              fill={b.color}
              maxBarSize={22}
              isAnimationActive={false}
              radius={[3, 3, 0, 0]}
            />
          ))}
          <Line
            dataKey="resultadoAcumulado"
            name={E.saldoAcumulado}
            type="linear"
            stroke={TINTA_MUTED}
            strokeWidth={2}
            dot={{ r: 3, fill: TINTA_MUTED, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}

export default GraficoMesAMes;
