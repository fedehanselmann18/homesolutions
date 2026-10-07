import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SaldoObra from "./SaldoObra";

const sinEspacios = (s) => s.replace(/\s/g, "");

const props = {
  hoy: new Date(2026, 9, 7),
  compras: [{ fecha: "2026-06-10", precio_total_ars: 1460000, precio_total_usd: 1000 }],
  gastos: [],
  cobros: [{ fecha: "2026-10-01", monto_neto_ars: 4380000, monto_neto_usd: 3000 }],
};

describe("SaldoObra", () => {
  it("muestra el saldo en pesos con su cifra en dólares", () => {
    render(<SaldoObra {...props} />);
    const saldo = document.querySelector(".saldo-obra__saldo");
    expect(sinEspacios(saldo.textContent)).toBe("$2.920.000US$2.000");
  });

  it("cobrado en dólares y gastado en pesos, del período", () => {
    render(<SaldoObra {...props} />);
    const resumen = sinEspacios(document.querySelector(".saldo-obra__resumen").textContent);
    expect(resumen).toContain("CobradoUS$3.000·Gastado$1.460.000(≈US$1.000)");
    expect(document.querySelectorAll(".saldo-obra__mes")).toHaveLength(5);
  });

  it("el selector cambia la cantidad de meses del gráfico", () => {
    render(<SaldoObra {...props} />);
    fireEvent.change(screen.getByLabelText("Período del gráfico"), { target: { value: "3" } });
    expect(document.querySelectorAll(".saldo-obra__mes")).toHaveLength(3);
    // La compra de junio queda afuera del período; el saldo, no.
    expect(sinEspacios(document.querySelector(".saldo-obra__resumen").textContent)).toContain(
      "Gastado$0"
    );
    expect(screen.getByText(/Últimos 3 meses/, { selector: "label" })).toBeInTheDocument();
  });

  it("sin movimientos en el período lo dice sobre el gráfico", () => {
    render(<SaldoObra hoy={props.hoy} compras={[]} gastos={[]} cobros={[]} />);
    expect(screen.getByText("Sin movimientos en los últimos 5 meses")).toBeInTheDocument();
  });
});
