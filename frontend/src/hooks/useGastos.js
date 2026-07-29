import { useState, useEffect } from "react";
import {
  getGastos,
  getGastosPorProyecto,
  getGastosPorFase,
  crearGasto,
  actualizarGasto,
  eliminarGasto,
} from "../services/gastoService";

// filtro: { proyectoId } o { faseId } (opcional, uno u otro)
export function useGastos(filtro = {}) {
  const { proyectoId, faseId } = filtro;
  const [gastos, setGastos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarGastos = async () => {
    try {
      setLoading(true);
      setError(null);
      let data;
      if (faseId) {
        data = await getGastosPorFase(faseId);
      } else if (proyectoId) {
        data = await getGastosPorProyecto(proyectoId);
      } else {
        data = await getGastos();
      }
      setGastos(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarGastos();
  }, [proyectoId, faseId]);

  const agregarGasto = async (gasto) => {
    const nuevo = await crearGasto(gasto);
    setGastos((prev) => [...prev, nuevo]);
    return nuevo;
  };

  const editarGasto = async (gastoId, cambios) => {
    const actualizado = await actualizarGasto(gastoId, cambios);
    setGastos((prev) => prev.map((g) => (g.id === gastoId ? actualizado : g)));
    return actualizado;
  };

  const borrarGasto = async (gastoId) => {
    await eliminarGasto(gastoId);
    setGastos((prev) => prev.filter((g) => g.id !== gastoId));
  };

  return {
    gastos,
    loading,
    error,
    recargar: cargarGastos,
    agregarGasto,
    editarGasto,
    borrarGasto,
  };
}
