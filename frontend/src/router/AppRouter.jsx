import { Suspense, lazy } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { MainLayout } from "../layouts/MainLayout";
import { Login } from "../pages/Login";
import { Registro } from "../pages/Registro";
import { NoAutorizado } from "../pages/NoAutorizado";
import { Cargando } from "../components/shared/Cargando";
import { RUTA_RESETEO } from "../constants/manager";

// Comparador (varios gráficos) y Dashboard (Recharts) son las páginas más
// pesadas del bundle: van primero en la lista de lazy imports.
const Comparador = lazy(() => import("../pages/Comparador"));
const Dashboard = lazy(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Proyectos = lazy(() => import("../pages/Proyectos").then((m) => ({ default: m.Proyectos })));
const ProyectoDetalle = lazy(() => import("../pages/ProyectoDetalle"));
const FaseDetalle = lazy(() => import("../pages/FaseDetalle"));
const Proveedores = lazy(() => import("../pages/Proveedores"));
const ProveedorDetalle = lazy(() => import("../pages/ProveedorDetalle"));
// Subárbol exclusivo de la cuenta "Manager" (ver constants/manager.js): una
// página por sección en vez de una sola pantalla con todas apiladas.
const GestionEquipo = lazy(() => import("../pages/manager/GestionEquipo"));
const GestionAutorizados = lazy(() => import("../pages/manager/GestionAutorizados"));
const GestionAuditoria = lazy(() => import("../pages/manager/GestionAuditoria"));
const GestionConfiguracion = lazy(() => import("../pages/manager/GestionConfiguracion"));
const GestionArchivos = lazy(() => import("../pages/manager/GestionArchivos"));

// Rutas internas: agregá acá cada página nueva a medida que la vayas armando
// (Proyectos, Proveedores, Productos, etc.), todas anidadas dentro de
// ProtectedRoute > MainLayout para que compartan sidebar + guardia de sesión.
// Las páginas protegidas se cargan con React.lazy para no meter todo el
// bundle en el chunk inicial (login solo necesita Login + Registro).
export function AppRouter() {
  return (
    <Suspense fallback={<Cargando texto="Cargando..." />}>
      <Routes>
        {/* Rutas públicas */}
        <Route path="/login" element={<Login />} />
        <Route path="/registro" element={<Registro />} />
        <Route path="/no-autorizado" element={<NoAutorizado />} />

        {/* Rutas protegidas, con layout compartido (sidebar + contenido) */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/proyectos" element={<Proyectos />} />
            <Route path="/proyectos/:id" element={<ProyectoDetalle />} />
            <Route path="/proyectos/:proyectoId/fases/:faseId" element={<FaseDetalle />} />
            <Route path="/proveedores" element={<Proveedores />} />
            <Route path="/proveedores/:id" element={<ProveedorDetalle />} />
            <Route path="/comparador" element={<Comparador />} />
            {/* Solo la cuenta "Manager" llega a este subárbol: ProtectedRoute
                saca de acá a cualquier otro usuario (y encierra a Manager
                dentro de él). El índice redirige a "equipo" -- la URL base
                sola no tiene página propia, era el link que mostraba el
                sidebar antes de que hubiera varias. */}
            <Route path={RUTA_RESETEO}>
              <Route index element={<Navigate to="equipo" replace />} />
              <Route path="equipo" element={<GestionEquipo />} />
              <Route path="autorizados" element={<GestionAutorizados />} />
              <Route path="auditoria" element={<GestionAuditoria />} />
              <Route path="configuracion" element={<GestionConfiguracion />} />
              <Route path="archivos" element={<GestionArchivos />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
