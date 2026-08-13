import { describe, it, expect } from "vitest";
import { obtenerMensajeError, obtenerDetalleBackend } from "./errorHandling";

describe("obtenerMensajeError", () => {
  it("usa el detail del backend cuando es un string", () => {
    const error = { response: { status: 400, data: { detail: "Ese proveedor no existe" } } };
    expect(obtenerMensajeError(error)).toBe("Ese proveedor no existe");
  });

  it("da un mensaje genérico legible cuando detail es un array (422 sin traducir)", () => {
    const error = {
      response: {
        status: 422,
        data: { detail: [{ loc: ["body", "password"], msg: "field required", type: "missing" }] },
      },
    };
    expect(obtenerMensajeError(error)).toBe("Revisá los datos ingresados.");
  });

  it("da el mensaje de sin conexión cuando no hay response (error de red)", () => {
    const error = { message: "Network Error" };
    expect(obtenerMensajeError(error)).toBe(
      "No se pudo conectar con el servidor. Revisá tu conexión."
    );
  });

  it("usa el fallback de 401 cuando no hay detail usable", () => {
    const error = { response: { status: 401, data: {} } };
    expect(obtenerMensajeError(error)).toBe("Tu sesión expiró o no es válida.");
  });

  it("usa el fallback de 403 cuando no hay detail usable", () => {
    const error = { response: { status: 403, data: {} } };
    expect(obtenerMensajeError(error)).toBe("No tenés permisos para hacer esto.");
  });

  it("usa el fallback de 404 cuando no hay detail usable", () => {
    const error = { response: { status: 404, data: {} } };
    expect(obtenerMensajeError(error)).toBe("No se encontró lo que buscabas.");
  });

  it("usa el fallback de 429 cuando no hay detail usable", () => {
    const error = { response: { status: 429, data: {} } };
    expect(obtenerMensajeError(error)).toBe(
      "Demasiados intentos. Esperá un momento y probá de nuevo."
    );
  });

  it("usa el fallback genérico para un 500 sin detail", () => {
    const error = { response: { status: 500, data: {} } };
    expect(obtenerMensajeError(error)).toBe("Ocurrió un error inesperado. Intentá de nuevo.");
  });

  it("nunca devuelve el status crudo ni el texto de axios", () => {
    const error = {
      message: "Request failed with status code 401",
      response: { status: 401, data: {} },
    };
    const mensaje = obtenerMensajeError(error);
    expect(mensaje).not.toMatch(/401/);
    expect(mensaje).not.toMatch(/request failed/i);
  });

  it("ignora un detail vacío o solo espacios y usa el fallback por status", () => {
    const error = { response: { status: 404, data: { detail: "   " } } };
    expect(obtenerMensajeError(error)).toBe("No se encontró lo que buscabas.");
  });
});

describe("obtenerDetalleBackend", () => {
  it("devuelve el detail cuando es un string usable", () => {
    const error = { response: { data: { detail: "Una o más categorías no existen" } } };
    expect(obtenerDetalleBackend(error)).toBe("Una o más categorías no existen");
  });

  it("devuelve null cuando el detail es un array", () => {
    const error = { response: { data: { detail: [{ msg: "x" }] } } };
    expect(obtenerDetalleBackend(error)).toBeNull();
  });

  it("devuelve null cuando no hay response", () => {
    expect(obtenerDetalleBackend({ message: "Network Error" })).toBeNull();
  });

  it("devuelve null cuando no hay detail", () => {
    expect(obtenerDetalleBackend({ response: { data: {} } })).toBeNull();
  });
});
