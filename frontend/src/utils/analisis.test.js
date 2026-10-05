import { describe, it, expect } from "vitest";
import { calcularAnalisis } from "./analisis";

// calcularAnalisis es el corazón del reporte financiero del proyecto (lo que
// después se imprime en PDF), así que estos tests cubren los números que
// tienen que dar EXACTO: cobrado, gastos, compras, margen bruto y disponible.

describe("calcularAnalisis", () => {
  it("con todo vacío, todos los totales dan cero sin explotar", () => {
    const resultado = calcularAnalisis({ proyecto: null });
    expect(resultado.totales.cobrado).toBe(0);
    expect(resultado.totales.gastos).toBe(0);
    expect(resultado.totales.compras).toBe(0);
    expect(resultado.totales.disponible).toBe(0);
    expect(resultado.totales.margenBruto).toBe(0);
  });

  it("calcula cobrado usando monto_neto cuando está presente (ajustado por notas)", () => {
    const resultado = calcularAnalisis({
      proyecto: { precio_acordado_usd: 100000 },
      cobros: [{ monto: 10000, monto_neto: 9000 }],
    });
    expect(resultado.totales.cobrado).toBe(9000);
  });

  it("usa el monto bruto de un cobro si no tiene monto_neto calculado", () => {
    const resultado = calcularAnalisis({
      cobros: [{ monto: 5000 }],
    });
    expect(resultado.totales.cobrado).toBe(5000);
  });

  it("total de compras = precio_neto + impuestos + ajuste de notas (no solo precio_neto)", () => {
    const resultado = calcularAnalisis({
      compras: [
        {
          precio_neto: 1000,
          impuestos_aplicados: [{ monto: 210 }],
          notas: [],
        },
      ],
    });
    // 1000 (neto) + 210 (impuestos) + 0 (sin notas) = 1210
    expect(resultado.totales.compras).toBe(1210);
    expect(resultado.totales.comprasNeto).toBe(1000);
    expect(resultado.totales.impuestos).toBe(210);
  });

  it("una nota de crédito de compra (devolución) resta del total de compras", () => {
    const resultado = calcularAnalisis({
      compras: [
        {
          precio_neto: 1000,
          impuestos_aplicados: [],
          notas: [{ tipo: "nota_credito", monto: 300 }],
        },
      ],
    });
    // 1000 + 0 - 300 = 700
    expect(resultado.totales.compras).toBe(700);
    expect(resultado.totales.notasCreditoCompras).toBe(300);
  });

  it("una nota de débito de compra suma al total de compras", () => {
    const resultado = calcularAnalisis({
      compras: [
        {
          precio_neto: 1000,
          impuestos_aplicados: [],
          notas: [{ tipo: "nota_debito", monto: 150 }],
        },
      ],
    });
    expect(resultado.totales.compras).toBe(1150);
  });

  it("margen bruto no descuenta impuestos (a diferencia de 'disponible')", () => {
    const resultado = calcularAnalisis({
      cobros: [{ monto_neto: 10000 }],
      gastos: [{ monto: 2000, categorias: [] }],
      compras: [{ precio_neto: 3000, impuestos_aplicados: [{ monto: 500 }], notas: [] }],
    });
    // margenBruto = cobrado - gastos - comprasNeto - ajusteNotas = 10000 - 2000 - 3000 - 0 = 5000
    expect(resultado.totales.margenBruto).toBe(5000);
    // disponible = cobrado - (gastos + compras[con impuestos]) = 10000 - (2000 + 3500) = 4500
    expect(resultado.totales.disponible).toBe(4500);
  });

  it("pctCobrado y pctGastado se calculan sobre el precio acordado", () => {
    const resultado = calcularAnalisis({
      proyecto: { precio_acordado_usd: 20000 },
      cobros: [{ monto_neto: 10000 }],
      gastos: [{ monto: 5000, categorias: [] }],
    });
    expect(resultado.totales.pctCobrado).toBe(50);
    expect(resultado.totales.pctGastado).toBe(25);
  });

  it("no divide por cero si no hay precio acordado", () => {
    const resultado = calcularAnalisis({ cobros: [{ monto_neto: 1000 }] });
    expect(resultado.totales.pctCobrado).toBe(0);
  });

  it("reparte el monto de un gasto en partes iguales entre sus categorías", () => {
    const resultado = calcularAnalisis({
      gastos: [{ monto: 100, categorias: [{ nombre: "Mano de obra" }, { nombre: "Materiales" }] }],
    });
    const porCategoria = resultado.gastosPorCategoria;
    expect(porCategoria).toHaveLength(2);
    const totalRepartido = porCategoria.reduce((acc, c) => acc + c.monto, 0);
    expect(totalRepartido).toBe(100); // no se cuenta dos veces el mismo gasto
    porCategoria.forEach((c) => expect(c.monto).toBe(50));
  });

  it("un gasto sin categorías cae en 'Sin categoría'", () => {
    const resultado = calcularAnalisis({
      gastos: [{ monto: 200, categorias: [] }],
    });
    expect(resultado.gastosPorCategoria).toEqual([
      { nombre: "Sin categoría", monto: 200, pct: 100 },
    ]);
  });

  it("cuenta gastos sin comprobante", () => {
    const resultado = calcularAnalisis({
      gastos: [
        { monto: 100, categorias: [], comprobantes: [] },
        { monto: 200, categorias: [], comprobantes: [{ id: "1" }] },
      ],
    });
    expect(resultado.gastosSinComprobante.cantidad).toBe(1);
    expect(resultado.gastosSinComprobante.monto).toBe(100);
  });

  it("la cascada arranca en 0 en los pasos 'subtotal'/'total' y encadena el resto", () => {
    const resultado = calcularAnalisis({
      cobros: [{ monto_neto: 1000 }],
      gastos: [{ monto: 200, categorias: [] }],
    });
    const cobradoPaso = resultado.cascada.find((p) => p.nombre === "Cobrado");
    expect(cobradoPaso.rango).toEqual([0, 1000]);

    const gastosPaso = resultado.cascada.find((p) => p.nombre === "Gastos");
    expect(gastosPaso.rango).toEqual([1000, 800]); // sigue desde donde terminó "Cobrado"
  });

  it("un gasto con monto negativo (corrección) resta del total en vez de sumar", () => {
    const resultado = calcularAnalisis({
      cobros: [{ monto_neto: 1000 }],
      gastos: [
        { monto: 300, categorias: [] },
        { monto: -100, categorias: [] },
      ],
    });
    expect(resultado.totales.gastos).toBe(200);
    expect(resultado.totales.disponible).toBe(800);
  });

  it("una nota de crédito mayor al monto de la compra puede dejar el total de compras en negativo", () => {
    const resultado = calcularAnalisis({
      compras: [
        {
          precio_neto: 100,
          impuestos_aplicados: [],
          notas: [{ tipo: "nota_credito", monto: 500 }],
        },
      ],
    });
    expect(resultado.totales.compras).toBe(-400);
  });

  it("ignora items null/undefined dentro de los arrays de notas sin explotar", () => {
    const resultado = calcularAnalisis({
      compras: [{ precio_neto: 100, impuestos_aplicados: [], notas: null }],
      cobros: [{ monto: 50, monto_neto: null }],
    });
    expect(resultado.totales.compras).toBe(100);
    expect(resultado.totales.cobrado).toBe(50); // monto_neto null -> cae al bruto
  });

  it("cobradoPorFase: si está 'en rojo' (gastó más de lo cobrado) no hay fila 'Disponible' y la base es lo gastado", () => {
    const resultado = calcularAnalisis({
      fases: [{ id: 1, nombre: "Demolición" }],
      cobros: [{ monto_neto: 100 }],
      compras: [
        { fase_id: 1, precio_neto: 400, precio_total: 400, impuestos_aplicados: [], notas: [] },
      ],
    });
    expect(resultado.totales.disponible).toBeLessThan(0);
    expect(resultado.cobradoPorFase.find((f) => f.nombre === "Disponible")).toBeUndefined();
    const total = resultado.cobradoPorFase.reduce((acc, f) => acc + f.monto, 0);
    expect(total).toBe(resultado.totales.egresos); // base = totalEgresos, no totalCobrado
  });

  it("cobradoPorFase: con margen positivo sí incluye la fila 'Disponible'", () => {
    const resultado = calcularAnalisis({
      fases: [{ id: 1, nombre: "Demolición" }],
      cobros: [{ monto_neto: 1000 }],
      compras: [
        { fase_id: 1, precio_neto: 300, precio_total: 300, impuestos_aplicados: [], notas: [] },
      ],
    });
    const disponibleFila = resultado.cobradoPorFase.find((f) => f.nombre === "Disponible");
    expect(disponibleFila.monto).toBe(700);
  });
});
