import { describe, it, expect } from "vitest";
import { formatearFechaLarga } from "./fechaUtils";

describe("formatearFechaLarga", () => {
  it("parsea formato dd/mm/aaaa", () => {
    expect(formatearFechaLarga("05/03/2026")).toBe("5 de marzo de 2026");
  });

  it("parsea formato ISO aaaa-mm-dd (típico de FastAPI/Postgres)", () => {
    expect(formatearFechaLarga("2026-03-05")).toBe("5 de marzo de 2026");
  });

  it("parsea ISO con hora incluida (T00:00:00)", () => {
    expect(formatearFechaLarga("2026-03-05T00:00:00")).toBe("5 de marzo de 2026");
  });

  it("acepta un objeto Date directamente", () => {
    const fecha = new Date(2026, 6, 31); // 31 de julio de 2026
    expect(formatearFechaLarga(fecha)).toBe("31 de julio de 2026");
  });

  it("devuelve 'Fecha inválida' para strings sin formato reconocible", () => {
    expect(formatearFechaLarga("no es una fecha")).toBe("Fecha inválida");
  });

  it("devuelve 'Fecha inválida' para undefined/null", () => {
    expect(formatearFechaLarga(undefined)).toBe("Fecha inválida");
    expect(formatearFechaLarga(null)).toBe("Fecha inválida");
  });
});
