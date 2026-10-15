import { describe, it, expect } from "vitest";
import { coincideBusquedaProveedor } from "./proveedores";

const polytemp = {
  nombre: "POLYTEMP",
  cuit: "30-71234567-8",
  telefono: "011 4789-1200",
  email: "ventas@polytemp.com.ar",
  direccion: "Av. Gral. Paz 5400, San Martín",
};

describe("coincideBusquedaProveedor", () => {
  it("sin texto coinciden todos", () => {
    expect(coincideBusquedaProveedor(polytemp, "  ")).toBe(true);
  });

  it("busca por nombre sin importar mayúsculas", () => {
    expect(coincideBusquedaProveedor(polytemp, "poly")).toBe(true);
    expect(coincideBusquedaProveedor(polytemp, "bgh")).toBe(false);
  });

  it("busca por los datos de la ficha: CUIT, teléfono, email y dirección", () => {
    expect(coincideBusquedaProveedor(polytemp, "30-7123")).toBe(true);
    expect(coincideBusquedaProveedor(polytemp, "4789-1200")).toBe(true);
    expect(coincideBusquedaProveedor(polytemp, "ventas@")).toBe(true);
    expect(coincideBusquedaProveedor(polytemp, "san martín")).toBe(true);
  });

  it("CUIT y teléfono coinciden aunque se escriban sin guiones ni espacios", () => {
    expect(coincideBusquedaProveedor(polytemp, "30712345678")).toBe(true);
    expect(coincideBusquedaProveedor(polytemp, "01147891200")).toBe(true);
    expect(coincideBusquedaProveedor(polytemp, "99999")).toBe(false);
  });

  it("un proveedor sin datos opcionales sólo coincide por nombre", () => {
    const carlos = { nombre: "CARLOS", cuit: null, telefono: null, email: null, direccion: null };
    expect(coincideBusquedaProveedor(carlos, "car")).toBe(true);
    expect(coincideBusquedaProveedor(carlos, "30")).toBe(false);
  });
});
