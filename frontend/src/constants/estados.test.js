import { describe, it, expect } from "vitest";
import { getEstado, getEstadoLabel, ESTADO_LABELS } from "./estados";
import { RELLENO, TINTA_MUTED } from "./colores";

const FORMA = ["color", "bg", "fg", "label", "icono"];

describe("estados", () => {
  it("cada estado de proyecto y de fase trae la forma completa", () => {
    const estados = [
      ...["a_iniciar", "en_curso", "terminado"].map(getEstado),
      ...Object.keys(ESTADO_LABELS).map(getEstadoLabel),
    ];
    for (const estado of estados) {
      for (const clave of FORMA) expect(estado[clave]).toBeTruthy();
    }
  });

  it("un estado desconocido sale con el par neutro y no como string pelado", () => {
    for (const fn of [getEstado, getEstadoLabel]) {
      const estado = fn("inventado");
      expect(estado).toEqual({
        color: TINTA_MUTED,
        bg: RELLENO,
        fg: TINTA_MUTED,
        label: "inventado",
        icono: null,
      });
    }
  });
});
