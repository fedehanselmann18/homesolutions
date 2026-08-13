import { Suspense, lazy } from "react";
import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { MainLayout } from "../layouts/MainLayout";
import { Login } from "../pages/Login";
import { Registro } from "../pages/Registro";
import { NoAutorizado } from "../pages/NoAutorizado";
import { Cargando } from "../components/shared/Cargando";

// Comparador (varios gráficos) y Dashboard (Recharts) son las páginas más
// pesadas del bundle: van primero en la lista de lazy imports.
const Comparador = lazy(() => import("../pages/Comparador"));
const Dashboard = lazy(() => import("../pages/Dashboard").then((m) => ({ default: m.Dashboard })));
const Proyectos = lazy(() => import("../pages/Proyectos").then((m) => ({ default: m.Proyectos })));
const ProyectoDetalle = lazy(() => import("../pages/ProyectoDetalle"));
const FaseDetalle = lazy(() => import("../pages/FaseDetalle"));
const Proveedores = lazy(() => import("../pages/Proveedores"));
const ProveedorDetalle = lazy(() => import("../pages/ProveedorDetalle"));

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
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
