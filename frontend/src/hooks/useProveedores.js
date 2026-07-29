import { useState, useEffect } from "react";
import {
  getProveedores,
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from "../services/proveedorService";

export function useProveedores() {
  const [proveedores, setProveedores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarProveedores = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getProveedores();
      setProveedores(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarProveedores();
  }, []);

  const agregarProveedor = async (proveedor) => {
    const nuevo = await crearProveedor(proveedor);
    setProveedores((prev) => [...prev, nuevo]);
    return nuevo;
  };

  const editarProveedor = async (proveedorId, cambios) => {
    const actualizado = await actualizarProveedor(proveedorId, cambios);
    setProveedores((prev) =>
      prev.map((p) => (p.id === proveedorId ? actualizado : p))
    );
    return actualizado;
  };

  const borrarProveedor = async (proveedorId) => {
    await eliminarProveedor(proveedorId);
    setProveedores((prev) => prev.filter((p) => p.id !== proveedorId));
  };

  return {
    proveedores,
    loading,
    error,
    recargar: cargarProveedores,
    agregarProveedor,
    editarProveedor,
    borrarProveedor,
  };
}
