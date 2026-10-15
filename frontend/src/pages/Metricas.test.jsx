import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { Metricas } from "./Metricas";
import {
  useProyectos,
  useFases,
  useGastos,
  useCobros,
  useCompras,
  useProveedores,
  useUltimaCotizacion,
} from "../hooks/queries";
import { ETIQUETAS_METRICAS, NIVELES_OBRA } from "../constants/metricas";

// Estados de la página Métricas con los hooks de datos mockeados (sin
// QueryClientProvider), como el test del Panel: skeleton mientras carga,
// error si falla una query y una línea si el período no tiene movimientos.
// Los filtros quedan visibles en los tres.
vi.mock("../hooks/queries");

const renderMetricas = (url = "/metricas") =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <Metricas />
    </MemoryRouter>
  );

function mockQueries({ isLoading = false, isError = false, datos = {} }) {
  const estado = (data) => ({ isLoading, isError, error: isError ? new Error("x") : null, data });
  useProyectos.mockReturnValue(estado(datos.proyectos));
  useFases.mockReturnValue(estado(datos.fases));
  useGastos.mockReturnValue(estado(datos.gastos));
  useCobros.mockReturnValue(estado(datos.cobros));
  useCompras.mockReturnValue(estado(datos.compras));
  useProveedores.mockReturnValue(estado(datos.proveedores ?? []));
  useUltimaCotizacion.mockReturnValue({ isLoading: false, data: null });
}

// "AAAA-MM-01" de hace `meses` meses, en fecha local: así los tests no
// dependen del día en que corren.
function inicioDeMes(meses = 0) {
  const hoy = new Date();
  const d = new Date(hoy.getFullYear(), hoy.getMonth() - meses, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const cobro = (id, proyecto_id, fecha, monto) => ({
  id,
  proyecto_id,
  fecha,
  monto_neto_usd: monto,
  monto_neto_ars: monto,
});
const gasto = (id, proyecto_id, fecha, monto) => ({
  id,
  proyecto_id,
  fecha,
  monto_usd: monto,
  monto_ars: monto,
});
const obra = (id, nombre, precio = 10000) => ({
  id,
  nombre,
  estado: "en_curso",
  precio_acordado_usd: precio,
});

describe("Metricas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("mientras carga muestra el skeleton y los filtros", () => {
    mockQueries({ isLoading: true });
    const { container } = renderMetricas();

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(screen.getByRole("group", { name: ETIQUETAS_METRICAS.periodo })).toBeInTheDocument();
  });

  it("si falla una query muestra el error, no el vacío", () => {
    mockQueries({ isError: true });
    renderMetricas();

    expect(screen.getByRole("alert")).toHaveTextContent(ETIQUETAS_METRICAS.errorCarga);
    expect(screen.queryByText(ETIQUETAS_METRICAS.sinDatos)).not.toBeInTheDocument();
  });

  it("sin movimientos en el período muestra una línea de vacío", () => {
    mockQueries({ datos: { proyectos: [], fases: [], gastos: [], cobros: [], compras: [] } });
    const { container } = renderMetricas();

    expect(screen.getByText(ETIQUETAS_METRICAS.sinDatos)).toBeInTheDocument();
    expect(container.querySelectorAll(".skeleton")).toHaveLength(0);
  });

  it("con datos muestra los cuatro KPIs", () => {
    const hoy = new Date();
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
    mockQueries({
      datos: {
        proyectos: [{ id: 1, nombre: "Olleros", estado: "en_curso", precio_acordado_usd: 1000 }],
        fases: [],
        gastos: [{ id: 1, proyecto_id: 1, fecha, monto_usd: 200, monto_ars: 200 }],
        cobros: [{ id: 1, proyecto_id: 1, fecha, monto_neto_usd: 1000, monto_neto_ars: 1000 }],
        compras: [],
      },
    });
    const { container } = renderMetricas();

    const kpis = within(container.querySelector(".metricas-kpis"));
    for (const titulo of ["ingresos", "egresos", "resultado", "rentabilidad"]) {
      expect(kpis.getByText(ETIQUETAS_METRICAS[titulo])).toBeInTheDocument();
    }
    expect(kpis.getByText("80,0 %")).toBeInTheDocument();
  });

  it("el filtro de período cambia los números y queda marcado", async () => {
    const user = userEvent.setup();
    mockQueries({
      datos: {
        proyectos: [obra(1, "Olleros")],
        fases: [],
        compras: [],
        gastos: [],
        cobros: [cobro(1, 1, inicioDeMes(0), 1000), cobro(2, 1, inicioDeMes(4), 5000)],
      },
    });
    const { container } = renderMetricas();
    const ingresos = () =>
      within(container.querySelector(".metricas-kpis")).getByText(ETIQUETAS_METRICAS.ingresos)
        .nextSibling.textContent;

    // 6 meses por defecto: entran los dos cobros.
    expect(ingresos()).toMatch(/6\.000/);

    await user.click(screen.getByRole("button", { name: "Mes actual" }));
    expect(ingresos()).toMatch(/1\.000/);
    expect(screen.getByRole("button", { name: "Mes actual" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
  });

  it("el ranking va de mayor a menor rentabilidad y la tabla pone primero lo que pide atención", () => {
    const fecha = inicioDeMes(0);
    mockQueries({
      datos: {
        proyectos: [obra(1, "Olleros"), obra(2, "Terravista"), obra(3, "Martínez")],
        fases: [],
        compras: [],
        cobros: [cobro(1, 1, fecha, 1000), cobro(2, 2, fecha, 1000), cobro(3, 3, fecha, 1000)],
        gastos: [
          gasto(1, 1, fecha, 800), // 20 %
          gasto(2, 2, fecha, 500), // 50 %
          gasto(3, 3, fecha, 1500), // −50 %: resultado negativo
        ],
      },
    });
    renderMetricas();

    const ranking = screen.getByRole("region", { name: ETIQUETAS_METRICAS.rentabilidadPorObra });
    const nombres = within(ranking)
      .getAllByRole("listitem")
      .map((li) => li.querySelector(".metricas-barras__nombre").textContent);
    expect(nombres).toEqual(["Terravista", "Olleros", "Martínez"]);

    const filas = within(
      screen.getByRole("table", { name: ETIQUETAS_METRICAS.obras })
    ).getAllByRole("row");
    // filas[0] es el encabezado.
    expect(filas[1]).toHaveTextContent("Martínez");
    expect(filas[1]).toHaveTextContent(NIVELES_OBRA.problema.label);
  });
});
