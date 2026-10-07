import { describe, it, expect } from "vitest";
import { resumirSaldoObra, saldoDeObra, topeDeEje } from "./saldoObra";

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
const hoy = new Date(2026, 9, 7);

describe("saldoDeObra", () => {
  it("resta compras y gastos a lo cobrado, de toda la obra", () => {
    expect(saldoDeObra(movimientos, "usd")).toBe(4000 - 1100 - 100);
    expect(saldoDeObra(movimientos, "ars")).toBe(5840000 - 1560000 - 146000);
  });
});

describe("resumirSaldoObra", () => {
  it("arma un mes por barra hasta el actual, con los meses vacíos en cero", () => {
    const { meses } = resumirSaldoObra(movimientos, { meses: 5, hoy });
    expect(meses.map((m) => m.mes)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    expect(meses[0]).toMatchObject({ cobrado: 0, gastado: 1000, gastadoArs: 1460000 });
    expect(meses[1]).toMatchObject({ cobrado: 0, gastado: 0 });
    expect(meses[4]).toMatchObject({ cobrado: 1000, gastado: 100, gastadoArs: 146000 });
  });

  it("los totales del período dejan afuera lo anterior, el saldo no", () => {
    const resumen = resumirSaldoObra(movimientos, { meses: 3, hoy });
    expect(resumen.cobradoUsd).toBe(4000);
    expect(resumen.gastadoUsd).toBe(100);
    expect(resumen.gastadoArs).toBe(146000);
    expect(resumen.saldo.usd).toBe(2800);
  });
});

describe("topeDeEje", () => {
  it("redondea para dos divisiones parejas", () => {
    expect(topeDeEje(7300)).toBe(8000);
    expect(topeDeEje(4000)).toBe(4000);
    expect(topeDeEje(950)).toBe(1000);
    expect(topeDeEje(23000)).toBe(30000);
  });

  it("sin datos devuelve un tope mínimo", () => {
    expect(topeDeEje(0)).toBe(1000);
  });
});
