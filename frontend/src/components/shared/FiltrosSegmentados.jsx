import "./FiltrosSegmentados.css";

/**
 * Grupo de filtros excluyentes con contador — "En curso 4 / A iniciar 2" del
 * Panel, "Todo 23 / Compras 12 / Gastos 8 / Cobros 3" de Acciones.
 *
 * Antes eran dos implementaciones con estados activos opuestos:
 * `.panel-filtro-estado-btn` (rectángulo, activo en negro sólido con texto
 * blanco) en Panel y Proyectos, y `.acciones-filtro-tipo` (píldora, activo en
 * tint oliva) en Acciones y Acciones de la fase. Misma interacción, dos
 * lenguajes. Quedó la píldora oliva: el negro competía con el sidebar, que ya
 * es negro puro.
 *
 * `onCambiar` recibe la key elegida. `contadores` es opcional -- sin él los
 * botones van sin número.
 */
export function FiltrosSegmentados({ opciones, activa, onCambiar, contadores, etiqueta }) {
  return (
    <div className="filtros-seg" role="tablist" aria-label={etiqueta}>
      {opciones.map((opcion) => (
        <button
          key={opcion.key}
          type="button"
          role="tab"
          aria-selected={opcion.key === activa}
          className={`filtros-seg__btn${opcion.key === activa ? " filtros-seg__btn--activo" : ""}`}
          onClick={() => onCambiar(opcion.key)}
        >
          {opcion.label}
          {contadores && <span className="filtros-seg__contador">{contadores[opcion.key]}</span>}
        </button>
      ))}
    </div>
  );
}

export default FiltrosSegmentados;
