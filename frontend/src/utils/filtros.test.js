import { describe, it, expect } from "vitest";
import {
  filtrarCompras,
  filtrarCobros,
  filtrarGastos,
  tieneAlerta,
  filtrosParaTipo,
  hayFiltrosActivos,
  FILTROS_VACIOS,
} from "./filtros";

const compra = (overrides = {}) => ({
  fecha: "2026-03-15",
  tipo_factura: "A",
  notas: [],
  estado_pago: "pendiente",
  estado_envio: "pedido",
  ...overrides,
});

describe("filtrarCompras", () => {
  it("sin filtros devuelve todo", () => {
    const compras = [compra(), compra({ fecha: "2026-01-01" })];
    expect(filtrarCompras(compras)).toHaveLength(2);
  });

  it("filtra por rango de fechas (desde/hasta)", () => {
    const compras = [
      compra({ fecha: "2026-01-01" }),
      compra({ fecha: "2026-03-15" }),
      compra({ fecha: "2026-06-01" }),
    ];
    const resultado = filtrarCompras(compras, {
      ...FILTROS_VACIOS,
      desde: "2026-02-01",
      hasta: "2026-05-01",
    });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].fecha).toBe("2026-03-15");
  });

  it("filtra por tipo de factura", () => {
    const compras = [compra({ tipo_factura: "A" }), compra({ tipo_factura: "B" })];
    const resultado = filtrarCompras(compras, { ...FILTROS_VACIOS, tipoFactura: "B" });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].tipo_factura).toBe("B");
  });

  it("filtra 'con nota de crédito'", () => {
    const compras = [compra({ notas: [{ tipo: "nota_credito" }] }), compra({ notas: [] })];
    const resultado = filtrarCompras(compras, { ...FILTROS_VACIOS, notas: "con_credito" });
    expect(resultado).toHaveLength(1);
  });

  it("filtra por estado de pago", () => {
    const compras = [compra({ estado_pago: "pagado" }), compra({ estado_pago: "pendiente" })];
    const resultado = filtrarCompras(compras, { ...FILTROS_VACIOS, estadoPago: "pagado" });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].estado_pago).toBe("pagado");
  });

  it("con un array vacío devuelve vacío sin explotar", () => {
    expect(filtrarCompras([], { ...FILTROS_VACIOS, estadoPago: "pagado" })).toEqual([]);
  });

  it("no explota si 'notas' viene null en vez de array", () => {
    const compras = [compra({ notas: null })];
    expect(filtrarCompras(compras, { ...FILTROS_VACIOS, notas: "sin_notas" })).toHaveLength(1);
    expect(filtrarCompras(compras, { ...FILTROS_VACIOS, notas: "con_credito" })).toHaveLength(0);
  });
});

describe("filtrarCobros", () => {
  it("filtra por comprobante presente/ausente", () => {
    const cobros = [
      { fecha: "2026-01-01", notas: [], comprobantes: [{ id: "1" }] },
      { fecha: "2026-01-02", notas: [], comprobantes: [] },
    ];
    const conComprobante = filtrarCobros(cobros, { ...FILTROS_VACIOS, comprobante: "con" });
    expect(conComprobante).toHaveLength(1);

    const sinComprobante = filtrarCobros(cobros, { ...FILTROS_VACIOS, comprobante: "sin" });
    expect(sinComprobante).toHaveLength(1);
  });

  it("no explota si 'comprobantes' viene null en vez de array", () => {
    const cobros = [{ fecha: "2026-01-01", notas: [], comprobantes: null }];
    expect(filtrarCobros(cobros, { ...FILTROS_VACIOS, comprobante: "sin" })).toHaveLength(1);
  });

  it("con un array vacío devuelve vacío sin explotar", () => {
    expect(filtrarCobros([])).toEqual([]);
  });
});

describe("filtrarGastos", () => {
  it("combina filtro de fecha y tipo de factura", () => {
    const gastos = [
      { fecha: "2026-03-01", tipo_factura: "A", comprobantes: [] },
      { fecha: "2026-03-01", tipo_factura: "B", comprobantes: [] },
      { fecha: "2026-05-01", tipo_factura: "A", comprobantes: [] },
    ];
    const resultado = filtrarGastos(gastos, {
      ...FILTROS_VACIOS,
      desde: "2026-02-01",
      hasta: "2026-04-01",
      tipoFactura: "A",
    });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].fecha).toBe("2026-03-01");
  });

  it("con un array vacío devuelve vacío sin explotar", () => {
    expect(filtrarGastos([], { ...FILTROS_VACIOS, tipoFactura: "A" })).toEqual([]);
  });
});

describe("hayFiltrosActivos", () => {
  it("es false para los filtros vacíos por default", () => {
    expect(hayFiltrosActivos(FILTROS_VACIOS)).toBe(false);
  });

  it("es true si hay una fecha 'desde' cargada", () => {
    expect(hayFiltrosActivos({ ...FILTROS_VACIOS, desde: "2026-01-01" })).toBe(true);
  });

  it("es true si algún select no está en su valor 'todos'/'todas'", () => {
    expect(hayFiltrosActivos({ ...FILTROS_VACIOS, estadoPago: "pagado" })).toBe(true);
  });

  it("es false si falta el objeto de filtros", () => {
    expect(hayFiltrosActivos(null)).toBe(false);
    expect(hayFiltrosActivos(undefined)).toBe(false);
  });
});

describe("tieneAlerta", () => {
  const conComprobante = { comprobantes: [{ id: 1 }] };

  it("un movimiento sin comprobante pide atención, sea del tipo que sea", () => {
    for (const tipo of ["compra", "gasto", "cobro"]) {
      expect(tieneAlerta(tipo, { comprobantes: [] })).toBe(true);
    }
  });

  it("una compra con comprobante pide atención si está impaga o sin entregar", () => {
    const base = { ...conComprobante, estado_pago: "pagado", estado_envio: "entregado" };
    expect(tieneAlerta("compra", base)).toBe(false);
    expect(tieneAlerta("compra", { ...base, estado_pago: "pendiente" })).toBe(true);
    expect(tieneAlerta("compra", { ...base, estado_envio: "pedido" })).toBe(true);
  });

  it("un gasto o un cobro con comprobante no tienen nada pendiente", () => {
    expect(tieneAlerta("gasto", conComprobante)).toBe(false);
    expect(tieneAlerta("cobro", conComprobante)).toBe(false);
  });
});

describe("filtrosParaTipo", () => {
  it("suelta los filtros que no aplican al tipo nuevo y deja los que sí", () => {
    const filtros = { ...FILTROS_VACIOS, estadoPago: "pendiente", tipoFactura: "factura_a" };
    expect(filtrosParaTipo(filtros, "gastos")).toEqual({
      ...FILTROS_VACIOS,
      tipoFactura: "factura_a",
    });
    expect(filtrosParaTipo(filtros, "compras")).toEqual(filtros);
  });
});
