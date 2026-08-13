import { useState, useEffect } from "react";
import {
  getProyectos,
  crearProyecto,
  actualizarProyecto,
  eliminarProyecto,
} from "../services/proyectoService";

export function useProyectos() {
  const [proyectos, setProyectos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarProyectos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProyectos();
      setProyectos(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProyectos();
  }, []);

  const agregarProyecto = async (proyecto) => {
    const nuevo = await crearProyecto(proyecto);
    setProyectos((prev) => [...prev, nuevo]);
    return nuevo;
  };

  const editarProyecto = async (proyectoId, cambios) => {
    const actualizado = await actualizarProyecto(proyectoId, cambios);
    setProyectos((prev) => prev.map((p) => (p.id === proyectoId ? actualizado : p)));
    return actualizado;
  };

  const borrarProyecto = async (proyectoId) => {
    await eliminarProyecto(proyectoId);
    setProyectos((prev) => prev.filter((p) => p.id !== proyectoId));
  };

  return {
    proyectos,
    loading,
    error,
    recargar: cargarProyectos,
    agregarProyecto,
    editarProyecto,
    borrarProyecto,
  };
}
