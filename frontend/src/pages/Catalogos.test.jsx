// Pantalla de catálogos: el rol lectura ve las listas sin ningún control de
// escritura, y un borrado que el backend rechaza (registro en uso) muestra el
// motivo real, no un mensaje genérico.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Catalogos } from "./Catalogos";
import { useCategorias, useCategoriasGasto, useCotizaciones, useImpuestos } from "../hooks/queries";
import { eliminarImpuesto } from "../services/impuestosService";
import { crearCotizacion } from "../services/cotizacionService";

let rolActual = "admin";
const toastError = vi.fn();

vi.mock("../hooks/queries");
vi.mock("../services/impuestosService");
vi.mock("../services/categoriaGastoService");
vi.mock("../services/categoriaService");
vi.mock("../services/cotizacionService");
vi.mock("../context/useAuth", () => ({
  default: () => ({ usuario: { rol: rolActual } }),
  useAuth: () => ({ usuario: { rol: rolActual } }),
}));
vi.mock("../context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: toastError }),
}));

const ok = (data) => ({ data, isLoading: false, isError: false });

const renderCatalogos = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Catalogos />
    </QueryClientProvider>
  );

beforeEach(() => {
  vi.clearAllMocks();
  rolActual = "admin";
  useImpuestos.mockReturnValue(ok([{ id: "i1", nombre: "IVA 21%" }]));
  useCategoriasGasto.mockReturnValue(ok([{ id: "g1", nombre: "Flete" }]));
  useCategorias.mockReturnValue(ok([{ id: "c1", nombre: "Cables", tipo: "materiales" }]));
  useCotizaciones.mockReturnValue(
    ok([{ id: "q1", fecha: "2026-10-01", tipo: "blue", valor: 1450 }])
  );
});

describe("Catalogos", () => {
  it("un admin ve el alta y las acciones de cada fila", () => {
    renderCatalogos();

    expect(screen.getByRole("button", { name: /nuevo impuesto/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar IVA 21%" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar IVA 21%" })).toBeInTheDocument();
  });

  it("el rol lectura ve las tres listas pero ningún control de escritura", async () => {
    rolActual = "lectura";
    renderCatalogos();

    for (const [tab, nombre] of [
      ["Impuestos", "IVA 21%"],
      ["Categorías de gasto", "Flete"],
      ["Categorías de producto", "Cables"],
    ]) {
      await userEvent.click(screen.getByRole("tab", { name: tab }));
      expect(screen.getByText(nombre)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /nuev[oa]|editar|eliminar/i })).toBeNull();
    }
  });

  it("muestra el tipo de la categoría de producto como badge", async () => {
    renderCatalogos();
    await userEvent.click(screen.getByRole("tab", { name: "Categorías de producto" }));

    expect(screen.getByText("Materiales")).toHaveClass("badge");
  });

  it("un borrado rechazado con 400 muestra el motivo real del backend", async () => {
    const detalle = "No se puede eliminar el impuesto porque fue aplicado en una o más compras";
    eliminarImpuesto.mockRejectedValue({ response: { status: 400, data: { detail: detalle } } });
    renderCatalogos();

    await userEvent.click(screen.getByRole("button", { name: "Eliminar IVA 21%" }));
    const dialogo = screen.getByRole("dialog");
    await userEvent.click(within(dialogo).getByRole("button", { name: "Eliminar" }));

    expect(eliminarImpuesto).toHaveBeenCalledWith("i1");
    expect(toastError).toHaveBeenCalledWith(detalle);
  });

  it("separa el error de carga del estado vacío", async () => {
    useImpuestos.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    useCategoriasGasto.mockReturnValue(ok([]));
    renderCatalogos();

    expect(screen.getByRole("alert")).toHaveTextContent("No se pudieron cargar los impuestos.");

    await userEvent.click(screen.getByRole("tab", { name: "Categorías de gasto" }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Todavía no hay categorías de gasto cargadas.")).toBeInTheDocument();
  });

  describe("pestaña Cotizaciones", () => {
    it("lista el dólar de cada día con su tipo y su valor con centavos", async () => {
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: "Cotizaciones" }));

      expect(screen.getByText("01/10/2026")).toBeInTheDocument();
      expect(screen.getByText("Blue")).toBeInTheDocument();
      expect(
        screen.getByText((_, e) => e?.textContent.replace(/\u00a0/g, " ") === "$ 1.450,00")
      ).toBeInTheDocument();
    });

    it("el alta manda fecha, tipo y valor numérico", async () => {
      crearCotizacion.mockResolvedValue({});
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: "Cotizaciones" }));
      await userEvent.click(screen.getByRole("button", { name: /nueva cotización/i }));

      const dialogo = screen.getByRole("dialog");
      await userEvent.type(within(dialogo).getByRole("spinbutton"), "1487.5");
      await userEvent.selectOptions(within(dialogo).getByRole("combobox"), "oficial");
      await userEvent.click(within(dialogo).getByRole("button", { name: "Crear" }));

      expect(crearCotizacion).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "oficial", valor: 1487.5 })
      );
    });

    it("el rol lectura ve las cotizaciones sin controles de escritura", async () => {
      rolActual = "lectura";
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: "Cotizaciones" }));

      expect(screen.getByText("01/10/2026")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /nueva|editar|eliminar/i })).toBeNull();
    });
  });
});
