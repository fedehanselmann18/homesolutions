import { describe, it, expect } from "vitest";
import {
  notasDeCompras,
  notasDeCobros,
  totalNotasCredito,
  totalNotasDebito,
  restanteDetalleCompra,
} from "./notas";

describe("notasDeCompras", () => {
  it("aplana las notas de varias compras y agrega la referencia de origen", () => {
    const compras = [
      {
        id: "c1",
        descripcion: "Compra 1",
        fecha: "2026-01-01",
        notas: [{ tipo: "nota_credito", monto: 100 }],
      },
      { id: "c2", descripcion: "Compra 2", fecha: "2026-02-01", notas: [] },
    ];
    const resultado = notasDeCompras(compras);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({ origenTipo: "compra", origenId: "c1", monto: 100 });
  });

  it("no rompe si una compra no tiene notas", () => {
    expect(notasDeCompras([{ id: "c1" }])).toEqual([]);
  });

  it("con lista vacía o sin argumento devuelve []", () => {
    expect(notasDeCompras([])).toEqual([]);
    expect(notasDeCompras()).toEqual([]);
  });
});

describe("notasDeCobros", () => {
  it("aplana notas de cobros con su origen", () => {
    const cobros = [
      {
        id: "co1",
        descripcion: "Cobro 1",
        fecha: "2026-01-01",
        notas: [{ tipo: "nota_debito", monto: 50 }],
      },
    ];
    const resultado = notasDeCobros(cobros);
    expect(resultado[0]).toMatchObject({ origenTipo: "cobro", origenId: "co1" });
  });
});

describe("totalNotasCredito / totalNotasDebito", () => {
  const notas = [
    { tipo: "nota_credito", monto: 100 },
    { tipo: "nota_credito", monto: 50 },
    { tipo: "nota_debito", monto: 30 },
  ];

  it("suma solo las notas de crédito", () => {
    expect(totalNotasCredito(notas)).toBe(150);
  });

  it("suma solo las notas de débito", () => {
    expect(totalNotasDebito(notas)).toBe(30);
  });

  it("ignora montos no numéricos en vez de romper", () => {
    const notasConBasura = [{ tipo: "nota_credito", monto: "no-es-un-numero" }];
    expect(totalNotasCredito(notasConBasura)).toBe(0);
  });
});

describe("restanteDetalleCompra", () => {
  it("devuelve la cantidad completa si no se devolvió nada", () => {
    const compra = {
      detalle: [{ id: "d1", cantidad: 10 }],
      notas: [],
    };
    expect(restanteDetalleCompra(compra, "d1")).toBe(10);
  });

  it("descuenta lo ya devuelto en notas anteriores", () => {
    const compra = {
      detalle: [{ id: "d1", cantidad: 10 }],
      notas: [
        { detalles: [{ detalle_compra_id: "d1", cantidad: 3 }] },
        { detalles: [{ detalle_compra_id: "d1", cantidad: 2 }] },
      ],
    };
    expect(restanteDetalleCompra(compra, "d1")).toBe(5);
  });

  it("devuelve 0 si la línea de detalle no existe", () => {
    const compra = { detalle: [], notas: [] };
    expect(restanteDetalleCompra(compra, "no-existe")).toBe(0);
  });
});
