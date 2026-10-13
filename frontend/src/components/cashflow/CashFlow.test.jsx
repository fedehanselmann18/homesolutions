// Pantalla de cash flow: KPIs, las dos vistas y los vencimientos. Los
// números los cubre utils/cashflow.test.js; acá, que se vean.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { CashFlow } from "./CashFlow";
import { hoyISO } from "../../utils/formato";
import { sumarDias } from "../../utils/plazos";

// recharts necesita medir el contenedor: en jsdom no hay layout.
vi.mock("recharts", async (original) => {
  const real = await original();
  return { ...real, ResponsiveContainer: ({ children }) => <div>{children}</div> };
});

const hoy = hoyISO();
const compra = {
  id: "c1",
  fase_id: "f1",
  proveedor_id: "p1",
  descripcion: "Equipos VRF",
  fecha: sumarDias(hoy, -40),
  cotizacion_dolar: 1000,
  precio_total_ars: 1000000,
  condicion_pago: { nombre: "30/60 días" },
  plazos: [
    { id: "a", numero: 1, fecha_vencimiento: sumarDias(hoy, -10), monto: 500000, pagado: false },
    { id: "b", numero: 2, fecha_vencimiento: sumarDias(hoy, 20), monto: 500000, pagado: false },
  ],
};

const props = {
  compras: [compra],
  proyectos: [{ id: "o1", nombre: "Terravista", precio_acordado_usd: 5000 }],
  proveedores: [{ id: "p1", nombre: "Frío Sur" }],
  fases: [{ id: "f1", proyecto_id: "o1" }],
};

describe("CashFlow", () => {
  it("muestra los KPIs: vencido, a pagar en 30 días y lo que falta cobrar", () => {
    render(<CashFlow {...props} />);

    expect(screen.getByText("Vencido sin pagar")).toBeInTheDocument();
    expect(screen.getByText("1 plazo vencido")).toBeInTheDocument();
    expect(screen.getByText("A pagar en 30 días")).toBeInTheDocument();
    expect(screen.getByText("Falta cobrar")).toBeInTheDocument();
  });

  it("lista los vencimientos con el proveedor, la obra y el plazo", () => {
    render(<CashFlow {...props} />);

    expect(screen.getAllByText("Frío Sur · Equipos VRF")).toHaveLength(2);
    expect(screen.getByText("Terravista · Compra · 30/60 días (1/2)")).toBeInTheDocument();
    expect(screen.getByText("Vencido hace 10 días")).toBeInTheDocument();
  });

  it("en una obra no repite el nombre de la obra", () => {
    render(<CashFlow {...props} mostrarObra={false} />);
    expect(screen.getByText("Compra · 30/60 días (1/2)")).toBeInTheDocument();
  });

  it("cambia entre la vista por mes y por semana", async () => {
    render(<CashFlow {...props} />);
    expect(screen.getByText("Evolución mensual")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Por semana" }));
    expect(screen.getByText("Próximas 8 semanas")).toBeInTheDocument();
    expect(screen.queryByText("Evolución mensual")).toBeNull();
  });

  it("sin nada pendiente lo dice", () => {
    render(<CashFlow />);
    expect(screen.getByText("No hay nada pendiente de pago.")).toBeInTheDocument();
  });
});
