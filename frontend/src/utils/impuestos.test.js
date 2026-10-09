import { describe, it, expect } from "vitest";

import {
  calcularImpuesto,
  elegirImpuesto,
  etiquetaImpuesto,
  filasDesdeAplicados,
  formatoAlicuota,
  grupoRepetido,
  impuestosParaGuardar,
  montoFila,
  nuevaFilaImpuesto,
  tipearMonto,
  totalImpuestos,
  volverAlCalculado,
} from "./impuestos";

const IVA21 = { id: "iva21", nombre: "IVA 21", alicuota: 21, grupo: "IVA" };
const IVA105 = { id: "iva105", nombre: "IVA 10,5", alicuota: 10.5, grupo: "IVA" };
const IIBB = { id: "iibb", nombre: "Percepción IIBB", alicuota: null, grupo: null };
const DISPONIBLES = [IVA21, IVA105, IIBB];

describe("calcularImpuesto", () => {
  it("calcula sobre la base y redondea a centavos", () => {
    expect(calcularImpuesto(100000, 21)).toBe(21000);
    expect(calcularImpuesto(100000, 10.5)).toBe(10500);
    // 1234,57 × 10,5 % = 129,62985 -> 129,63
    expect(calcularImpuesto(1234.57, 10.5)).toBe(129.63);
    // mitad para arriba: 0,05 × 21 % = 0,0105 -> 0,01
    expect(calcularImpuesto(0.05, 21)).toBe(0.01);
  });

  it("sin base da cero", () => {
    expect(calcularImpuesto("", 21)).toBe(0);
  });
});

describe("filas de impuesto", () => {
  it("elegir un IVA lo vuelve automático y sigue al neto", () => {
    const fila = elegirImpuesto(nuevaFilaImpuesto(), "iva21", DISPONIBLES);

    expect(fila.auto).toBe(true);
    expect(montoFila(fila, 100000, DISPONIBLES)).toBe(21000);
    expect(montoFila(fila, 200000, DISPONIBLES)).toBe(42000);
  });

  it("tipear el monto lo deja fijo aunque cambie el neto", () => {
    const fila = tipearMonto(elegirImpuesto(nuevaFilaImpuesto(), "iva21", DISPONIBLES), "20999.5");

    expect(fila.auto).toBe(false);
    expect(montoFila(fila, 200000, DISPONIBLES)).toBe(20999.5);
    expect(montoFila(volverAlCalculado(fila), 200000, DISPONIBLES)).toBe(42000);
  });

  it("un impuesto sin alícuota se tipea a mano", () => {
    const fila = tipearMonto(elegirImpuesto(nuevaFilaImpuesto(), "iibb", DISPONIBLES), "3000");

    expect(fila.auto).toBe(false);
    expect(montoFila(fila, 100000, DISPONIBLES)).toBe(3000);
  });

  it("el total suma calculados y tipeados", () => {
    const filas = [
      elegirImpuesto(nuevaFilaImpuesto(), "iva21", DISPONIBLES),
      tipearMonto(elegirImpuesto(nuevaFilaImpuesto(), "iibb", DISPONIBLES), "3000"),
    ];

    expect(totalImpuestos(filas, 100000, DISPONIBLES)).toBe(24000);
    expect(impuestosParaGuardar(filas, 100000, DISPONIBLES)).toEqual([
      { impuesto_id: "iva21", monto: 21000 },
      { impuesto_id: "iibb", monto: 3000 },
    ]);
  });

  it("al editar, sólo es automática la fila cuyo monto coincide con el cálculo", () => {
    const filas = filasDesdeAplicados(
      [
        { impuesto_id: "iva21", monto: 21000 },
        { impuesto_id: "iva105", monto: 10499.5 },
      ],
      100000,
      DISPONIBLES
    );

    expect(filas.map((f) => f.auto)).toEqual([true, false]);
  });

  it("no manda filas sin impuesto elegido", () => {
    expect(impuestosParaGuardar([nuevaFilaImpuesto()], 100, DISPONIBLES)).toEqual([]);
  });
});

describe("grupoRepetido", () => {
  it("avisa si hay dos IVA en la misma factura", () => {
    const filas = [{ impuesto_id: "iva21" }, { impuesto_id: "iva105" }];
    expect(grupoRepetido(filas, DISPONIBLES)).toBe("IVA");
  });

  it("IVA + percepción está bien", () => {
    const filas = [{ impuesto_id: "iva21" }, { impuesto_id: "iibb" }, { impuesto_id: "" }];
    expect(grupoRepetido(filas, DISPONIBLES)).toBeNull();
  });
});

describe("etiquetas", () => {
  it("muestra la alícuota con coma decimal", () => {
    expect(formatoAlicuota(10.5)).toBe("10,5 %");
    expect(etiquetaImpuesto(IVA105)).toBe("IVA 10,5 · 10,5 %");
    expect(etiquetaImpuesto(IIBB)).toBe("Percepción IIBB");
  });
});
