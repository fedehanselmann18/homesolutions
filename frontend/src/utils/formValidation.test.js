import { describe, it, expect } from "vitest";
import { avisoFaltantes } from "./formValidation";

describe("avisoFaltantes", () => {
  it("cuenta y nombra los campos que faltan, en singular o plural", () => {
    expect(avisoFaltantes([])).toBeNull();
    expect(avisoFaltantes(["Descripción"])).toBe("Falta 1 campo: Descripción");
    expect(avisoFaltantes(["Monto", "Fecha"])).toBe("Faltan 2 campos: Monto, Fecha");
  });
});
