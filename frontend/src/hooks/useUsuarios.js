import { useState, useEffect } from "react";
import { getUsuarios, crearUsuario } from "../services/usuarioService";

export function useUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarUsuarios = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getUsuarios();
      setUsuarios(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarios();
  }, []);

  const agregarUsuario = async (usuario) => {
    const nuevo = await crearUsuario(usuario);
    setUsuarios((prev) => [...prev, nuevo]);
    return nuevo;
  };

  return { usuarios, loading, error, recargar: cargarUsuarios, agregarUsuario };
}
