// Filas de impuesto de compra y nota: el IVA con alícuota se calcula solo
// sobre el neto, se puede sobrescribir y volver al calculado, y dos IVA en
// la misma factura avisan.
import { describe, it, expect } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FilasImpuestos } from "./FilasImpuestos";
import { nuevaFilaImpuesto } from "../../utils/impuestos";

const DISPONIBLES = [
  { id: "iva21", nombre: "IVA 21", alicuota: 21, grupo: "IVA" },
  { id: "iva105", nombre: "IVA 10,5", alicuota: 10.5, grupo: "IVA" },
  { id: "iibb", nombre: "Percepción IIBB", alicuota: null, grupo: null },
];

function Prueba({ base, filasIniciales = [nuevaFilaImpuesto()] }) {
  const [filas, setFilas] = useState(filasIniciales);
  return (
    <FilasImpuestos filas={filas} onCambiar={setFilas} base={base} disponibles={DISPONIBLES} />
  );
}

const montos = () => screen.getAllByLabelText("Monto del impuesto").map((i) => i.value);

describe("FilasImpuestos", () => {
  it("elegir IVA 21 completa el monto sobre el neto", async () => {
    render(<Prueba base={100000} />);

    await userEvent.selectOptions(screen.getByLabelText("Impuesto"), "iva21");

    expect(montos()).toEqual(["21000"]);
    expect(screen.getByText(/21 % sobre/)).toBeInTheDocument();
  });

  it("sigue al neto si cambia", async () => {
    const { rerender } = render(<Prueba base={100000} />);
    await userEvent.selectOptions(screen.getByLabelText("Impuesto"), "iva105");
    rerender(<Prueba base={200000} />);

    expect(montos()).toEqual(["21000"]);
  });

  it("tipeado a mano queda fijo y se puede volver al calculado", async () => {
    render(<Prueba base={100000} />);
    await userEvent.selectOptions(screen.getByLabelText("Impuesto"), "iva21");

    const input = screen.getByLabelText("Monto del impuesto");
    await userEvent.clear(input);
    await userEvent.type(input, "20999.5");
    expect(montos()).toEqual(["20999.5"]);
    expect(screen.getByText(/A mano\. Calculado:/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "usar el calculado" }));
    expect(montos()).toEqual(["21000"]);
  });

  it("dos IVA en la misma factura avisan", () => {
    render(
      <Prueba
        base={100000}
        filasIniciales={[
          nuevaFilaImpuesto({ impuesto_id: "iva21", auto: true }),
          nuevaFilaImpuesto({ impuesto_id: "iva105", auto: true }),
        ]}
      />
    );

    expect(screen.getByText(/una sola alícuota de IVA/)).toBeInTheDocument();
  });

  it("una percepción sin alícuota se escribe a mano", async () => {
    render(<Prueba base={100000} />);
    await userEvent.selectOptions(screen.getByLabelText("Impuesto"), "iibb");
    await userEvent.type(screen.getByLabelText("Monto del impuesto"), "3000");

    expect(montos()).toEqual(["3000"]);
    expect(screen.queryByText(/sobre/)).toBeNull();
  });
});
