import { describe, it, expect } from "vitest";
import { calcularAnalisis } from "./analisis";

// calcularAnalisis es el corazón del reporte financiero del proyecto (lo que
// después se imprime en PDF), así que estos tests cubren los números que
// tienen que dar EXACTO: cobrado, gastos, compras, margen bruto y disponible.

// Los fixtures van en dólares (la moneda default del análisis). Las compras
// llevan cotizacion_dolar: 1 para que sus impuestos, que se guardan solo en
// pesos, valgan lo mismo en USD y las cuentas se lean directo.
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
      cobros: [{ monto_usd: 10000, monto_neto_usd: 9000 }],
    });
    expect(resultado.totales.cobrado).toBe(9000);
  });

  it("total de compras = precio_neto + impuestos + ajuste de notas (no solo precio_neto)", () => {
    const resultado = calcularAnalisis({
      compras: [
        {
          precio_neto_usd: 1000,
          cotizacion_dolar: 1,
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
          precio_neto_usd: 1000,
          cotizacion_dolar: 1,
          impuestos_aplicados: [],
          notas: [{ tipo: "nota_credito", monto_usd: 300 }],
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
          precio_neto_usd: 1000,
          cotizacion_dolar: 1,
          impuestos_aplicados: [],
          notas: [{ tipo: "nota_debito", monto_usd: 150 }],
        },
      ],
    });
    expect(resultado.totales.compras).toBe(1150);
  });

  it("margen bruto no descuenta impuestos (a diferencia de 'disponible')", () => {
    const resultado = calcularAnalisis({
      cobros: [{ monto_neto_usd: 10000 }],
      gastos: [{ monto_usd: 2000, categorias: [] }],
      compras: [
        {
          precio_neto_usd: 3000,
          cotizacion_dolar: 1,
          impuestos_aplicados: [{ monto: 500 }],
          notas: [],
        },
      ],
    });
    // margenBruto = cobrado - gastos - comprasNeto - ajusteNotas = 10000 - 2000 - 3000 - 0 = 5000
    expect(resultado.totales.margenBruto).toBe(5000);
    // disponible = cobrado - (gastos + compras[con impuestos]) = 10000 - (2000 + 3500) = 4500
    expect(resultado.totales.disponible).toBe(4500);
  });

  it("pctCobrado y pctGastado se calculan sobre el precio acordado", () => {
    const resultado = calcularAnalisis({
      proyecto: { precio_acordado_usd: 20000 },
      cobros: [{ monto_neto_usd: 10000 }],
      gastos: [{ monto_usd: 5000, categorias: [] }],
    });
    expect(resultado.totales.pctCobrado).toBe(50);
    expect(resultado.totales.pctGastado).toBe(25);
  });

  it("no divide por cero si no hay precio acordado", () => {
    const resultado = calcularAnalisis({ cobros: [{ monto_neto_usd: 1000 }] });
    expect(resultado.totales.pctCobrado).toBe(0);
  });

  it("reparte el monto de un gasto en partes iguales entre sus categorías", () => {
    const resultado = calcularAnalisis({
      gastos: [
        { monto_usd: 100, categorias: [{ nombre: "Mano de obra" }, { nombre: "Materiales" }] },
      ],
    });
    const porCategoria = resultado.gastosPorCategoria;
    expect(porCategoria).toHaveLength(2);
    const totalRepartido = porCategoria.reduce((acc, c) => acc + c.monto, 0);
    expect(totalRepartido).toBe(100); // no se cuenta dos veces el mismo gasto
    porCategoria.forEach((c) => expect(c.monto).toBe(50));
  });

  it("un gasto sin categorías cae en 'Sin categoría'", () => {
    const resultado = calcularAnalisis({
      gastos: [{ monto_usd: 200, categorias: [] }],
    });
    expect(resultado.gastosPorCategoria).toEqual([
      { nombre: "Sin categoría", monto: 200, pct: 100 },
    ]);
  });

  it("cuenta gastos sin comprobante", () => {
    const resultado = calcularAnalisis({
      gastos: [
        { monto_usd: 100, categorias: [], comprobantes: [] },
        { monto_usd: 200, categorias: [], comprobantes: [{ id: "1" }] },
      ],
    });
    expect(resultado.gastosSinComprobante.cantidad).toBe(1);
    expect(resultado.gastosSinComprobante.monto).toBe(100);
  });

  it("la cascada arranca en 0 en los pasos 'subtotal'/'total' y encadena el resto", () => {
    const resultado = calcularAnalisis({
      cobros: [{ monto_neto_usd: 1000 }],
      gastos: [{ monto_usd: 200, categorias: [] }],
    });
    const cobradoPaso = resultado.cascada.find((p) => p.nombre === "Cobrado");
    expect(cobradoPaso.rango).toEqual([0, 1000]);

    const gastosPaso = resultado.cascada.find((p) => p.nombre === "Gastos");
    expect(gastosPaso.rango).toEqual([1000, 800]); // sigue desde donde terminó "Cobrado"
  });

  it("un gasto con monto negativo (corrección) resta del total en vez de sumar", () => {
    const resultado = calcularAnalisis({
      cobros: [{ monto_neto_usd: 1000 }],
      gastos: [
        { monto_usd: 300, categorias: [] },
        { monto_usd: -100, categorias: [] },
      ],
    });
    expect(resultado.totales.gastos).toBe(200);
    expect(resultado.totales.disponible).toBe(800);
  });

  it("una nota de crédito mayor al monto de la compra puede dejar el total de compras en negativo", () => {
    const resultado = calcularAnalisis({
      compras: [
        {
          precio_neto_usd: 100,
          cotizacion_dolar: 1,
          impuestos_aplicados: [],
          notas: [{ tipo: "nota_credito", monto_usd: 500 }],
        },
      ],
    });
    expect(resultado.totales.compras).toBe(-400);
  });

  it("ignora items null/undefined dentro de los arrays de notas sin explotar", () => {
    const resultado = calcularAnalisis({
      compras: [
        { precio_neto_usd: 100, cotizacion_dolar: 1, impuestos_aplicados: [], notas: null },
      ],
    });
    expect(resultado.totales.compras).toBe(100);
  });

  it("cobradoPorFase: si está 'en rojo' (gastó más de lo cobrado) no hay fila 'Disponible' y la base es lo gastado", () => {
    const resultado = calcularAnalisis({
      fases: [{ id: 1, nombre: "Demolición" }],
      cobros: [{ monto_neto_usd: 100 }],
      compras: [
        {
          fase_id: 1,
          precio_neto_usd: 400,
          cotizacion_dolar: 1,
          precio_total_usd: 400,
          impuestos_aplicados: [],
          notas: [],
        },
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
      cobros: [{ monto_neto_usd: 1000 }],
      compras: [
        {
          fase_id: 1,
          precio_neto_usd: 300,
          cotizacion_dolar: 1,
          precio_total_usd: 300,
          impuestos_aplicados: [],
          notas: [],
        },
      ],
    });
    const disponibleFila = resultado.cobradoPorFase.find((f) => f.nombre === "Disponible");
    expect(disponibleFila.monto).toBe(700);
  });
});

