// Pantalla de catálogos: el rol lectura ve las listas sin ningún control de
// escritura, y un borrado que el backend rechaza (registro en uso) muestra el
// motivo real, no un mensaje genérico.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { Catalogos } from "./Catalogos";
import {
  useCategorias,
  useCategoriasGasto,
  useCotizaciones,
  useFasesPredeterminadas,
  useImpuestos,
  useTiposFactura,
  useCondicionesPago,
} from "../hooks/queries";
import { crearImpuesto, eliminarImpuesto } from "../services/impuestosService";
import { crearCondicionPago } from "../services/condicionPagoService";
import { crearCotizacion } from "../services/cotizacionService";
import { CONDICIONES_PAGO_PRUEBA, TIPOS_FACTURA_PRUEBA } from "../test/tiposFactura";

let rolActual = "admin";
const toastError = vi.fn();

vi.mock("../hooks/queries");
vi.mock("../services/impuestosService");
vi.mock("../services/categoriaGastoService");
vi.mock("../services/categoriaService");
vi.mock("../services/cotizacionService");
vi.mock("../services/fasePredeterminadaService");
vi.mock("../services/tipoFacturaService");
vi.mock("../services/condicionPagoService");
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
  useTiposFactura.mockReturnValue(ok(TIPOS_FACTURA_PRUEBA));
  useCondicionesPago.mockReturnValue(ok(CONDICIONES_PAGO_PRUEBA));
  useFasesPredeterminadas.mockReturnValue(
    ok([
      { id: "f1", orden: 1, nombre: "Relevamiento y anteproyecto" },
      { id: "f2", orden: 2, nombre: "Ingeniería de detalle" },
      { id: "f3", orden: 3, nombre: "Calefacción" },
    ])
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
      await userEvent.click(screen.getByRole("tab", { name: new RegExp(`^${tab}`) }));
      expect(screen.getByText(nombre)).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /nuev[oa]|editar|eliminar/i })).toBeNull();
    }
  });

  it("muestra el tipo de la categoría de producto, como dato y no como estado", async () => {
    renderCatalogos();
    await userEvent.click(screen.getByRole("tab", { name: /^Categorías de producto/ }));

    expect(screen.getByText("Materiales")).toHaveClass("seccion-catalogo__tipo");
  });

  it("cada pestaña cuenta lo que tiene", () => {
    renderCatalogos();
    expect(screen.getByRole("tab", { name: "Impuestos 1" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Cotizaciones 1" })).toBeInTheDocument();
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

    await userEvent.click(screen.getByRole("tab", { name: /^Categorías de gasto/ }));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText("Todavía no hay categorías de gasto cargadas.")).toBeInTheDocument();
  });

  describe("pestaña Cotizaciones", () => {
    it("lista el dólar de cada día con su tipo y su valor con centavos", async () => {
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: /^Cotizaciones/ }));

      expect(screen.getByText("01/10/2026")).toBeInTheDocument();
      expect(screen.getByText("Blue")).toBeInTheDocument();
      expect(
        screen.getByText((_, e) => e?.textContent.replace(/\u00a0/g, " ") === "$ 1.450,00")
      ).toBeInTheDocument();
    });

    it("el alta manda fecha, tipo y valor numérico", async () => {
      crearCotizacion.mockResolvedValue({});
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: /^Cotizaciones/ }));
      await userEvent.click(screen.getByRole("button", { name: /nueva cotización/i }));

      const dialogo = screen.getByRole("dialog");
      await userEvent.type(within(dialogo).getByRole("spinbutton"), "1487.5");
      // El tipo de dólar es un control de opción (DESIGN.md §9), no un select.
      await userEvent.click(within(dialogo).getByRole("radio", { name: "Oficial" }));
      await userEvent.click(within(dialogo).getByRole("button", { name: "Crear cotización" }));

      expect(crearCotizacion).toHaveBeenCalledWith(
        expect.objectContaining({ tipo: "oficial", valor: 1487.5 })
      );
    });

    it("el rol lectura ve las cotizaciones sin controles de escritura", async () => {
      rolActual = "lectura";
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: /^Cotizaciones/ }));

      expect(screen.getByText("01/10/2026")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /nueva|editar|eliminar/i })).toBeNull();
    });
  });

  it("las fases predeterminadas salen en el orden de la obra, no alfabético", async () => {
    renderCatalogos();
    await userEvent.click(screen.getByRole("tab", { name: /^Fases predeterminadas/ }));

    const nombres = screen
      .getAllByText(/Relevamiento|Ingeniería|Calefacción/)
      .map((el) => el.textContent);
    expect(nombres).toEqual([
      "Relevamiento y anteproyecto",
      "Ingeniería de detalle",
      "Calefacción",
    ]);
    expect(screen.getByRole("button", { name: /nueva fase/i })).toBeInTheDocument();
  });

  describe("pestaña Tipos de factura", () => {
    it("salen en el orden del select, con «Otros» al final", async () => {
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: /^Tipos de factura/ }));

      const nombres = screen
        .getAllByText(/^(Factura|Remito|Recibo|Otros)/)
        .map((el) => el.textContent);
      expect(nombres).toEqual([
        "Factura A",
        "Factura B",
        "Factura C",
        "Remito",
        "Recibo",
        "Factura interna",
        "Otros",
      ]);
      expect(screen.getByRole("tab", { name: "Tipos de factura 7" })).toBeInTheDocument();
    });

    it("«Otros» se puede editar pero no muestra el botón de borrar", async () => {
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: /^Tipos de factura/ }));

      expect(screen.getByRole("button", { name: "Editar Otros" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Eliminar Otros" })).toBeNull();
      expect(screen.getByRole("button", { name: "Eliminar Remito" })).toBeInTheDocument();
    });

    it("el rol lectura ve los tipos sin controles de escritura", async () => {
      rolActual = "lectura";
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: /^Tipos de factura/ }));

      expect(screen.getByText("Factura interna")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /nuevo|editar|eliminar/i })).toBeNull();
    });
  });

  describe("pestaña Impuestos", () => {
    it("muestra la alícuota y el grupo al lado del nombre", () => {
      useImpuestos.mockReturnValue(
        ok([{ id: "i2", nombre: "IVA 10,5", alicuota: 10.5, grupo: "IVA" }])
      );
      renderCatalogos();

      expect(screen.getByText("10,5 % · IVA")).toBeInTheDocument();
    });

    it("el alta manda alícuota y grupo; vacíos van como null", async () => {
      crearImpuesto.mockResolvedValue({});
      renderCatalogos();
      await userEvent.click(screen.getByRole("button", { name: /nuevo impuesto/i }));
      const dialogo = screen.getByRole("dialog");

      await userEvent.type(within(dialogo).getByRole("textbox", { name: /nombre/i }), "IVA 21");
      await userEvent.type(within(dialogo).getByLabelText("Alícuota"), "21");
      await userEvent.type(within(dialogo).getByLabelText("Grupo"), "IVA");
      await userEvent.click(within(dialogo).getByRole("button", { name: "Crear" }));

      expect(crearImpuesto).toHaveBeenCalledWith({ nombre: "IVA 21", alicuota: 21, grupo: "IVA" });
    });

    it("sin alícuota se guarda como percepción a mano", async () => {
      crearImpuesto.mockResolvedValue({});
      renderCatalogos();
      await userEvent.click(screen.getByRole("button", { name: /nuevo impuesto/i }));
      const dialogo = screen.getByRole("dialog");

      await userEvent.type(
        within(dialogo).getByRole("textbox", { name: /nombre/i }),
        "Percepción IIBB"
      );
      await userEvent.click(within(dialogo).getByRole("button", { name: "Crear" }));

      expect(crearImpuesto).toHaveBeenCalledWith({
        nombre: "Percepción IIBB",
        alicuota: null,
        grupo: null,
      });
    });
  });

  describe("pestaña Condiciones de pago", () => {
    it("lista las condiciones con sus días y Contado sin botón de borrar", async () => {
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: /^Condiciones de pago/ }));

      expect(screen.getByText("Un pago, el día de la factura")).toBeInTheDocument();
      expect(screen.getByText("A 30 y 60 días")).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Eliminar Contado" })).toBeNull();
      expect(screen.getByRole("button", { name: "Eliminar 30 días" })).toBeInTheDocument();
    });

    it("al escribir los días el nombre se arma solo y se mandan ordenados", async () => {
      crearCondicionPago.mockResolvedValue({});
      renderCatalogos();
      await userEvent.click(screen.getByRole("tab", { name: /^Condiciones de pago/ }));
      await userEvent.click(screen.getByRole("button", { name: /nueva condición/i }));
      const dialogo = screen.getByRole("dialog");

      await userEvent.type(within(dialogo).getByLabelText("Días de cada pago"), "90/45");
      await userEvent.click(within(dialogo).getByRole("button", { name: "Crear" }));

      expect(crearCondicionPago).toHaveBeenCalledWith({ nombre: "45/90 días", dias: [45, 90] });
    });
  });
});
