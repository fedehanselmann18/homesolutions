import { describe, it, expect } from "vitest";
import {
  formatMoneda,
  formatMonedaCorta,
  formatFecha,
  formatBytes,
  formatUltimaActividad,
} from "./formato";

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

describe("formatBytes", () => {
  it("usa B, KB o MB según el tamaño", () => {
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });
});

describe("formatUltimaActividad", () => {
  it("devuelve 'Nunca' si no hay valor", () => {
    expect(formatUltimaActividad(null)).toBe("Nunca");
    expect(formatUltimaActividad(undefined)).toBe("Nunca");
  });

  it("devuelve 'Ahora' para un instante de hace segundos", () => {
    expect(formatUltimaActividad(new Date().toISOString())).toBe("Ahora");
  });

  it("devuelve minutos para menos de una hora", () => {
    const hace10min = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    expect(formatUltimaActividad(hace10min)).toBe("Hace 10 min");
  });

  it("devuelve horas para menos de un día", () => {
    const hace3h = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(formatUltimaActividad(hace3h)).toBe("Hace 3 h");
  });

  it("cae a fecha+hora completa pasado un día", () => {
    const hace2dias = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    // No repite formatFechaHora acá (se prueba aparte): solo confirma que
    // NO usa el formato relativo pasado el día.
    expect(formatUltimaActividad(hace2dias)).not.toMatch(/Hace|Ahora|Nunca/);
  });
});
