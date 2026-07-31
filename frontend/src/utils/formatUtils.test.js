import { describe, it, expect } from "vitest";
import { formatearMoneda, formatearEstado } from "./formatUtils";

// Intl.NumberFormat("es-AR", ...) puede insertar un espacio (a veces un
// espacio angosto no separable) entre el símbolo "$" y el número según la
// versión de ICU del motor -- normalizamos esos espacios para no acoplar el
// test a un detalle de formato que no es relevante para el negocio.
const sinEspacios = (s) => s.replace(/\s/g, "");

describe("formatearMoneda", () => {
  it("formatea un número como pesos argentinos sin decimales", () => {
    expect(sinEspacios(formatearMoneda(150000))).toBe("$150.000");
  });

  it("formatea cero", () => {
    expect(sinEspacios(formatearMoneda(0))).toBe("$0");
  });

  it("formatea negativos (ej. un ajuste por nota de crédito)", () => {
    expect(sinEspacios(formatearMoneda(-5000))).toBe("-$5.000");
  });
});

describe("formatearEstado", () => {
  it("traduce los estados conocidos a texto legible", () => {
    expect(formatearEstado("en_curso")).toBe("En curso");
    expect(formatearEstado("terminado")).toBe("Terminado");
    expect(formatearEstado("a_iniciar")).toBe("A iniciar");
  });

  it("devuelve el valor tal cual si el estado no está mapeado", () => {
    expect(formatearEstado("estado_raro")).toBe("estado_raro");
  });
});
