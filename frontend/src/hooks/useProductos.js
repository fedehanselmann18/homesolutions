import { useState, useEffect } from "react";
import {
  getProductos,
  getProductosPorProveedor,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from "../services/productoService";

export function useProductos(proveedorId = null) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarProductos = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = proveedorId
        ? await getProductosPorProveedor(proveedorId)
        : await getProductos();
      setProductos(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, [proveedorId]); // si cambia el proveedor, recarga filtrado

  const agregarProducto = async (producto) => {
    const nuevo = await crearProducto(producto);
    setProductos((prev) => [...prev, nuevo]);
    return nuevo;
  };

  // cambios NO debe incluir categoria_ids salvo que el usuario haya tocado
  // el selector de categorías: el backend reemplaza la relación completa.
  const editarProducto = async (productoId, cambios) => {
    const actualizado = await actualizarProducto(productoId, cambios);
    setProductos((prev) =>
      prev.map((p) => (p.id === productoId ? actualizado : p))
    );
    return actualizado;
  };

  const borrarProducto = async (productoId) => {
    await eliminarProducto(productoId);
    setProductos((prev) => prev.filter((p) => p.id !== productoId));
  };

  return {
    productos,
    loading,
    error,
    recargar: cargarProductos,
    agregarProducto,
    editarProducto,
    borrarProducto,
  };
}
