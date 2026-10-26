import { describe, it, expect } from "vitest";
import { contarParaBorrar, lineasDeBorrado } from "./proyectos";

// Una obra con dos fases y movimientos propios, más los de OTRA obra, que no
// tienen que contarse.
const fases = [
  { id: "f-1", proyecto_id: "p-1" },
  { id: "f-2", proyecto_id: "p-1" },
  { id: "f-9", proyecto_id: "p-2" },
];
const compras = [
  { id: "c-1", fase_id: "f-1" },
  { id: "c-2", fase_id: "f-2" },
  { id: "c-3", fase_id: "f-2" },
  { id: "c-9", fase_id: "f-9" },
];
const gastos = [
  { id: "g-1", proyecto_id: "p-1" },
  { id: "g-9", proyecto_id: "p-2" },
];
const cobros = [
  { id: "co-1", proyecto_id: "p-1" },
  { id: "co-2", proyecto_id: "p-1" },
  { id: "co-9", proyecto_id: "p-2" },
];

describe("contarParaBorrar", () => {
  it("cuenta las compras por la fase de la obra y los gastos por la obra", () => {
    // La compra cuelga de una fase, no del proyecto: por eso va por fase_id.
    expect(contarParaBorrar({ proyectoId: "p-1", fases, gastos, compras })).toEqual({
      compras: 3,
      gastos: 1,
      cobros: 0,
    });
  });

  it("cuenta los cobros de la obra, que también se van con ella", () => {
    expect(contarParaBorrar({ proyectoId: "p-1", fases, gastos, compras, cobros }).cobros).toBe(2);
  });

  it("una obra sin nada da todo en cero", () => {
    expect(contarParaBorrar({ proyectoId: "p-3", fases, gastos, compras })).toEqual({
      compras: 0,
      gastos: 0,
      cobros: 0,
    });
  });

  it("sin datos cargados no explota", () => {
    expect(contarParaBorrar({ proyectoId: "p-1" })).toEqual({
      compras: 0,
      gastos: 0,
      cobros: 0,
    });
  });
});

describe("lineasDeBorrado", () => {
  it("una línea por cosa, en singular o plural según la cuenta", () => {
    expect(lineasDeBorrado({ compras: 3, gastos: 1 })).toEqual(["3 compras", "1 gasto"]);
  });

  it("no muestra ceros: lo que no hay no se lista", () => {
    expect(lineasDeBorrado({ compras: 2, gastos: 0 })).toEqual(["2 compras"]);
  });

  it("lista los cobros al final: también se borran con la obra", () => {
    expect(lineasDeBorrado({ compras: 2, gastos: 1, cobros: 5 })).toEqual([
      "2 compras",
      "1 gasto",
      "5 cobros",
    ]);
  });

  it("una obra vacía no deja ninguna línea", () => {
    expect(lineasDeBorrado({ compras: 0, gastos: 0 })).toEqual([]);
  });
});
