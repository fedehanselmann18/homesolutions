import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FiltrosLista } from "./FiltrosLista";
import { FILTROS_VACIOS } from "../../utils/filtros";

// Los tipos de factura de Ajustes (los de fábrica), sin servidor.
vi.mock("../../hooks/queries", async () => {
  const { TIPOS_FACTURA_PRUEBA } = await import("../../test/tiposFactura");
  return { useTiposFactura: () => ({ isLoading: false, data: TIPOS_FACTURA_PRUEBA }) };
});

describe("FiltrosLista", () => {
  it("el panel arranca cerrado y se abre con Filtrar", async () => {
    render(<FiltrosLista filtros={FILTROS_VACIOS} onCambiar={() => {}} mostrarEstadoPago />);

    expect(screen.queryByLabelText("Pago")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /filtrar/i }));
    expect(screen.getByLabelText("Pago")).toBeInTheDocument();
  });

  it("muestra los filtros aplicados como chips que se sacan con su ×", async () => {
    const onCambiar = vi.fn();
    const filtros = { ...FILTROS_VACIOS, estadoPago: "pendiente" };
    render(<FiltrosLista filtros={filtros} onCambiar={onCambiar} mostrarEstadoPago />);

    expect(screen.getByText("Pago: A pagar")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Quitar filtro Pago: A pagar" }));
    expect(onCambiar).toHaveBeenCalledWith(FILTROS_VACIOS);
  });

  it("pinta a la izquierda lo que se le pase", () => {
    render(
      <FiltrosLista filtros={FILTROS_VACIOS} onCambiar={() => {}}>
        <span>chips de tipo</span>
      </FiltrosLista>
    );
    expect(screen.getByText("chips de tipo")).toBeInTheDocument();
  });

  it("el filtro de tipo de factura usa los tipos de Ajustes", async () => {
    render(<FiltrosLista filtros={FILTROS_VACIOS} onCambiar={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /filtrar/i }));

    const opciones = [...screen.getByLabelText("Tipo de factura").options].map(
      (o) => o.textContent
    );
    expect(opciones).toEqual([
      "Todos",
      "Factura A",
      "Factura B",
      "Factura C",
      "Remito",
      "Recibo",
      "Factura interna",
      "Otros",
    ]);
  });

  it("un filtro aplicado muestra el nombre del tipo, no el código", () => {
    render(
      <FiltrosLista
        filtros={{ ...FILTROS_VACIOS, tipoFactura: "factura_interna" }}
        onCambiar={() => {}}
      />
    );
    expect(screen.getByText("Tipo de factura: Factura interna")).toBeInTheDocument();
  });
});
