import { describe, it, expect } from "vitest";

import { getMedioPagoLabel, opcionesMedioPago } from "./medioPago";
import { MEDIOS_PAGO_PRUEBA } from "../test/tiposFactura";

describe("getMedioPagoLabel", () => {
  it("traduce el código al nombre de Ajustes", () => {
    expect(
      getMedioPagoLabel("tarjeta", [{ codigo: "tarjeta", nombre: "Tarjeta de crédito" }])
    ).toBe("Tarjeta de crédito");
  });

  it("sin medio, null (el movimiento no lo tiene)", () => {
    expect(getMedioPagoLabel("", MEDIOS_PAGO_PRUEBA)).toBeNull();
    expect(getMedioPagoLabel(null, MEDIOS_PAGO_PRUEBA)).toBeNull();
  });

  it("si el código no está en la lista o todavía no cargó, muestra el código", () => {
    expect(getMedioPagoLabel("cripto", MEDIOS_PAGO_PRUEBA)).toBe("cripto");
    expect(getMedioPagoLabel("cheque")).toBe("cheque");
  });
});

describe("opcionesMedioPago", () => {
  const medios = [
    ...MEDIOS_PAGO_PRUEBA,
    { id: "m5", codigo: "cripto", nombre: "Cripto", orden: 5, activo: true },
  ].map((m) => (m.codigo === "cheque" ? { ...m, activo: false } : m));

  it("ofrece sólo los activos, en orden", () => {
    expect(opcionesMedioPago(medios).map((o) => o.valor)).toEqual([
      "efectivo",
      "transferencia",
      "tarjeta",
      "cripto",
    ]);
  });

  it("los 4 conocidos tienen su ícono y los nuevos uno genérico", () => {
    const [efectivo, , , cripto] = opcionesMedioPago(medios);
    expect(efectivo.icono).toBeDefined();
    expect(cripto.icono).toBeDefined();
    expect(cripto.icono).not.toBe(efectivo.icono);
  });

  it("al editar un movimiento con un medio desactivado, ese medio sigue visible y elegible", () => {
    const valores = opcionesMedioPago(medios, "cheque").map((o) => o.valor);
    expect(valores).toContain("cheque");
  });

  it("si el valor actual no está en la lista, se agrega para que se vea elegido", () => {
    expect(opcionesMedioPago(medios, "viejo").at(-1)).toMatchObject({
      valor: "viejo",
      label: "viejo",
    });
  });
});
