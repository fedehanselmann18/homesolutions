import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";
import { Cargando } from "../components/shared/Cargando";
import { TransicionDeRuta } from "../components/shared/TransicionDeRuta";
import "./MainLayout.css";

export function MainLayout() {
  return (
    <div className="main-layout">
      <Sidebar />
      <main className="main-content">
        {/* El Suspense va ACÁ y no arriba de todo (router/AppRouter.jsx):
            las páginas se cargan con React.lazy, y con la barrera afuera la
            primera visita a cada una borraba la pantalla entera -- sidebar
            incluido -- para poner el spinner. Acotado al contenido, el marco
            de la app no se mueve y sólo cambia lo que tiene que cambiar.

            Afuera de TransicionDeRuta a propósito: así la animación de
            entrada la hace la página de verdad cuando llega, y no el
            spinner. */}
        <Suspense fallback={<Cargando texto="Cargando..." />}>
          <TransicionDeRuta>
            <Outlet />
          </TransicionDeRuta>
        </Suspense>
      </main>
    </div>
  );
}
