import { describe, it, expect } from "vitest";
import { calcularMetricas, inicioPeriodo, nivelObra } from "./metricas";
import { calcularAnalisis } from "./analisis";
import { CATEGORIA_COMPRAS } from "../constants/metricas";

// calcularMetricas arma la página Métricas sumando calcularAnalisis por obra.
// Los fixtures van en dólares (moneda default) con cotización 1 salvo donde se
// prueba la vista en pesos. Las compras traen neto, impuestos, notas Y su
// precio_total, como las manda el backend: el total por obra sale de
// calcularAnalisis (neto + impuestos ± notas) y el gráfico por mes del
// precio_total, y con datos reales coinciden.

const HOY = new Date(2026, 9, 15); // 15 oct 2026, hora local

function compra({ id, fase_id, fecha, neto, impuestos = 0, notas = [], proveedor_id = 1 }) {
  const ajusteNotas = notas.reduce(
    (acc, n) => acc + (n.tipo === "nota_debito" ? n.monto_usd : -n.monto_usd),
    0
  );
  const total = neto + impuestos + ajusteNotas;
  return {
    id,
    fase_id,
    fecha,
    proveedor_id,
    cotizacion_dolar: 1,
    precio_neto_usd: neto,
    precio_neto_ars: neto,
    precio_total_usd: total,
    precio_total_ars: total,
    impuestos_aplicados: impuestos ? [{ monto: impuestos }] : [],
    notas: notas.map((n) => ({ ...n, monto_ars: n.monto_usd })),
  };
}

const gasto = (id, proyecto_id, fecha, monto, categorias = []) => ({
  id,
  proyecto_id,
  fecha,
  monto_usd: monto,
  monto_ars: monto,
  categorias,
});

const cobro = (id, proyecto_id, fecha, neto, notas = []) => ({
  id,
  proyecto_id,
  fecha,
  monto_neto_usd: neto,
  monto_neto_ars: neto,
  notas,
});

// Dos obras con movimientos en el período por defecto (6 meses: may–oct).
const BASE = {
  proyectos: [
    { id: 1, nombre: "Olleros", estado: "en_curso", precio_acordado_usd: 10000 },
    { id: 2, nombre: "Terravista", estado: "en_curso", precio_acordado_usd: 20000 },
  ],
  fases: [
    { id: 10, proyecto_id: 1 },
    { id: 20, proyecto_id: 2 },
  ],
  proveedores: [
    { id: 1, nombre: "Distribuidora LG" },
    { id: 2, nombre: "Casa del Cobre" },
  ],
  cobros: [cobro(1, 1, "2026-06-10", 5000), cobro(2, 2, "2026-07-01", 8000)],
  gastos: [
    gasto(1, 1, "2026-06-12", 500, [{ nombre: "Flete" }]),
    gasto(2, 2, "2026-08-03", 1000, [{ nombre: "Mano de obra" }]),
  ],
  compras: [
    compra({ id: 1, fase_id: 10, fecha: "2026-06-15", neto: 2000, impuestos: 420 }),
    compra({ id: 2, fase_id: 20, fecha: "2026-09-20", neto: 3000, proveedor_id: 2 }),
  ],
  hoy: HOY,
};

describe("inicioPeriodo", () => {
  it("cuenta meses calendario completos incluyendo el actual, en fecha local", () => {
    expect(inicioPeriodo("mes", HOY)).toBe("2026-10-01");
    expect(inicioPeriodo("3m", HOY)).toBe("2026-08-01");
    expect(inicioPeriodo("6m", HOY)).toBe("2026-05-01");
    expect(inicioPeriodo("12m", HOY)).toBe("2025-11-01");
    expect(inicioPeriodo("anio", HOY)).toBe("2026-01-01");
    expect(inicioPeriodo("todo", HOY)).toBeNull();
  });

  it("un período desconocido (URL tocada a mano) cae al default de 6 meses", () => {
    expect(inicioPeriodo("cualquiera", HOY)).toBe("2026-05-01");
  });
});