// ---------------------------------------------------------------------------
// Doble moneda: cada moneda suma su cifra
// congelada, nada se reconvierte al leer, y los % salen siempre de los USD.
// ---------------------------------------------------------------------------

describe("calcularAnalisis en dos monedas", () => {
  // Se cobró a 1000 y se pagó a 1250: en USD gana, en pesos nominales no.
  const datos = {
    proyecto: { precio_acordado_usd: 100000 },
    cobros: [{ monto_neto_usd: 65000, monto_neto_ars: 65000000 }],
    gastos: [{ monto_usd: 8000, monto_ars: 10000000, categorias: [] }],
    compras: [
      {
        precio_neto_usd: 40000,
        precio_neto_ars: 50000000,
        precio_total_usd: 48400,
        precio_total_ars: 60500000,
        cotizacion_dolar: 1250,
        impuestos_aplicados: [{ monto: 10500000 }],
        notas: [],
      },
    ],
  };

  it("en USD suma las cifras en dólares y los impuestos con la cotización de su compra", () => {
    const { totales } = calcularAnalisis({ ...datos, moneda: "usd" });
    expect(totales.cobrado).toBe(65000);
    expect(totales.impuestos).toBe(8400);
    expect(totales.egresos).toBe(56400);
    expect(totales.disponible).toBe(8600);
  });

  it("en pesos suma las cifras en pesos congeladas, sin reexpresar", () => {
    const { totales } = calcularAnalisis({
      ...datos,
      moneda: "ars",
      cotizacionActual: { valor: 1500 },
    });
    expect(totales.cobrado).toBe(65000000);
    expect(totales.egresos).toBe(70500000);
    expect(totales.disponible).toBe(-5500000);
    expect(totales.precioAcordado).toBe(150000000);
  });

  it("los % contra el precio acordado salen de los dólares en las dos monedas", () => {
    const usd = calcularAnalisis({ ...datos, moneda: "usd" });
    const ars = calcularAnalisis({ ...datos, moneda: "ars", cotizacionActual: { valor: 1500 } });
    expect(usd.totales.pctGastado).toBeCloseTo(56.4);
    expect(ars.totales.pctGastado).toBeCloseTo(56.4); // 70.5M / 150M daría 47%
  });

  it("sin cotización cargada, el precio acordado en pesos queda en null", () => {
    const { totales } = calcularAnalisis({ ...datos, moneda: "ars" });
    expect(totales.precioAcordado).toBeNull();
    expect(totales.pctGastado).toBeCloseTo(56.4);
  });

  it("los pagos por tipo de factura se agrupan por código, sin nombre (lo pone la pantalla)", () => {
    const resultado = calcularAnalisis({
      proyecto: { precio_acordado_usd: 1000 },
      gastos: [
        { monto_ars: 1000, monto_usd: 1, tipo_factura: "factura_interna" },
        { monto_ars: 500, monto_usd: 0.5, tipo_factura: "factura_interna" },
        { monto_ars: 200, monto_usd: 0.2, tipo_factura: "recibo" },
      ],
      moneda: "ars",
    });

    expect(resultado.pagosPorTipoFactura).toEqual([
      { tipo: "factura_interna", cantidad: 2, monto: 1500 },
      { tipo: "recibo", cantidad: 1, monto: 200 },
    ]);
  });

  it("IVA 21 e IVA 10,5 suman juntos como IVA; los sin grupo, por su nombre", () => {
    const compra = (impuesto, monto) => ({
      precio_neto_ars: 100000,
      precio_neto_usd: 100,
      cotizacion_dolar: 1000,
      impuestos_aplicados: [{ monto, impuesto }],
      notas: [],
    });
    const resultado = calcularAnalisis({
      proyecto: { precio_acordado_usd: 1000 },
      compras: [
        compra({ nombre: "IVA 21", alicuota: 21, grupo: "IVA" }, 21000),
        compra({ nombre: "IVA 10,5", alicuota: 10.5, grupo: "IVA" }, 10500),
        compra({ nombre: "Percepción IIBB", alicuota: null, grupo: null }, 3000),
      ],
      moneda: "ars",
    });

    expect(resultado.impuestosPorTipo).toEqual([
      expect.objectContaining({ nombre: "IVA", monto: 31500 }),
      expect.objectContaining({ nombre: "Percepción IIBB", monto: 3000 }),
    ]);
  });
});
