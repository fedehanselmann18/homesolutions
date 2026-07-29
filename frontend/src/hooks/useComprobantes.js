import { useState } from "react";
import {
  subirComprobanteCompra,
  getComprobanteCompra,
  eliminarComprobanteCompra,
} from "../services/compraService";
import {
  subirComprobanteGasto,
  getComprobanteGasto,
  eliminarComprobanteGasto,
} from "../services/gastoService";
import {
  subirComprobanteCobro,
  getComprobanteCobro,
  eliminarComprobanteCobro,
} from "../services/cobroService";

// Mapa de servicios por tipo de entidad. Si agregás una cuarta entidad con
// comprobantes en el futuro, solo hay que sumar una entrada acá.
const SERVICIOS = {
  compra: {
    subir: subirComprobanteCompra,
    obtener: getComprobanteCompra,
    eliminar: eliminarComprobanteCompra,
  },
  gasto: {
    subir: subirComprobanteGasto,
    obtener: getComprobanteGasto,
    eliminar: eliminarComprobanteGasto,
  },
  cobro: {
    subir: subirComprobanteCobro,
    obtener: getComprobanteCobro,
    eliminar: eliminarComprobanteCobro,
  },
};

// tipo: "compra" | "gasto" | "cobro"
export function useComprobantes(tipo) {
  const servicio = SERVICIOS[tipo];
  if (!servicio) {
    throw new Error(`useComprobantes: tipo "${tipo}" no soportado`);
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const subir = async (entidadId, archivo) => {
    try {
      setLoading(true);
      setError(null);
      return await servicio.subir(entidadId, archivo);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Devuelve una URL de blob lista para <img src={...}> o abrir en pestaña nueva.
  // Importante: quien la use debe llamar URL.revokeObjectURL(url) al desmontar
  // o descartar la vista, para no acumular memoria.
  const verComoUrl = async (entidadId, comprobanteId) => {
    try {
      setLoading(true);
      setError(null);
      const blob = await servicio.obtener(entidadId, comprobanteId);
      return URL.createObjectURL(blob);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const borrar = async (entidadId, comprobanteId) => {
    try {
      setLoading(true);
      setError(null);
      await servicio.eliminar(entidadId, comprobanteId);
    } catch (err) {
      setError(err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { loading, error, subir, verComoUrl, borrar };
}
