import { useState, useEffect } from "react";
import { login as loginService, logout as logoutService } from "../services/authService";
import { getUsuarioActual } from "../services/usuarioService";

export function useAuthProvider() {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarUsuarioActual = async () => {
    // La sesión vive en una cookie httpOnly: JS no puede leerla para saber
    // de antemano si existe, así que directamente probamos /usuarios/me y
    // dejamos que un 401 (sin cookie o vencida) resuelva "no hay sesión".
    try {
      setLoading(true);
      const data = await getUsuarioActual();
      setUsuario(data);
    } catch (err) {
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

  const logout = async () => {
    await logoutService();
    setUsuario(null);
  };

  const isAdmin = usuario?.rol === "admin";

  return { usuario, loading, error, login, logout, isAdmin, recargar: cargarUsuarioActual };
}

export default useAuthProvider;
