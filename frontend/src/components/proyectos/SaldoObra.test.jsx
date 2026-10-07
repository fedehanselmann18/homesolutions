import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import SaldoObra from "./SaldoObra";

const sinEspacios = (s) => s.replace(/\s/g, "");

const props = {
  compras: [
    { fecha: "2026-06-10", precio_total_ars: 1460000, precio_total_usd: 1000 },
    {
      fecha: "2026-09-10",
      estado_pago: "pendiente",
      precio_total_ars: 730000,
      precio_total_usd: 500,
    },
  ],
  gastos: [],
  cobros: [{ fecha: "2026-10-01", monto_neto_ars: 4380000, monto_neto_usd: 3000 }],
  precioAcordadoUsd: 6000,
};

const fila = (etiqueta) => sinEspacios(screen.getByText(etiqueta).parentElement.textContent);

describe("SaldoObra", () => {
  it("muestra el saldo en pesos con su cifra en dólares", () => {
    render(<SaldoObra {...props} />);
    const saldo = document.querySelector(".saldo-obra__saldo");
    expect(sinEspacios(saldo.textContent)).toBe("$2.190.000US$1.500");
  });

  it("cobrado contra el contrato, con lo que falta cobrar", () => {
    render(<SaldoObra {...props} />);
    expect(sinEspacios(document.querySelector(".saldo-obra__contrato").textContent)).toBe(
      "ContratoUS$6.000"
    );
    expect(fila("Cobrado")).toContain("US$3.000·50%");
    expect(fila("Cobrado")).toContain("FaltacobrarUS$3.000");
  });

  it("gastado con lo que falta pagar a proveedores", () => {
    render(<SaldoObra {...props} />);
    expect(fila("Gastado")).toContain("US$1.500·25%");
    expect(fila("Gastado")).toContain("US$500sinpagar");
    expect(document.querySelector(".saldo-obra__tramo--sin-pagar")).toBeInTheDocument();
  });

  it("si lo gastado pasa el contrato se marca en rojo y aparece la línea del contrato", () => {
    render(<SaldoObra {...props} precioAcordadoUsd={1000} />);
    expect(document.querySelector(".saldo-obra__tramo--pasado")).toBeInTheDocument();
    expect(document.querySelectorAll(".saldo-obra__marca")).toHaveLength(2);
  });

  it("sin precio acordado lo dice y no muestra porcentajes", () => {
    render(<SaldoObra {...props} precioAcordadoUsd={0} />);
    expect(screen.getByText("Sin precio acordado")).toBeInTheDocument();
    expect(fila("Cobrado")).not.toContain("%");
  });
});
