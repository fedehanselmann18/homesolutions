import { FiltrosSegmentados } from "./FiltrosSegmentados";
import { useMonedaAnalisis } from "../../hooks/useMonedaAnalisis";
import { MONEDAS } from "../../utils/moneda";

const OPCIONES = [MONEDAS.usd, MONEDAS.ars];

/**
 * Switch US$ / Pesos de los análisis.
 * Es un filtro excluyente, así que reusa FiltrosSegmentados en vez de
 * inventar otro control. La elección es global (useMonedaAnalisis): cambia
 * todos los análisis de la app a la vez.
 *
 * `moneda` / `onCambiar` son opcionales: Métricas los pasa porque además
 * guarda la moneda en la URL (ver hooks/useMetricas.js).
 */
export function SelectorMoneda({ moneda: monedaExterna, onCambiar } = {}) {
  const [monedaGlobal, setMonedaGlobal] = useMonedaAnalisis();
  return (
    <FiltrosSegmentados
      opciones={OPCIONES}
      activa={monedaExterna ?? monedaGlobal}
      onCambiar={onCambiar ?? setMonedaGlobal}
      etiqueta="Moneda del análisis"
      variante="segmentado"
    />
  );
}

export default SelectorMoneda;
