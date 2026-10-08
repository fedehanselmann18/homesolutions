import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/useAuth.js";
import { RUTA_MANAGER_EQUIPO, esManager, esRutaManager } from "../constants/manager.js";

const RUTAS_SOLO_ADMIN = ["/guia"];

// Envuelve las rutas internas. Mientras useAuth resuelve si hay sesión
// (loading), no renderiza nada para evitar un parpadeo hacia /login antes
// de confirmar el token.
export function ProtectedRoute() {
  const { usuario, loading, isAdmin } = useAuth();
  const { pathname } = useLocation();

  if (loading) {
    return null; // o un spinner de carga si preferís
  }

  // "/no-autorizado" no se usa acá: no hay forma de distinguir "no hay
  // sesión" de "estás forzando la URL" (ambos casos son el mismo !usuario),
  // así que no tiene sentido mostrar un cartel de "acceso restringido" para
  // el caso normal de sesión vencida o recién cerrada -- eso va directo al
  // login.
  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // Encierro bidireccional de la cuenta "Manager" (ver constants/manager.js):
  // solo existe para el subárbol de gestión de cuentas (equipo/autorizados/
  // auditoría), así que no entra a ninguna otra página aunque escriba la URL
  // a mano -- y al revés, ese subárbol no es para el resto del equipo.
  const enSubarbolManager = esRutaManager(pathname);

  if (esManager(usuario) && !enSubarbolManager) {
    return <Navigate to={RUTA_MANAGER_EQUIPO} replace />;
  }

  if (!esManager(usuario) && enSubarbolManager) {
    return <Navigate to="/" replace />;
  }

  // Páginas sólo para admin (hoy la guía). Acá sí se distingue "estás
  // forzando la URL" de "no hay sesión": ya hay usuario, así que /no-autorizado
  // dice la verdad. El link del sidebar tampoco se dibuja para otros roles,
  // pero esto es lo que frena a quien escribe la dirección a mano.
  if (RUTAS_SOLO_ADMIN.includes(pathname) && !isAdmin) {
    return <Navigate to="/no-autorizado" replace />;
  }

  return <Outlet />;
}
