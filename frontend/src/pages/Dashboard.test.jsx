import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "./Dashboard";
import { useProyectos, useFases, useGastos, useCobros, useCompras } from "../hooks/queries";

// Dashboard usa 5 hooks de TanStack Query independientes (useProyectos,
// useFases, etc.) combinados en un único "cargando" -- calcularPanel
// necesita las 5 fuentes juntas para calcular cualquier KPI, así que no hay
// una sección que pueda resolver antes que las demás. Estos tests mockean
// los hooks directamente (sin QueryClientProvider) para verificar que el
// skeleton reemplaza al spinner viejo mientras cargando=true, y que
// desaparece por completo una vez que las 5 queries resuelven.
vi.mock("../hooks/queries");

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

const mockQueries = ({ isLoading, data }) => {
  const estado = { isLoading, error: null, data };
  useProyectos.mockReturnValue(
    estado.data?.proyectos !== undefined ? { ...estado, data: estado.data.proyectos } : estado
  );
  useFases.mockReturnValue(
    estado.data?.fases !== undefined ? { ...estado, data: estado.data.fases } : estado
  );
  useGastos.mockReturnValue(
    estado.data?.gastos !== undefined ? { ...estado, data: estado.data.gastos } : estado
  );
  useCobros.mockReturnValue(
    estado.data?.cobros !== undefined ? { ...estado, data: estado.data.cobros } : estado
  );
  useCompras.mockReturnValue(
    estado.data?.compras !== undefined ? { ...estado, data: estado.data.compras } : estado
  );
};

describe("Dashboard", () => {
  it("mientras alguna query está en loading, muestra el skeleton en vez del spinner viejo", () => {
    mockQueries({ isLoading: true, data: undefined });
    const { container } = renderDashboard();

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText(/cargando panel/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Panel")).not.toBeInTheDocument();
  });

  it("cuando las 5 queries resuelven, renderiza el panel real sin bloques de skeleton", () => {
    mockQueries({
      isLoading: false,
      data: {
        proyectos: [{ id: 1, estado: "en_curso", precio_acordado_usd: 10000, nombre: "Depto Centro" }],
        fases: [],
        gastos: [],
        cobros: [],
        compras: [],
      },
    });
    const { container } = renderDashboard();

    expect(screen.getByText("Panel")).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton")).toHaveLength(0);
  });
});
