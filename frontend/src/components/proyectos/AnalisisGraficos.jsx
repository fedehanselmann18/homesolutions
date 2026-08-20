import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatMoneda, formatMonedaCorta } from "../../utils/formato";
import { VERDE, PALETA_GRAFICOS } from "../../constants/colores";
import { EstadoVacio } from "../shared/EstadoVacio";

// Compartido entre AnalisisGeneral (proyecto) y AnalisisFase: mismo lenguaje
// visual para que el análisis de una fase se lea como una versión acotada
// del análisis del proyecto, no como una pantalla distinta.
export const COLORES_TORTA = PALETA_GRAFICOS;

export function Seccion({ titulo, descripcion, children, vacio, mensajeVacio }) {
  return (
    <section className="analisis-seccion">
      <h3 className="analisis-seccion-titulo">{titulo}</h3>
      {descripcion && <p className="analisis-seccion-descripcion">{descripcion}</p>}
      {vacio ? <EstadoVacio mensaje={mensajeVacio} /> : children}
    </section>
  );
}

export function TooltipMoneda({ active, payload, label, obtenerValor, mostrarPorcentaje }) {
  if (!active || !payload?.length) return null;
  const dato = payload[0].payload;
  const valor = obtenerValor(dato);
  if (!Number.isFinite(valor)) return null;

  return (
    <div className="analisis-tooltip">
      <strong>{label ?? dato.name ?? dato.nombre}</strong>
      <span>{formatMoneda(valor)}</span>
      {mostrarPorcentaje && Number.isFinite(dato.pct) && (
        <span className="analisis-tooltip-pct">{dato.pct.toFixed(1)}%</span>
      )}
    </div>
  );
}

// depth 0 = raíz (no se dibuja), 1 = tipo de producto (solo el marco),
// 2 = producto (el bloque con nombre y monto)
export function ContenidoTreemap({ x, y, width, height, depth, name, monto, color, indice }) {
  if (depth === 0) return null;

  if (depth === 1) {
    return (
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="var(--color-superficie)"
        strokeWidth={4}
      />
    );
  }

  const opacidad = 0.9 - Math.min(indice ?? 0, 5) * 0.12;
  const entraElTexto = width > 80 && height > 36;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color ?? VERDE}
        fillOpacity={opacidad}
        stroke="var(--color-superficie)"
        strokeWidth={1}
      />
      {entraElTexto && (
        <>
          <text x={x + 8} y={y + 20} className="analisis-treemap-nombre">
            {name}
          </text>
          <text x={x + 8} y={y + 36} className="analisis-treemap-monto">
            {formatMonedaCorta(monto)}
          </text>
        </>
      )}
    </g>
  );
}

export function Torta({ datos, colores }) {
  return (
    <div className="analisis-torta">
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={datos}
            dataKey="monto"
            nameKey="nombre"
            innerRadius={55}
            outerRadius={90}
            paddingAngle={2}
            isAnimationActive={false}
          >
            {datos.map((dato, i) => (
              <Cell key={dato.nombre} fill={colores[i % colores.length]} />
            ))}
          </Pie>
          <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.monto} mostrarPorcentaje />} />
        </PieChart>
      </ResponsiveContainer>

      <ul className="analisis-leyenda">
        {datos.map((dato, i) => (
          <li key={dato.nombre} className="analisis-leyenda-item">
            <span
              className="analisis-leyenda-punto"
              style={{ backgroundColor: colores[i % colores.length] }}
            />
            <span className="analisis-leyenda-nombre">{dato.nombre}</span>
            <span className="analisis-leyenda-pct">{dato.pct.toFixed(1)}%</span>
            <span className="analisis-leyenda-monto">{formatMoneda(dato.monto)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
