import { useState } from "react";
import { leerCatalogoConIA } from "../services/iaService";

/**
 * Wrapper de estado (loading) sobre iaService, mismo patrón que
 * useExtraccionIA -- no decide nada de negocio, eso lo hace
 * ModalImportarCatalogo con el resultado.
 */
export function useLecturaCatalogoIA() {
  const [leyendo, setLeyendo] = useState(false);

  const leer = async (archivo, proveedorId, contexto) => {
    setLeyendo(true);
    try {
      return await leerCatalogoConIA(archivo, proveedorId, contexto);
    } finally {
      setLeyendo(false);
    }
  };

  return { leer, leyendo };
}
