import { useCallback } from "react";

import { useMediosPago } from "./queries";
import { getMedioPagoLabel, opcionesMedioPago } from "../constants/medioPago";

/** `(codigo) => nombre` con la lista de Ajustes (también los desactivados:
 * los movimientos viejos siguen mostrando su medio). */
export function useEtiquetaMedioPago() {
  const { data: medios } = useMediosPago();
  return useCallback((codigo) => getMedioPagoLabel(codigo, medios ?? []), [medios]);
}

/** Opciones del control «Medio de pago» de los modales de carga. */
export function useOpcionesMedioPago(valorActual) {
  const { data: medios } = useMediosPago();
  return opcionesMedioPago(medios ?? [], valorActual);
}
