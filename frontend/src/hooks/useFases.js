import { useState, useEffect } from "react";
import {
  getFases,
  getFasesPorProyecto,
  crearFase,
  actualizarFase,
  eliminarFase,
} from "../services/faseService";

export function useFases(proyectoId = null) {
  const [fases, setFases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarFases = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = proyectoId
        ? await getFasesPorProyecto(proyectoId)
        : await getFases();
      setFases(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarFases();
  }, [proyectoId]);

  const agregarFase = async (fase) => {
    const nueva = await crearFase(fase);
    setFases((prev) => [...prev, nueva]);
    return nueva;
  };

  const editarFase = async (faseId, cambios) => {
    const actualizada = await actualizarFase(faseId, cambios);
    setFases((prev) => prev.map((f) => (f.id === faseId ? actualizada : f)));
    return actualizada;
  };

  const borrarFase = async (faseId) => {
    await eliminarFase(faseId);
    setFases((prev) => prev.filter((f) => f.id !== faseId));
  };

  return {
    fases,
    loading,
    error,
    recargar: cargarFases,
    agregarFase,
    editarFase,
    borrarFase,
  };
}
