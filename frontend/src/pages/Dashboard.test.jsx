import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Dashboard } from "./Dashboard";
import { hoyISO } from "../utils/formato";
import { sumarDias } from "../utils/plazos";
import {
  useProyectos,
  useFases,
  useGastos,
  useCobros,
  useCompras,
  useUltimaCotizacion,
} from "../hooks/queries";

// Dashboard usa 5 hooks de TanStack Query independientes (useProyectos,
// useFases, etc.) combinados en un único "cargando" -- calcularPanel
// necesita las 5 fuentes juntas para calcular cualquier KPI, así que no hay
// una sección que pueda resolver antes que las demás. Estos tests mockean
// los hooks directamente (sin QueryClientProvider) para verificar que el
// skeleton reemplaza al spinner viejo mientras cargando=true, y que
// desaparece por completo una vez que las 5 queries resuelven.
vi.mock("../hooks/queries");
vi.mock("../context/useAuth", () => ({
  default: () => ({ usuario: { nombre_usuario: "agustin", rol: "admin" } }),
}));

const renderDashboard = () =>
  render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );

const mockQueries = ({ isLoading, data }) => {
  const estado = { isLoading, error: null, data };
  // El precio acordado en pesos sale de la última cotización: sin ninguna
  // cargada, el panel tiene que andar igual.
  useUltimaCotizacion.mockReturnValue({ isLoading: false, error: null, data: null });
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
    expect(screen.queryByText("Hola, Agustin")).not.toBeInTheDocument();
  });

  it("cuando las 5 queries resuelven, renderiza el panel real sin bloques de skeleton", () => {
    mockQueries({
      isLoading: false,
      data: {
        proyectos: [
          { id: 1, estado: "en_curso", precio_acordado_usd: 10000, nombre: "Depto Centro" },
        ],
        fases: [],
        gastos: [],
        cobros: [],
        compras: [],
      },
    });
    const { container } = renderDashboard();

    // El título del Panel es el saludo (variante 4i).
    expect(screen.getByRole("heading", { name: "Hola, Agustin" })).toBeInTheDocument();
    expect(screen.getByText("Disponible en obras")).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton")).toHaveLength(0);
  });

  it("muestra los últimos 5 movimientos, el más reciente primero", () => {
    // 6 cobros: el Panel corta en 5 y el más nuevo va arriba.
    const cobros = [1, 2, 3, 4, 5, 6].map((n) => ({
      id: `k${n}`,
      proyecto_id: 1,
      descripcion: `Cobro ${n}`,
      fecha: `2026-08-0${n}`,
      monto_usd: 100 * n,
      monto_neto_usd: 100 * n,
      monto_ars: 0,
      monto_neto_ars: 0,
      notas: [],
      comprobantes: [{ id: 1 }],
    }));
    mockQueries({
      isLoading: false,
      data: {
        proyectos: [
          { id: 1, estado: "en_curso", precio_acordado_usd: 10000, nombre: "Depto Centro" },
        ],
        fases: [],
        gastos: [],
        cobros,
        compras: [],
      },
    });
    const { container } = renderDashboard();

    expect(screen.getByRole("heading", { name: "Últimos movimientos" })).toBeInTheDocument();
    const filas = container.querySelectorAll(".panel-movimiento");
    expect(filas).toHaveLength(5);
    expect(filas[0].textContent).toContain("Cobro 6");
    expect(filas[4].textContent).toContain("Cobro 2");
  });

  it("Próximos 30 días lista los pagos sin pagar que vencen en ese tramo, no los vencidos ni los lejanos", () => {
    const hoy = hoyISO();
    const plazo = (id, dias, pagado = false) => ({
      id,
      numero: 1,
      fecha_vencimiento: sumarDias(hoy, dias),
      monto: 1000,
      pagado,
    });
    const gasto = (id, descripcion, plazos) => ({
      id,
      proyecto_id: 1,
      descripcion,
      fecha: hoy,
      monto_ars: 1000,
      monto_usd: 1,
      cotizacion_dolar: 1000,
      plazos,
      comprobantes: [{ id: 1 }],
    });
    mockQueries({
      isLoading: false,
      data: {
        proyectos: [
          { id: 1, estado: "en_curso", precio_acordado_usd: 10000, nombre: "Depto Centro" },
        ],
        fases: [],
        cobros: [],
        compras: [],
        gastos: [
          gasto("g1", "Flete en 10 días", [plazo("p1", 10)]),
          gasto("g2", "Flete en 45 días", [plazo("p2", 45)]),
          gasto("g3", "Flete vencido", [plazo("p3", -5)]),
          gasto("g4", "Flete pagado", [plazo("p4", 3, true)]),
        ],
      },
    });
    const { container } = renderDashboard();

    expect(screen.getByRole("heading", { name: "Próximos 30 días" })).toBeInTheDocument();
    const filas = container.querySelectorAll(".panel-proximos .panel-pendiente");
    expect(filas).toHaveLength(1);
    expect(filas[0]).toHaveTextContent("Flete en 10 días");
    expect(filas[0]).toHaveTextContent("En 10 días");
  });

  it("el Panel ya no tiene el gráfico de 6 meses y lleva a Métricas", () => {
    mockQueries({
      isLoading: false,
      data: {
        proyectos: [{ id: 1, estado: "en_curso", precio_acordado_usd: 1, nombre: "Obra" }],
        fases: [],
        gastos: [],
        cobros: [],
        compras: [],
      },
    });
    renderDashboard();

    expect(screen.queryByText("Últimos 6 meses")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver métricas/i })).toHaveAttribute(
      "href",
      "/metricas"
    );
  });
});
