import { describe, it, expect } from "vitest";
import { formatMoneda, formatMonedaCorta, formatFecha } from "./formato";

// Ver comentario en formatUtils.test.js: normalizamos espacios que Intl
// puede insertar entre el símbolo y el número según el motor/ICU.
const sinEspacios = (s) => s.replace(/\s/g, "");

describe("formatMoneda", () => {
  it("formatea con símbolo de pesos y sin decimales", () => {
    expect(sinEspacios(formatMoneda(250000))).toBe("$250.000");
  });
});

describe("formatMonedaCorta", () => {
  it("usa notación compacta para montos grandes", () => {
    // Intl con notation "compact" en es-AR devuelve algo tipo "$3,9 M"
    const resultado = formatMonedaCorta(3900000);
    expect(resultado).toMatch(/M/);
  });
});

describe("formatFecha", () => {
  it("formatea una fecha ISO como dd/mm/aaaa sin corrimiento de timezone", () => {
    expect(formatFecha("2026-07-31")).toBe("31/07/2026");
  });

  it("devuelve string vacío si no hay fecha", () => {
    expect(formatFecha(null)).toBe("");
    expect(formatFecha(undefined)).toBe("");
    expect(formatFecha("")).toBe("");
  });
});
