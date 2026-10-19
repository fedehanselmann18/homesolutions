import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { SeccionPlazos } from "./SeccionPlazos";
import { marcarPlazoPago } from "../../services/plazoPagoService";

let rolActual = "admin";
const invalidar = vi.fn();
vi.mock("../../services/plazoPagoService");
vi.mock("../../hooks/queries", async () => {
  const { MEDIOS_PAGO_PRUEBA } = await import("../../test/tiposFactura");
  return { useMediosPago: () => ({ data: MEDIOS_PAGO_PRUEBA }) };
});
vi.mock("../../context/useAuth", () => ({ default: () => ({ usuario: { rol: rolActual } }) }));
vi.mock("../../context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original()),
  useQueryClient: () => ({ invalidateQueries: invalidar }),
}));

const compra = {
  cotizacion_dolar: 1000,
  medio_pago: "cheque",
  condicion_pago: { nombre: "30/60 días", dias: [30, 60] },
  plazos: [
    {
      id: "p1",
      numero: 1,
      dias: 30,
      fecha_vencimiento: "2026-03-31",
      monto: 500000,
      pagado: true,
      fecha_pago: "2026-03-30",
    },
    {
      id: "p2",
      numero: 2,
      dias: 60,
      fecha_vencimiento: "2099-04-30",
      monto: 500000,
      pagado: false,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  rolActual = "admin";
});

describe("SeccionPlazos", () => {
  it("muestra cada plazo con su vencimiento y si se pagó", () => {
    render(<SeccionPlazos movimiento={compra} />);

    expect(screen.getByText("30/60 días · a 30 y 60 días · Cheque")).toBeInTheDocument();
    expect(screen.getByText("Pagado el 30/03/2026")).toBeInTheDocument();
    expect(screen.getByText("A pagar")).toBeInTheDocument();
  });

  it("un admin marca un plazo pagado y se refrescan compras y gastos", async () => {
    marcarPlazoPago.mockResolvedValue({});
    render(<SeccionPlazos movimiento={compra} />);

    await userEvent.click(screen.getByRole("button", { name: "Marcar el plazo 2 como pagado" }));

    expect(marcarPlazoPago).toHaveBeenCalledWith("p2", { pagado: true });
    expect(invalidar).toHaveBeenCalledTimes(2);
  });

  it("el rol lectura ve los plazos sin botones", () => {
    rolActual = "lectura";
    render(<SeccionPlazos movimiento={compra} />);
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("un plazo vencido sin pagar dice hace cuántos días", () => {
    const vencida = {
      ...compra,
      plazos: [{ ...compra.plazos[1], fecha_vencimiento: "2020-01-01" }],
    };
    render(<SeccionPlazos movimiento={vencida} />);
    expect(screen.getByText(/^Vencido hace \d+ días$/)).toBeInTheDocument();
  });
});
