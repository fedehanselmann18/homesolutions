import { FiltrosSegmentados } from "./FiltrosSegmentados";
import { useMonedaAnalisis } from "../../hooks/useMonedaAnalisis";
import { MONEDAS } from "../../utils/moneda";

const OPCIONES = [MONEDAS.usd, MONEDAS.ars];

/**
 * Switch US$ / Pesos de los análisis (ver docs/PLAN_TIPO_CAMBIO.md, Fase 5).
 * Es un filtro excluyente, así que reusa FiltrosSegmentados en vez de
 * inventar otro control. La elección es global (useMonedaAnalisis): cambia
 * todos los análisis de la app a la vez.
 */
export function SelectorMoneda() {
  const [moneda, setMoneda] = useMonedaAnalisis();
  return (
    <FiltrosSegmentados
      opciones={OPCIONES}
      activa={moneda}
      onCambiar={setMoneda}
      etiqueta="Moneda del análisis"
      variante="segmentado"
    />
  );
}

export default SelectorMoneda;
