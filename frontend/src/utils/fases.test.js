import { describe, it, expect } from "vitest";
import { describirFaseActual } from "./fases";

const fase = (orden, estado, nombre = `F${orden}`) => ({ orden, estado, nombre });

describe("describirFaseActual", () => {
  it("la actual es la primera en curso por orden, numerada por posición", () => {
    const fases = [fase(4, "por_empezar"), fase(1, "terminada"), fase(2, "en_curso", "Montaje")];
    expect(describirFaseActual(fases).texto).toBe("Fase 2 de 3 · Montaje");
  });

  it("sin ninguna en curso no inventa una actual", () => {
    expect(describirFaseActual([fase(1, "terminada"), fase(2, "auditada")]).texto).toBe(
      "2 fases terminadas"
    );
    expect(describirFaseActual([fase(1, "terminada"), fase(2, "por_empezar")]).texto).toBe(
      "2 fases, ninguna en curso"
    );
  });

  it("un proyecto sin fases no tiene fase actual", () => {
    expect(describirFaseActual([])).toBeNull();
  });
});
