import { useState, useEffect } from "react";
import {
  getCategoriasGasto,
  crearCategoriaGasto,
  actualizarCategoriaGasto,
  eliminarCategoriaGasto,
} from "../services/categoriaGastoService";

export function useCategoriasGasto() {
  const [categoriasGasto, setCategoriasGasto] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarCategoriasGasto = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCategoriasGasto();
      setCategoriasGasto(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCategoriasGasto();
  }, []);

  const agregarCategoriaGasto = async (categoria) => {
    const nueva = await crearCategoriaGasto(categoria);
    setCategoriasGasto((prev) => [...prev, nueva]);
    return nueva;
  };

  const editarCategoriaGasto = async (categoriaId, cambios) => {
    const actualizada = await actualizarCategoriaGasto(categoriaId, cambios);
    setCategoriasGasto((prev) =>
      prev.map((c) => (c.id === categoriaId ? actualizada : c))
    );
    return actualizada;
  };

  const borrarCategoriaGasto = async (categoriaId) => {
    await eliminarCategoriaGasto(categoriaId);
    setCategoriasGasto((prev) => prev.filter((c) => c.id !== categoriaId));
  };

  return {
    categoriasGasto,
    loading,
    error,
    recargar: cargarCategoriasGasto,
    agregarCategoriaGasto,
    editarCategoriaGasto,
    borrarCategoriaGasto,
  };
}
