import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./ProtectedRoute";
import { MainLayout } from "../layouts/MainLayout";
import { Login } from "../pages/Login";
import { Registro } from "../pages/Registro";
import { NoAutorizado } from "../pages/NoAutorizado";
import { Dashboard } from "../pages/Dashboard";
import { Proyectos } from "../pages/Proyectos";
import ProyectoDetalle from "../pages/ProyectoDetalle";
import FaseDetalle from "../pages/FaseDetalle";
import Proveedores from "../pages/Proveedores";
import ProveedorDetalle from "../pages/ProveedorDetalle";
import Comparador from "../pages/Comparador";

// Rutas internas: agregá acá cada página nueva a medida que la vayas armando
// (Proyectos, Proveedores, Productos, etc.), todas anidadas dentro de
// ProtectedRoute > MainLayout para que compartan sidebar + guardia de sesión.
export function AppRouter() {
  return (
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
          {/* <Route path="/proyectos" element={<Proyectos />} /> */}
          {/* <Route path="/proyectos/:proyectoId" element={<DetalleProyecto />} /> */}
        </Route>
      </Route>
    </Routes>
  );
}