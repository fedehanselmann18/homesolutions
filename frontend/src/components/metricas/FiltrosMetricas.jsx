import { FiltrosSegmentados } from "../shared/FiltrosSegmentados";
import { SelectorMoneda } from "../shared/SelectorMoneda";
import { ETIQUETAS_METRICAS, PERIODOS_METRICAS } from "../../constants/metricas";

const OPCIONES_PERIODO = PERIODOS_METRICAS.map((p) => ({ key: p.value, label: p.label }));

/**
 * Filtros de Métricas: período (chips) y moneda. Son
 * controlados: el estado vive en la URL (useFiltrosMetricas).
 */
export function FiltrosMetricas({ filtros }) {
  const { periodo, moneda, setPeriodo, setMoneda } = filtros;
  return (
    <div className="metricas-filtros">
      <FiltrosSegmentados
        opciones={OPCIONES_PERIODO}
        activa={periodo}
        onCambiar={setPeriodo}
        etiqueta={ETIQUETAS_METRICAS.periodo}
      />
      <SelectorMoneda moneda={moneda} onCambiar={setMoneda} />
    </div>
  );
}

export default FiltrosMetricas;
