import { describe, it, expect } from "vitest";

import { getTipoFacturaLabel, opcionesTipoFactura } from "./tipoFactura";
import { TIPOS_FACTURA_PRUEBA } from "../test/tiposFactura";

describe("getTipoFacturaLabel", () => {
  it("traduce el código al nombre de Ajustes", () => {
    expect(getTipoFacturaLabel("factura_interna", TIPOS_FACTURA_PRUEBA)).toBe("Factura interna");
  });

  it("si el código no está en la lista, muestra el código", () => {
    expect(getTipoFacturaLabel("ticket", TIPOS_FACTURA_PRUEBA)).toBe("ticket");
  });

  it("sin lista todavía (cargando), muestra el código", () => {
    expect(getTipoFacturaLabel("remito")).toBe("remito");
  });
});

describe("opcionesTipoFactura", () => {
  it("arma las opciones del control en el orden de la lista", () => {
    const opciones = opcionesTipoFactura(TIPOS_FACTURA_PRUEBA, "");
    expect(opciones.map((o) => o.valor)).toEqual(TIPOS_FACTURA_PRUEBA.map((t) => t.codigo));
    expect(opciones.at(-1)).toEqual({ valor: "otros", label: "Otros" });
  });

  it("al editar, el valor actual se ve elegido aunque la lista no haya llegado", () => {
    expect(opcionesTipoFactura([], "factura_a")).toEqual([
      { valor: "factura_a", label: "factura_a" },
    ]);
  });

  it("no duplica el valor actual si ya está en la lista", () => {
    expect(opcionesTipoFactura(TIPOS_FACTURA_PRUEBA, "remito")).toHaveLength(
      TIPOS_FACTURA_PRUEBA.length
    );
  });
});
