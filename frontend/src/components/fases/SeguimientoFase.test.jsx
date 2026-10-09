import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

vi.mock("../../context/useToast", () => ({ useToast: () => ({ error: vi.fn() }) }));

import SeguimientoFase from "./SeguimientoFase";

const haceDias = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

const compraImpaga = {
  id: "c1",
  descripcion: "Caños de cobre",
  proveedor_id: 1,
  fecha: haceDias(10),
  estado_pago: "pendiente",
  estado_envio: "entregado",
  precio_total_ars: 146000,
  precio_total_usd: 100,
  cotizacion_dolar: 1460,
  comprobantes: [{ id: 1 }],
  // A 30 días: todavía no venció, así que va a Pendiente (no a Vencido).
  plazos: [{ id: 1, numero: 1, fecha_vencimiento: haceDias(-20), monto: 146000, pagado: false }],
};
const gastoSinComprobante = {
  id: "g1",
  descripcion: "Peajes",
  fecha: haceDias(3),
  monto_ars: 28000,
  monto_usd: 21,
  comprobantes: [],
};

const renderizar = (props = {}) =>
  render(
    <SeguimientoFase
      faseNombre="Montaje"
      comprasFase={[compraImpaga]}
      gastosFase={[gastoSinComprobante]}
      productos={[]}
      proveedores={[{ id: 1, nombre: "CobreSur" }]}
      canManage
      {...props}
    />
  );

describe("SeguimientoFase", () => {
  it("muestra las tres cifras y la bandeja por urgencia, acotada a la fase", () => {
    renderizar();
    const kpis = document.querySelector(".seguimiento-kpis");
    expect(kpis).toHaveTextContent("Por pagar en la fase");
    expect(kpis).toHaveTextContent("Sin comprobante1");

    const pendiente = screen.getByRole("region", { name: "Pendiente" });
    expect(within(pendiente).getByText("Caños de cobre")).toBeInTheDocument();
    const revisar = screen.getByRole("region", { name: "Para revisar" });
    expect(within(revisar).getByText("Peajes")).toBeInTheDocument();
    // Una fase no cobra: no aparece el saldo del contrato.
    expect(screen.queryByText("Saldo del contrato")).not.toBeInTheDocument();
  });

  it("Registrar pago resuelve la compra desde la bandeja", () => {
    const onTogglePagoCompra = vi.fn().mockResolvedValue();
    renderizar({ onTogglePagoCompra });
    fireEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
    expect(onTogglePagoCompra).toHaveBeenCalledWith(compraImpaga);
  });

  it("sin permisos no muestra las acciones", () => {
    renderizar({ canManage: false });
    expect(screen.queryByRole("button", { name: "Registrar pago" })).not.toBeInTheDocument();
  });

  it("sin pendientes lo dice", () => {
    renderizar({ comprasFase: [], gastosFase: [] });
    expect(screen.getByText("No hay nada pendiente en esta fase.")).toBeInTheDocument();
  });
});
