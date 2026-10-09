import { useCallback } from "react";

import { useTiposFactura } from "./queries";
import { getTipoFacturaLabel, opcionesTipoFactura } from "../constants/tipoFactura";

/** `(codigo) => nombre` con la lista de Ajustes. Renombrar un tipo sólo
 * invalida esta query: los movimientos guardan el código, no el nombre. */
export function useEtiquetaTipoFactura() {
  const { data: tipos } = useTiposFactura();
  return useCallback((codigo) => getTipoFacturaLabel(codigo, tipos ?? []), [tipos]);
}

/** Opciones del control «Comprobante» de los modales de carga. */
export function useOpcionesTipoFactura(valorActual) {
  const { data: tipos } = useTiposFactura();
  return opcionesTipoFactura(tipos ?? [], valorActual);
}
