import "./FiltrosSegmentados.css";

/**
 * Grupo de opciones excluyentes con contador opcional — "En curso 4 /
 * A iniciar 2" del Panel, "Todo 23 / Compras 12 / Gastos 8" de Acciones,
 * "US$ / Pesos" del selector de moneda.
 *
 * Dos formas, según DESIGN.md §9 ("Controles de opción"):
 *   - `variante="chips"` (default): el filtro de una lista. Chips de la
 *     variante 4L (`.chip` de index.css), con el contador adentro. Son chips
 *     y no tabs a propósito: el subrayado de 2px queda para la navegación de
 *     sección, y apilados debajo de las tabs del proyecto se leían como dos
 *     filas de tabs con significados distintos (decisión 5 del rediseño).
 *   - `variante="segmentado"`: 2–3 opciones cortas que cambian una vista o un
 *     dato, no que recortan una lista (US$ / Pesos). Track gris con la activa
 *     en blanco.
 *
 * Son botones con `aria-pressed` dentro de un `role="group"`: no son tabs
 * (no controlan un panel) ni un radiogroup (que promete navegar con flechas).
 *
 * `onCambiar` recibe la key elegida. `contadores` es opcional -- sin él los
 * botones van sin número.
 */
export function FiltrosSegmentados({
  opciones,
  activa,
  onCambiar,
  contadores,
  etiqueta,
  variante = "chips",
}) {
  if (variante === "segmentado") {
    return (
      <div className="segmentado" role="group" aria-label={etiqueta}>
        {opciones.map((opcion) => (
          <button
            key={opcion.key}
            type="button"
            aria-pressed={opcion.key === activa}
            className={`segmentado__btn${opcion.key === activa ? " segmentado__btn--activo" : ""}`}
            onClick={() => onCambiar(opcion.key)}
          >
            {opcion.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="filtros-chips" role="group" aria-label={etiqueta}>
      {opciones.map((opcion) => (
        <button
          key={opcion.key}
          type="button"
          aria-pressed={opcion.key === activa}
          className={`chip${opcion.key === activa ? " chip--activo" : ""}`}
          onClick={() => onCambiar(opcion.key)}
        >
          {opcion.label}
          {contadores && <span className="chip__contador">{contadores[opcion.key]}</span>}
        </button>
      ))}
    </div>
  );
}

export default FiltrosSegmentados;
