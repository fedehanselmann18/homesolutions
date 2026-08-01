import { useState } from "react";
import { extraerComprobanteConIA } from "../services/iaService";

/**
 * Wrapper de estado (loading) sobre iaService, compartido por los tres
 * modales que tienen botón "Autocompletar con IA" (Gasto/Compra/Cobro).
 * No decide nada de negocio -- cada modal mapea el resultado a su propio
 * form y decide qué campos tocar (ver ModalGasto/ModalCompra/ModalCobro).
 */
export function useExtraccionIA() {
  const [extrayendo, setExtrayendo] = useState(false);

  const extraer = async (archivo, tipoEntidad, contexto) => {
    setExtrayendo(true);
    try {
      return await extraerComprobanteConIA(archivo, tipoEntidad, contexto);
    } finally {
      setExtrayendo(false);
    }
  };

  return { extraer, extrayendo };
}
