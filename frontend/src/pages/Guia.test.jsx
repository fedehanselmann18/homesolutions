// La guía es sólo para admin, en dos capas: el link del sidebar no se dibuja
// y ProtectedRoute saca de /guia a quien escribe la URL a mano.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

import Guia from "./Guia";
import { Sidebar } from "../components/Sidebar";
import { ProtectedRoute } from "../router/ProtectedRoute";
import { SECCIONES_GUIA } from "../constants/guia";
import useAuth from "../context/useAuth";

vi.mock("../context/useAuth", () => {
  const useAuth = vi.fn();
  return { useAuth, default: useAuth };
});
// El sidebar monta las queries de las obras: acá sólo importa el nav.
vi.mock("../hooks/queries", () => {
  const vacia = () => ({ data: [], isLoading: false });
  return {
    useProyectos: vacia,
    useProveedores: vacia,
    useFases: vacia,
    useGastos: vacia,
    useCobros: vacia,
    useCompras: vacia,
  };
});

const como = (rol) =>
  useAuth.mockReturnValue({
    usuario: { nombre_usuario: "Alguien", rol },
    loading: false,
    isAdmin: rol === "admin",
    logout: vi.fn(),
  });

beforeEach(() => {
  useAuth.mockReset();
});

describe("Guia", () => {
  it("lista los títulos de sus secciones en el nav", () => {
    como("admin");
    render(
      <MemoryRouter>
        <Guia />
      </MemoryRouter>
    );

    const nav = screen.getByRole("navigation", { name: /secciones de la guía/i });
    for (const { titulo } of SECCIONES_GUIA) {
      expect(nav).toHaveTextContent(titulo);
    }
    expect(SECCIONES_GUIA.map((s) => s.id)).toEqual([
      "primeros-pasos",
      "proyectos",
      "moneda",
      "gastos-compras-cobros",
      "notas",
      "libro-obra",
    ]);
  });

  it("muestra la sección elegida en el panel", async () => {
    como("admin");
    render(
      <MemoryRouter>
        <Guia />
      </MemoryRouter>
    );

    expect(screen.getByRole("heading", { level: 2, name: "Primeros pasos" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dólares y pesos" }));
    expect(screen.getByRole("heading", { level: 2, name: "Dólares y pesos" })).toBeInTheDocument();
  });
});

describe("acceso a la guía", () => {
  it("un admin ve el link en el sidebar", () => {
    como("admin");
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByRole("link", { name: "Guía" })).toHaveAttribute("href", "/guia");
  });

  it("un usuario con rol lectura no ve el link en el sidebar", () => {
    como("lectura");
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.queryByRole("link", { name: "Guía" })).not.toBeInTheDocument();
    // Y el resto del nav sigue ahí.
    expect(screen.getByRole("link", { name: "Comparador" })).toBeInTheDocument();
  });

  const rutas = (
    <Routes>
      <Route element={<ProtectedRoute />}>
        <Route path="/guia" element={<p>Contenido de la guía</p>} />
      </Route>
      <Route path="/no-autorizado" element={<p>Acceso restringido</p>} />
    </Routes>
  );

  it("un usuario con rol lectura que entra a /guia termina en /no-autorizado", () => {
    como("lectura");
    render(<MemoryRouter initialEntries={["/guia"]}>{rutas}</MemoryRouter>);

    expect(screen.getByText("Acceso restringido")).toBeInTheDocument();
    expect(screen.queryByText("Contenido de la guía")).not.toBeInTheDocument();
  });

  it("un admin que entra a /guia se queda en /guia", () => {
    como("admin");
    render(<MemoryRouter initialEntries={["/guia"]}>{rutas}</MemoryRouter>);

    expect(screen.getByText("Contenido de la guía")).toBeInTheDocument();
  });
});
