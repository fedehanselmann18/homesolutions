import { describe, it, expect } from "vitest";
import { barrasDeContrato, saldoDeObra } from "./saldoObra";

const compras = [
  { fecha: "2026-06-10", precio_total_ars: 1460000, precio_total_usd: 1000 },
  { fecha: "2025-01-05", precio_total_ars: 100000, precio_total_usd: 100 },
];
const gastos = [{ fecha: "2026-10-02", monto_ars: 146000, monto_usd: 100 }];
const cobros = [
  { fecha: "2026-09-15", monto_neto_ars: 4380000, monto_neto_usd: 3000 },
  { fecha: "2026-10-01", monto_neto_ars: 1460000, monto_neto_usd: 1000 },
];
const movimientos = { compras, gastos, cobros };

describe("saldoDeObra", () => {
  it("resta compras y gastos a lo cobrado, de toda la obra", () => {
    expect(saldoDeObra(movimientos, "usd")).toBe(4000 - 1100 - 100);
    expect(saldoDeObra(movimientos, "ars")).toBe(5840000 - 1560000 - 146000);
  });
});

describe("barrasDeContrato", () => {
  it("cobrado y gastado de toda la obra contra el precio acordado, en dólares", () => {
    const b = barrasDeContrato(movimientos, 8000);
    expect(b).toMatchObject({ acordado: 8000, cobrado: 4000, gastado: 1200, escala: 8000 });
    expect(b.pctCobrado).toBe(50);
    expect(b.pctGastado).toBe(15);
    expect(b.faltaCobrar).toBe(4000);
    expect(b.gastoPasado).toBe(false);
  });

  it("separa lo que está sin pagar a proveedores, dentro de lo gastado", () => {
    const conDeuda = {
      ...movimientos,
      compras: [...compras, { estado_pago: "pendiente", precio_total_usd: 300 }],
    };
    expect(barrasDeContrato(conDeuda, 8000)).toMatchObject({ gastado: 1500, sinPagar: 300 });
  });

  it("si lo gastado pasa el contrato, la escala es lo gastado", () => {
    const b = barrasDeContrato(movimientos, 1000);
    expect(b).toMatchObject({ escala: 4000, gastoPasado: true });
  });

  it("centavos de redondeo no quedan como falta cobrar", () => {
    expect(barrasDeContrato(movimientos, 4000.33).faltaCobrar).toBe(0);
  });

  it("sin precio acordado no hay porcentajes ni falta cobrar", () => {
    const b = barrasDeContrato(movimientos, null);
    expect(b).toMatchObject({ pctCobrado: null, pctGastado: null, faltaCobrar: 0, escala: 4000 });
  });
});
