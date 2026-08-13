import "./TarjetaKpi.css";

const VERDE = "#16a34a";

/**
 * Barra de progreso de un KPI. El porcentaje se recorta a [0, 100] para
 * dibujar, pero el número que se muestra al lado puede pasarse de 100 (ej.
 * un proyecto que gastó más de lo acordado) — eso lo decide quien la usa.
 */
export function BarraProgreso({ porcentaje, color = VERDE }) {
  return (
    <div className="kpi-progreso">
      <div
        className="kpi-progreso-relleno"
        style={{ width: `${Math.min(Math.max(porcentaje, 0), 100)}%`, backgroundColor: color }}
      />
    </div>
  );
}

/**
 * Tarjeta de KPI compartida entre el Panel y el Análisis General de un
 * proyecto, para que los números grandes se vean igual en toda la app.
 *
 * - `porcentaje`: si viene, dibuja la barra de progreso debajo del valor.
 * - `destacado`: pinta el valor con `color` (se usa para plata en verde/rojo).
 * - `plano`: sin borde ni fondo, para meterla adentro de otra tarjeta.
 */
export function TarjetaKpi({
  titulo,
  valor,
  detalle,
  porcentaje,
  color = VERDE,
  destacado,
  plano,
}) {
  return (
    <div className={`kpi ${plano ? "kpi--plano" : ""}`}>
      {titulo && <span className="kpi-titulo">{titulo}</span>}
      <span
        className={`kpi-valor ${destacado ? "kpi-valor--destacado" : ""}`}
        style={destacado ? { color } : undefined}
      >
        {valor}
      </span>
      {porcentaje !== undefined && <BarraProgreso porcentaje={porcentaje} color={color} />}
      {detalle && <span className="kpi-detalle">{detalle}</span>}
    </div>
  );
}

export default TarjetaKpi;