describe("nivelObra", () => {
  it("resultado negativo es problema aunque el % ejecutado sea bajo", () => {
    expect(nivelObra({ resultadoUsd: -1, pctEjecutado: 10 })).toBe("problema");
  });
  it("más de 85 % ejecutado es atención; 85 justo no", () => {
    expect(nivelObra({ resultadoUsd: 0, pctEjecutado: 85.1 })).toBe("atencion");
    expect(nivelObra({ resultadoUsd: 0, pctEjecutado: 85 })).toBe("resuelto");
  });
  it("sin precio acordado no hay % que medir", () => {
    expect(nivelObra({ resultadoUsd: 100, pctEjecutado: null })).toBe("sin_dato");
  });
});

describe("calcularMetricas", () => {
  it("con todo vacío no explota: KPIs en cero, rentabilidad null y 6 meses de gráfico", () => {
    const r = calcularMetricas({ hoy: HOY });
    expect(r.kpis).toEqual({ ingresos: 0, egresos: 0, resultado: 0, rentabilidad: null });
    expect(r.filasObras).toEqual([]);
    expect(r.rentabilidadPorObra).toEqual([]);
    expect(r.egresosPorCategoria).toEqual([]);
    expect(r.topProveedores).toEqual([]);
    expect(r.evolucionMensual).toHaveLength(6);
    expect(r.evolucionMensual.every((m) => m.ingresos === 0 && m.egresos === 0)).toBe(true);
  });

  it("un período sin movimientos deja todo en cero y sin obras", () => {
    const r = calcularMetricas({ ...BASE, periodo: "mes" });
    expect(r.kpis.ingresos).toBe(0);
    expect(r.kpis.egresos).toBe(0);
    expect(r.kpis.rentabilidad).toBeNull();
    expect(r.filasObras).toEqual([]);
    expect(r.evolucionMensual).toHaveLength(1);
  });

  it("calcula ingresos, egresos, resultado y rentabilidad de las obras", () => {
    const r = calcularMetricas(BASE);
    // Ingresos 5000 + 8000; egresos 500 + 2420 + 1000 + 3000.
    expect(r.kpis.ingresos).toBe(13000);
    expect(r.kpis.egresos).toBe(6920);
    expect(r.kpis.resultado).toBe(6080);
    expect(r.kpis.rentabilidad).toBeCloseTo((6080 / 13000) * 100);
  });

  it("la suma de las obras coincide con los KPIs", () => {
    const r = calcularMetricas(BASE);
    const suma = (clave) => r.filasObras.reduce((acc, f) => acc + f[clave], 0);
    expect(suma("ingresos")).toBe(r.kpis.ingresos);
    expect(suma("egresos")).toBe(r.kpis.egresos);
    expect(suma("resultado")).toBe(r.kpis.resultado);
  });

  it("con período Todo, los KPIs son calcularAnalisis sumado por obra", () => {
    const r = calcularMetricas({ ...BASE, periodo: "todo" });
    const analisis = BASE.proyectos.map((proyecto) =>
      calcularAnalisis({
        proyecto,
        fases: BASE.fases.filter((f) => f.proyecto_id === proyecto.id),
        gastos: BASE.gastos.filter((g) => g.proyecto_id === proyecto.id),
        cobros: BASE.cobros.filter((c) => c.proyecto_id === proyecto.id),
        compras: BASE.compras.filter((c) =>
          BASE.fases.some((f) => f.id === c.fase_id && f.proyecto_id === proyecto.id)
        ),
      })
    );
    const total = (clave) => analisis.reduce((acc, a) => acc + a.totales[clave], 0);
    expect(r.kpis.ingresos).toBe(total("cobrado"));
    expect(r.kpis.egresos).toBe(total("egresos"));
    expect(r.kpis.resultado).toBe(total("disponible"));
  });

  it("el gráfico por mes suma lo mismo que los KPIs", () => {
    const r = calcularMetricas(BASE);
    expect(r.evolucionMensual.map((m) => m.mes)).toEqual([
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ]);
    const junio = r.evolucionMensual.find((m) => m.mes === "2026-06");
    expect(junio).toMatchObject({ ingresos: 5000, egresos: 2920 });
    const suma = (clave) => r.evolucionMensual.reduce((acc, m) => acc + m[clave], 0);
    expect(suma("ingresos")).toBe(r.kpis.ingresos);
    expect(suma("egresos")).toBe(r.kpis.egresos);
  });

  it("filtra cada movimiento por su fecha: el 1° del mes de inicio entra, el día anterior no", () => {
    const r = calcularMetricas({
      ...BASE,
      periodo: "3m", // desde 2026-08-01
      gastos: [gasto(1, 1, "2026-07-31", 999), gasto(2, 1, "2026-08-01", 100)],
      cobros: [],
      compras: [],
    });
    expect(r.kpis.egresos).toBe(100);
    expect(r.evolucionMensual).toHaveLength(3);
  });

  it("período Todo arranca el gráfico en el mes del primer movimiento", () => {
    const r = calcularMetricas({
      ...BASE,
      periodo: "todo",
      cobros: [cobro(1, 1, "2025-12-20", 1)],
    });
    expect(r.evolucionMensual[0].mes).toBe("2025-12");
    expect(r.evolucionMensual.at(-1).mes).toBe("2026-10");
  });

  it("una obra sin cobros entra en la tabla con rentabilidad null y queda fuera del ranking", () => {
    const r = calcularMetricas({ ...BASE, cobros: [cobro(1, 1, "2026-06-10", 5000)] });
    const terravista = r.filasObras.find((f) => f.id === 2);
    expect(terravista.ingresos).toBe(0);
    expect(terravista.rentabilidad).toBeNull();
    expect(r.rentabilidadPorObra.map((o) => o.id)).toEqual([1]);
    // La rentabilidad total sí cuenta sus egresos: (5000 − 6920) / 5000.
    expect(r.kpis.rentabilidad).toBeCloseTo(((5000 - 6920) / 5000) * 100);
  });

  it("una obra con resultado negativo da rentabilidad negativa y badge de problema", () => {
    const r = calcularMetricas({
      ...BASE,
      cobros: [cobro(1, 1, "2026-06-10", 1000), cobro(2, 2, "2026-07-01", 8000)],
    });
    const olleros = r.filasObras.find((f) => f.id === 1);
    expect(olleros.resultado).toBe(1000 - 2920);
    expect(olleros.rentabilidad).toBeCloseTo(-192);
    expect(olleros.nivel).toBe("problema");
    // Lo que pide atención va primero en la tabla.
    expect(r.filasObras[0].id).toBe(1);
  });

  it("el ranking de rentabilidad va de mayor a menor", () => {
    const r = calcularMetricas(BASE);
    // Olleros: (5000 − 2920) / 5000 = 41,6 %; Terravista: (8000 − 4000) / 8000 = 50 %.
    expect(r.rentabilidadPorObra.map((o) => o.id)).toEqual([2, 1]);
    expect(r.rentabilidadPorObra[0].rentabilidad).toBeCloseTo(50);
  });

  it("notas de crédito y débito ya vienen en los totales: no se restan dos veces", () => {
    const r = calcularMetricas({
      ...BASE,
      gastos: [],
      cobros: [
        // Cobro bruto 6000 con una NC de 1000 al cliente: el neto ya es 5000.
        cobro(1, 1, "2026-06-10", 5000, [{ tipo: "nota_credito", monto_usd: 1000 }]),
      ],
      compras: [
        compra({
          id: 1,
          fase_id: 10,
          fecha: "2026-06-15",
          neto: 2000,
          notas: [
            { tipo: "nota_credito", monto_usd: 300 },
            { tipo: "nota_debito", monto_usd: 100 },
          ],
        }),
      ],
    });
    expect(r.kpis.ingresos).toBe(5000);
    expect(r.kpis.egresos).toBe(1800);
    expect(r.evolucionMensual.find((m) => m.mes === "2026-06").egresos).toBe(1800);
  });

  it("el badge mira la obra entera, no el período filtrado", () => {
    // Anticipo en julio, gastos en octubre: el mes da negativo, la obra no.
    const r = calcularMetricas({
      ...BASE,
      periodo: "mes",
      cobros: [cobro(1, 1, "2026-07-01", 9000)],
      gastos: [gasto(1, 1, "2026-10-05", 2000)],
      compras: [],
    });
    const olleros = r.filasObras[0];
    expect(olleros.resultado).toBe(-2000);
    expect(olleros.rentabilidad).toBeNull();
    expect(olleros.pctEjecutado).toBeCloseTo(20); // 2000 de 10000 en toda la obra
    expect(olleros.nivel).toBe("resuelto");
  });

  it("más de 85 % ejecutado es atención y sin precio acordado es sin_dato", () => {
    const r = calcularMetricas({
      ...BASE,
      proyectos: [
        { id: 1, nombre: "Olleros", estado: "en_curso", precio_acordado_usd: 2500 },
        { id: 2, nombre: "Terravista", estado: "en_curso", precio_acordado_usd: 0 },
      ],
      cobros: [cobro(1, 1, "2026-06-10", 5000), cobro(2, 2, "2026-07-01", 8000)],
    });
    const olleros = r.filasObras.find((f) => f.id === 1);
    expect(olleros.pctEjecutado).toBeCloseTo((2920 / 2500) * 100);
    expect(olleros.nivel).toBe("atencion");
    const terravista = r.filasObras.find((f) => f.id === 2);
    expect(terravista.pctEjecutado).toBeNull();
    expect(terravista.nivel).toBe("sin_dato");
  });

  it("filtra por obra (los ids pueden llegar como texto desde la URL)", () => {
    const r = calcularMetricas({ ...BASE, obras: ["2"] });
    expect(r.filasObras.map((f) => f.id)).toEqual([2]);
    expect(r.kpis.ingresos).toBe(8000);
    expect(r.kpis.egresos).toBe(4000);
    expect(r.topProveedores.map((p) => p.nombre)).toEqual(["Casa del Cobre"]);
  });

  it("en pesos los montos salen de las cifras en pesos y la rentabilidad sigue siendo la de USD", () => {
    const enPesos = {
      ...BASE,
      moneda: "ars",
      cotizacionActual: { valor: 1500 },
      proyectos: [{ id: 1, nombre: "Olleros", estado: "en_curso", precio_acordado_usd: 10000 }],
      // Cobrado 5000 USD a 1400 = 7.000.000; gasto de 1.500.000 pesos a 1500 = 1000 USD.
      cobros: [{ ...cobro(1, 1, "2026-06-10", 5000), monto_neto_ars: 7000000 }],
      gastos: [{ ...gasto(1, 1, "2026-06-12", 1000), monto_ars: 1500000 }],
      compras: [],
    };
    const r = calcularMetricas(enPesos);
    expect(r.kpis.ingresos).toBe(7000000);
    expect(r.kpis.egresos).toBe(1500000);
    expect(r.kpis.resultado).toBe(5500000);
    // En USD: (5000 − 1000) / 5000 = 80 %, no 5.5 M / 7 M = 78,6 %.
    expect(r.kpis.rentabilidad).toBeCloseTo(80);
    expect(r.filasObras[0].precioAcordado).toBe(15000000);
    expect(r.filasObras[0].pctEjecutado).toBeCloseTo(10);
  });

  it("egresos por categoría: categorías de gasto más una fila con las compras, y suman los egresos", () => {
    const r = calcularMetricas(BASE);
    expect(r.egresosPorCategoria.map((c) => c.nombre)).toEqual([
      CATEGORIA_COMPRAS,
      "Mano de obra",
      "Flete",
    ]);
    expect(r.egresosPorCategoria[0].monto).toBe(5420);
    const total = r.egresosPorCategoria.reduce((acc, c) => acc + c.monto, 0);
    expect(total).toBe(r.kpis.egresos);
    const pct = r.egresosPorCategoria.reduce((acc, c) => acc + c.pct, 0);
    expect(pct).toBeCloseTo(100);
  });

  it("proveedores ordenados por monto, con su % sobre las compras", () => {
    const r = calcularMetricas(BASE);
    expect(r.topProveedores).toEqual([
      { nombre: "Casa del Cobre", monto: 3000, pct: (3000 / 5420) * 100 },
      { nombre: "Distribuidora LG", monto: 2420, pct: (2420 / 5420) * 100 },
    ]);
  });
});
