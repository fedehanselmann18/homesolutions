import { useState, useEffect } from "react";
import {
  getCobros,
  getCobrosPorProyecto,
  crearCobro,
  actualizarCobro,
  eliminarCobro,
} from "../services/cobroService";

export function useCobros(proyectoId = null) {
  const [cobros, setCobros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarCobros = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = proyectoId
        ? await getCobrosPorProyecto(proyectoId)
        : await getCobros();
      setCobros(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCobros();
  }, [proyectoId]);

  const agregarCobro = async (cobro) => {
    const nuevo = await crearCobro(cobro);
    setCobros((prev) => [...prev, nuevo]);
    return nuevo;
  };

  const editarCobro = async (cobroId, cambios) => {
    const actualizado = await actualizarCobro(cobroId, cambios);
    setCobros((prev) => prev.map((c) => (c.id === cobroId ? actualizado : c)));
    return actualizado;
  };

  const borrarCobro = async (cobroId) => {
    await eliminarCobro(cobroId);
    setCobros((prev) => prev.filter((c) => c.id !== cobroId));
  };

  return {
    cobros,
    loading,
    error,
    recargar: cargarCobros,
    agregarCobro,
    editarCobro,
    borrarCobro,
  };
}
