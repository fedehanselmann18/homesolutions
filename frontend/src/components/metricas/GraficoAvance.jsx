import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { EstadoVacio } from "../shared/EstadoVacio";
import { ETIQUETAS_METRICAS } from "../../constants/metricas";
import { OLIVA, GRIS, TINTA_TENUE, GRIS_CLARO, LINEA_SUAVE } from "../../constants/colores";
import { formatFecha, formatNumero } from "../../utils/formato";
import { cruzaAnio, etiquetaMes, ticksMensuales } from "./ejeTiempo";

const E = ETIQUETAS_METRICAS;

// Con UNA obra elegida en el filtro: cobrado y gastado acumulados como % de
// su precio acordado, en toda su historia. Si la línea de gastado va por
// arriba de la de cobrado, la obra se está pagando con plata de otro lado.
// La línea punteada en 100 % es el contrato.

const SERIES = [
  { clave: "cobrado", nombre: E.cobrado, color: OLIVA },
  { clave: "gastado", nombre: E.gastado, color: GRIS },
];

const pct = (v) => `${formatNumero(v, 0)} %`;

function TooltipAvance({ active, payload }) {
  if (!active || !payload?.length) return null;
  const punto = payload[0].payload;
  return (
    <div className="metricas-tooltip">
      <strong>{formatFecha(punto.fecha)}</strong>
      {SERIES.map((s) => (
        <span key={s.clave}>
          {s.nombre} {pct(punto[s.clave])}
        </span>
      ))}
    </div>
  );
}

export function GraficoAvance({ puntos }) {
  const encabezado = (
    <div className="metricas-seccion__header">
      <h2 className="metricas-seccion__titulo">{E.avanceObra}</h2>
      {puntos.length > 1 && (
        <div className="metricas-leyenda">
          {SERIES.map((s) => (
            <span key={s.clave} className="metricas-leyenda__item">
              <span className="metricas-leyenda__linea" style={{ background: s.color }} />
              {s.nombre}
            </span>
          ))}
        </div>
      )}
    </div>
  );

  if (puntos.length < 2) {
    return (
      <section className="metricas-seccion" aria-label={E.avanceObra}>
        {encabezado}
        <EstadoVacio mensaje={E.sinPrecioAcordado} />
      </section>
    );
  }

  const min = puntos[0].t;
  const max = puntos.at(-1).t;
  const conAnio = cruzaAnio(min, max);

  return (
    <section className="metricas-seccion" aria-label={E.avanceObra}>
      {encabezado}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={puntos} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={LINEA_SUAVE} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[min, max]}
            ticks={ticksMensuales(min, max)}
            tickFormatter={(t) => etiquetaMes(t, conAnio)}
            tickLine={false}
            axisLine={{ stroke: GRIS_CLARO }}
            tick={{ fontSize: 12, fill: TINTA_TENUE }}
          />
          <YAxis
            tickFormatter={pct}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: TINTA_TENUE }}
            width={48}
          />
          <ReferenceLine
            y={100}
            stroke={GRIS_CLARO}
            strokeDasharray="4 4"
            label={{
              value: E.contrato,
              position: "insideTopLeft",
              fontSize: 12,
              fill: TINTA_TENUE,
            }}
          />
          <Tooltip content={<TooltipAvance />} />
          {SERIES.map((s) => (
            <Line
              key={s.clave}
              dataKey={s.clave}
              name={s.nombre}
              type="stepAfter"
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </section>
  );
}

export default GraficoAvance;
