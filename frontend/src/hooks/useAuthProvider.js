import { useState, useEffect } from "react";
import { login as loginService, logout as logoutService } from "../services/authService";
import { getUsuarioActual } from "../services/usuarioService";

export function useAuthProvider() {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarUsuarioActual = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUsuario(null);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const data = await getUsuarioActual();
      setUsuario(data);
    } catch (err) {
      // token vencido o inválido -> el interceptor de axiosClient ya limpia localStorage
      setUsuario(null);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarUsuarioActual();
  }, []);

  const login = async (nombreUsuario, password) => {
    setError(null);
    await loginService(nombreUsuario, password);
    await cargarUsuarioActual();
  };

  const logout = () => {
    logoutService();
    setUsuario(null);
  };

  const isAdmin = usuario?.rol === "admin";

  return { usuario, loading, error, login, logout, isAdmin, recargar: cargarUsuarioActual };
}

export default useAuthProvider;