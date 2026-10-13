import { describe, it, expect } from "vitest";

import { calcularCashFlow } from "./cashflow";

const HOY = "2026-05-15"; // viernes

// Compra de $ 1.000.000 a 30/60 cargada el 01/04 (dólar a 1000):
// el primer plazo (01/05) se pagó el 02/05; el segundo vence el 31/05.
const compra = {
  id: "c1",
  fase_id: "f1",
  proveedor_id: "p1",
  descripcion: "Equipos VRF",
  fecha: "2026-04-01",
  cotizacion_dolar: 1000,
  precio_total_ars: 1000000,
  condicion_pago: { nombre: "30/60 días" },
  plazos: [
    {
      id: "pl1",
      numero: 1,
      fecha_vencimiento: "2026-05-01",
      monto: 500000,
      pagado: true,
      fecha_pago: "2026-05-02",
    },
    { id: "pl2", numero: 2, fecha_vencimiento: "2026-05-31", monto: 500000, pagado: false },
  ],
};

// Gasto de $ 200.000 a 30 días del 01/03, sin pagar: vencido el 31/03.
const gastoVencido = {
  id: "g1",
  proyecto_id: "obra1",
  descripcion: "Mano de obra",
  fecha: "2026-03-01",
  cotizacion_dolar: 800,
  monto_ars: 200000,
  plazos: [{ id: "pl3", numero: 1, fecha_vencimiento: "2026-03-31", monto: 200000, pagado: false }],
};

// Flete contado pagado.
const flete = {
  id: "g2",
  proyecto_id: "obra1",
  descripcion: "Flete",
  fecha: "2026-04-10",
  cotizacion_dolar: 1000,
  monto_ars: 50000,
  plazos: [
    {
      id: "pl4",
      numero: 1,
      fecha_vencimiento: "2026-04-10",
      monto: 50000,
      pagado: true,
      fecha_pago: "2026-04-10",
    },
  ],
};

const cobro = {
  id: "co1",
  proyecto_id: "obra1",
  fecha: "2026-03-20",
  monto_ars: 3000000,
  monto_usd: 3000,
  monto_neto_usd: 2900,
  notas: [{ tipo: "nota_credito", fecha: "2026-04-05", monto_ars: 100000, monto_usd: 100 }],
};

const datos = {
  compras: [compra],
  gastos: [gastoVencido, flete],
  cobros: [cobro],
  proyectos: [{ id: "obra1", nombre: "Terravista", precio_acordado_usd: 10000 }],
  proveedores: [{ id: "p1", nombre: "Frío Sur" }],
  fases: [{ id: "f1", proyecto_id: "obra1" }],
  hoy: HOY,
  mesesAtras: 3,
};

describe("calcularCashFlow", () => {
  it("KPIs: saldo real, vencido, a pagar en 30 días y falta cobrar", () => {
    const { kpis } = calcularCashFlow({ ...datos, moneda: "ars" });

    // Ingresos 3.000.000 − 100.000 (NC del cobro); egresos 500.000 + 50.000.
    expect(kpis.saldoHoy).toBe(2350000);
    expect(kpis.vencido).toBe(200000);
    expect(kpis.cantidadVencidos).toBe(1);
    expect(kpis.aPagar30).toBe(500000);
    // 10.000 acordado − 2.900 cobrado neto.
    expect(kpis.faltaCobrarUsd).toBe(7100);
  });

  it("un plazo sin pagar no cuenta como egreso", () => {
    const { porMes } = calcularCashFlow({ ...datos, moneda: "ars" });
    const mayo = porMes.find((m) => m.mes === "2026-05");

    expect(mayo.egreso).toBe(500000); // sólo el plazo pagado
    expect(mayo.aPagar).toBe(700000); // el de 31/05 + el gasto vencido (va al mes actual)
  });

  it("por mes: real para atrás, proyectado para adelante, saldo acumulado", () => {
    const { porMes } = calcularCashFlow({ ...datos, moneda: "ars" });

    expect(porMes.map((m) => m.mes)).toEqual(["2026-03", "2026-04", "2026-05"]);
    expect(porMes.map((m) => [m.ingreso, m.egreso])).toEqual([
      [3000000, 0],
      [0, 150000], // NC del cobro 100.000 + flete 50.000
      [0, 500000],
    ]);
    expect(porMes.map((m) => m.saldo)).toEqual([3000000, 2850000, 1650000]);
    expect(porMes.find((m) => m.actual).mes).toBe("2026-05");
  });

  it("en dólares cada plazo usa la cotización congelada de su movimiento", () => {
    const { kpis } = calcularCashFlow({ ...datos, moneda: "usd" });

    expect(kpis.vencido).toBe(250); // 200.000 / 800
    expect(kpis.aPagar30).toBe(500); // 500.000 / 1000
    expect(kpis.saldoHoy).toBe(3000 - 100 - 500 - 50);
  });

  it("por semana: las próximas semanas desde el lunes, sin lo vencido", () => {
    const { porSemana } = calcularCashFlow({ ...datos, moneda: "ars", semanas: 3 });

    expect(porSemana.map((s) => [s.desde, s.hasta, s.aPagar])).toEqual([
      ["2026-05-11", "2026-05-17", 0],
      ["2026-05-18", "2026-05-24", 0],
      ["2026-05-25", "2026-05-31", 500000],
    ]);
  });

  it("lista los vencimientos con proveedor, obra y número de plazo", () => {
    const { vencimientos } = calcularCashFlow({ ...datos, moneda: "ars" });

    expect(vencimientos.map((v) => [v.fecha, v.quien, v.proyecto, v.etiqueta, v.vencido])).toEqual([
      ["2026-03-31", null, "Terravista", "", true],
      ["2026-05-31", "Frío Sur", "Terravista", "2/2", false],
    ]);
    expect(vencimientos[0].diasVencido).toBe(45);
  });

  it("sin datos no explota", () => {
    const resultado = calcularCashFlow({ hoy: HOY });
    expect(resultado.kpis.saldoHoy).toBe(0);
    expect(resultado.vencimientos).toEqual([]);
    expect(resultado.porMes).toHaveLength(6);
  });
});
