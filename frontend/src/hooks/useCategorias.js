import { useState, useEffect } from "react";
import {
  getCategorias,
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "../services/categoriaService";

export function useCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarCategorias = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getCategorias();
      setCategorias(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCategorias();
  }, []);

  const agregarCategoria = async (categoria) => {
    const nueva = await crearCategoria(categoria);
    setCategorias((prev) => [...prev, nueva]);
    return nueva;
  };

  const editarCategoria = async (categoriaId, cambios) => {
    const actualizada = await actualizarCategoria(categoriaId, cambios);
    setCategorias((prev) =>
      prev.map((c) => (c.id === categoriaId ? actualizada : c))
    );
    return actualizada;
  };

  const borrarCategoria = async (categoriaId) => {
    await eliminarCategoria(categoriaId);
    setCategorias((prev) => prev.filter((c) => c.id !== categoriaId));
  };

  return {
    categorias,
    loading,
    error,
    recargar: cargarCategorias,
    agregarCategoria,
    editarCategoria,
    borrarCategoria,
  };
}
