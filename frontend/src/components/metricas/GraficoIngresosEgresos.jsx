import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ETIQUETAS_METRICAS } from "../../constants/metricas";
import { OLIVA, GRIS_CLARO, LINEA_SUAVE, TINTA_TENUE } from "../../constants/colores";
import { formatMoneda, formatMonedaCorta } from "../../utils/formato";

// Ingresos y egresos por mes: barras agrupadas, el mismo patrón que el Panel
// (oliva ingresos, gris claro egresos).

const SERIES = [
  { clave: "ingresos", label: ETIQUETAS_METRICAS.ingresos, color: OLIVA },
  { clave: "egresos", label: ETIQUETAS_METRICAS.egresos, color: GRIS_CLARO },
];

function TooltipMes({ active, payload, moneda }) {
  if (!active || !payload?.length) return null;
  const mes = payload[0].payload;
  return (
    <div className="metricas-tooltip">
      <strong>{mes.etiquetaCompleta}</strong>
      {SERIES.map((s) => (
        <span key={s.clave}>
          {s.label} {formatMoneda(mes[s.clave], moneda)}
        </span>
      ))}
    </div>
  );
}

/**
 * Si el período cruza de año, "oct" se repetiría: el eje pasa a "oct 25".
 */
function conEtiquetas(datos) {
  const anios = new Set(datos.map((m) => m.mes.slice(0, 4)));
  if (anios.size < 2) return datos;
  return datos.map((m) => ({ ...m, label: `${m.label} ${m.mes.slice(2, 4)}` }));
}

export function GraficoIngresosEgresos({ datos, moneda }) {
  return (
    <section className="metricas-seccion" aria-label={ETIQUETAS_METRICAS.evolucionMensual}>
      <div className="metricas-seccion__header">
        <h2 className="metricas-seccion__titulo">{ETIQUETAS_METRICAS.evolucionMensual}</h2>
        <div className="metricas-leyenda">
          {SERIES.map((s) => (
            <span key={s.clave} className="metricas-leyenda__item">
              <span className="metricas-leyenda__cuadro" style={{ background: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart
          data={conEtiquetas(datos)}
          margin={{ top: 8, right: 0, left: 0, bottom: 0 }}
          barGap={4}
        >
          <CartesianGrid vertical={false} stroke={LINEA_SUAVE} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: GRIS_CLARO }}
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
          <Tooltip content={<TooltipMes moneda={moneda} />} cursor={{ fill: LINEA_SUAVE }} />
          {SERIES.map((s) => (
            <Bar
              key={s.clave}
              dataKey={s.clave}
              name={s.label}
              fill={s.color}
              maxBarSize={22}
              isAnimationActive={false}
              radius={[3, 3, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </section>
  );
}

export default GraficoIngresosEgresos;
