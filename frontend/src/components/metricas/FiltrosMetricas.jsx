import { FiltrosSegmentados } from "../shared/FiltrosSegmentados";
import { SelectorMoneda } from "../shared/SelectorMoneda";
import { ETIQUETAS_METRICAS, PERIODOS_METRICAS } from "../../constants/metricas";

const OPCIONES_PERIODO = PERIODOS_METRICAS.map((p) => ({ key: p.value, label: p.label }));

/**
 * Filtros de Métricas: período (chips), obra (select) y moneda. Son
 * controlados: el estado vive en la URL (useFiltrosMetricas).
 */
export function FiltrosMetricas({ filtros, proyectos }) {
  const { periodo, obra, moneda, setPeriodo, setObra, setMoneda } = filtros;
  return (
    <div className="metricas-filtros">
      <FiltrosSegmentados
        opciones={OPCIONES_PERIODO}
        activa={periodo}
        onCambiar={setPeriodo}
        etiqueta={ETIQUETAS_METRICAS.periodo}
      />
      <div className="metricas-filtros__derecha">
        <select
          className="campo campo--sm metricas-filtros__obra"
          aria-label={ETIQUETAS_METRICAS.obra}
          value={obra ?? ""}
          onChange={(e) => setObra(e.target.value || null)}
        >
          <option value="">{ETIQUETAS_METRICAS.todasLasObras}</option>
          {proyectos.map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.nombre}
            </option>
          ))}
        </select>
        <SelectorMoneda moneda={moneda} onCambiar={setMoneda} />
      </div>
    </div>
  );
}

export default FiltrosMetricas;
