import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Fases } from "./Fases";
import {
  useProyecto,
  useFasesPorProyecto,
  useFasesPredeterminadas,
  useGastosPorProyecto,
  useComprasPorProyecto,
} from "../../hooks/queries";

vi.mock("../../hooks/queries");
vi.mock("../../services/faseService");
vi.mock("../../context/useToast", () => ({ useToast: () => ({ error: vi.fn() }) }));
const auth = vi.hoisted(() => ({ rol: "admin" }));
vi.mock("../../context/useAuth", () => ({
  default: () => ({ usuario: { nombre_usuario: "agustin", rol: auth.rol } }),
}));

const FASES = [
  { id: 1, orden: 1, nombre: "Ingeniería", descripcion: "Cálculo de cargas", estado: "auditada" },
  { id: 2, orden: 2, nombre: "Montaje", descripcion: "Pisos 1 a 4", estado: "en_curso" },
  { id: 3, orden: 3, nombre: "Puesta en marcha", descripcion: null, estado: "por_empezar" },
];

const ok = (data) => ({ isLoading: false, error: null, data });

const renderFases = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <Fases proyectoId={7} />
      </MemoryRouter>
    </QueryClientProvider>
  );

beforeEach(() => {
  auth.rol = "admin";
  useProyecto.mockReturnValue(ok({ id: 7, precio_acordado_usd: 10000, precio_acordado_ars: 0 }));
  useFasesPorProyecto.mockReturnValue(ok(FASES));
  useFasesPredeterminadas.mockReturnValue(ok([{ id: 1, orden: 1, nombre: "Calefacción" }]));
  useGastosPorProyecto.mockReturnValue(
    ok([
      { id: 1, fase_id: 1, monto_usd: 500, monto_ars: 0, tipo_factura: "A" },
      { id: 2, fase_id: null, monto_usd: 100, monto_ars: 0, tipo_factura: "B" },
    ])
  );
  useComprasPorProyecto.mockReturnValue(
    ok([
      {
        id: 9,
        fase_id: 2,
        precio_neto_usd: 2000,
        precio_total_usd: 2000,
        precio_total_ars: 0,
        impuestos_aplicados: [],
        tipo_factura: "A",
      },
    ])
  );
});

describe("Fases (línea de tiempo 4b)", () => {
  it("pinta una tarjeta por fase con su badge de estado, ícono incluido", () => {
    renderFases();
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);

    const auditada = within(items[0]).getByText("Auditada");
    expect(auditada.closest(".badge").querySelector("svg")).not.toBeNull();
    expect(within(items[1]).getByText("En curso")).toBeInTheDocument();
    expect(within(items[2]).getByText("Por empezar")).toBeInTheDocument();
  });

  it("una fase cerrada se atenúa con su clase de etapa, no se tacha", () => {
    renderFases();
    const [cerrada, actual, pendiente] = screen.getAllByRole("listitem");
    expect(cerrada).toHaveClass("fases__item--cerrada");
    expect(actual).toHaveClass("fases__item--actual");
    expect(pendiente).toHaveClass("fases__item--pendiente");
    expect(document.querySelector('[class*="terminada"]')).toBeNull();
  });

  it("muestra lo gastado por fase y el presupuesto usado incluye lo que no tiene fase", () => {
    renderFases();
    const [cerrada, actual, pendiente] = screen.getAllByRole("listitem");
    expect(within(cerrada).getByText("5,0%")).toBeInTheDocument();
    expect(within(actual).getByText("20,0%")).toBeInTheDocument();
    expect(within(pendiente).getAllByText("—")).toHaveLength(2);

    // 500 + 2000 + 100 sin fase = 2600 de 10.000.
    expect(screen.getByRole("img", { name: "26,0% del presupuesto usado" })).toBeInTheDocument();
    expect(document.querySelectorAll(".fases__tramo")).toHaveLength(3);
    expect(document.querySelector(".fases__tramo--sin-fase")).not.toBeNull();
  });

  it("un admin tiene reordenar, editar y borrar en cada fase; las puntas no se mueven", () => {
    renderFases();
    expect(screen.getByRole("button", { name: /nueva fase/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Subir Ingeniería" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Bajar Puesta en marcha" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Editar Montaje" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Eliminar Montaje" })).toBeEnabled();
  });

  it("un usuario de lectura no ve acciones", () => {
    auth.rol = "lectura";
    renderFases();
    expect(screen.queryByRole("button", { name: /nueva fase/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /editar/i })).not.toBeInTheDocument();
  });
});
