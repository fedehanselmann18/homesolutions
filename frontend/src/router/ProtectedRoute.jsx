import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";

// Envuelve las rutas internas. Mientras useAuth resuelve si hay sesión
// (loading), no renderiza nada para evitar un parpadeo hacia /no-autorizado
// antes de confirmar el token.
export function ProtectedRoute() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return null; // o un spinner de carga si preferís
  }

  if (!usuario) {
    return <Navigate to="/no-autorizado" replace />;
  }

  return <Outlet />;
}