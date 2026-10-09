import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CamposPago } from "./CamposPago";

vi.mock("../../hooks/queries", async () => {
  const { CONDICIONES_PAGO_PRUEBA } = await import("../../test/tiposFactura");
  return { useCondicionesPago: () => ({ data: CONDICIONES_PAGO_PRUEBA }) };
});

const base = {
  onCambiarCondicion: vi.fn(),
  onCambiarMedio: vi.fn(),
  fecha: "2026-03-01",
  total: 1000000,
};

describe("CamposPago", () => {
  it("sin condición elegida muestra Contado y un solo pago ese día", () => {
    render(<CamposPago {...base} condicionId="" medio="" />);

    expect(screen.getByRole("radio", { name: "Contado" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Un pago de $ 1.000.000 el 01/03/2026.")).toBeInTheDocument();
  });

  it("con 30/60 muestra cómo quedan los plazos", () => {
    render(<CamposPago {...base} condicionId="cp3060" medio="" />);
    expect(screen.getByText("2 pagos de $ 500.000: 31/03/2026 y 30/04/2026.")).toBeInTheDocument();
  });

  it("el medio de pago es opcional: tocar el elegido lo saca", async () => {
    const onCambiarMedio = vi.fn();
    render(<CamposPago {...base} condicionId="" medio="cheque" onCambiarMedio={onCambiarMedio} />);

    await userEvent.click(screen.getByRole("radio", { name: "Cheque" }));
    expect(onCambiarMedio).toHaveBeenCalledWith("");
  });

  it("con plazos pagados la condición queda bloqueada y explica por qué", () => {
    render(<CamposPago {...base} condicionId="cp30" medio="" bloqueada />);

    expect(screen.getByRole("radio", { name: "30 días" })).toBeDisabled();
    expect(screen.getByText(/Ya hay plazos pagados/)).toBeInTheDocument();
  });
});
