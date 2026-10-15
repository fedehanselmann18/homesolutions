import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Comparador } from "./Comparador";
import { useCategorias, useProductos, useProveedores } from "../hooks/queries";

// El comparador lee proveedores, productos y categorías de las queries
// compartidas (hooks/queries.js). Se mockean los hooks, sin QueryClientProvider,
// igual que en Dashboard.test.jsx.
vi.mock("../hooks/queries");

const PROVEEDORES = [
  { id: "p1", nombre: "Frío Sur" },
  { id: "p2", nombre: "Clima Norte" },
];

const PRODUCTOS = [
  { id: "a", proveedor_id: "p1", marca: "LG", modelo: "Multi V", tipo: "equipo", precio: 1000 },
  { id: "b", proveedor_id: "p2", marca: "lg", modelo: "multi v", tipo: "equipo", precio: 800 },
];

const mockQueries = ({ isLoading = false, error = null, proveedores, productos }) => {
  const estado = (data) => ({ isLoading, error, data: isLoading ? undefined : data });
  useProveedores.mockReturnValue(estado(proveedores));
  useProductos.mockReturnValue(estado(productos));
  useCategorias.mockReturnValue(estado([]));
};

describe("Comparador", () => {
  it("mientras carga muestra el aviso de carga", () => {
    mockQueries({ isLoading: true });
    render(<Comparador />);

    expect(screen.getByText("Cargando comparador...")).toBeInTheDocument();
  });

  it("si falla alguna query muestra el error, también si son los proveedores", () => {
    useProveedores.mockReturnValue({
      isLoading: false,
      error: new Error("caído"),
      data: undefined,
    });
    useProductos.mockReturnValue({ isLoading: false, error: null, data: PRODUCTOS });
    useCategorias.mockReturnValue({ isLoading: false, error: null, data: [] });
    render(<Comparador />);

    expect(screen.getByText("No se pudo cargar el comparador.")).toBeInTheDocument();
  });

  it("con los datos cargados agrupa el mismo producto y marca el más barato", () => {
    mockQueries({ proveedores: PROVEEDORES, productos: PRODUCTOS });
    render(<Comparador />);

    const mejor = screen.getByText("Mejor precio").closest("li");
    expect(mejor).toHaveTextContent("Clima Norte");
  });
});
