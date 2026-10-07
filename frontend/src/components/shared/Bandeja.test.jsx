import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

import { Bandeja } from "./Bandeja";

// `foco` es el contrato entre el "Para resolver" del Panel y esta lista: el
// Panel navega con ?foco=<key> y acá esa fila tiene que quedar marcada y
// traerse a la vista. Sin eso el usuario cae en una lista larga sin saber
// cuál de todas era la que tocó.
const item = (key, extra = {}) => ({
  key,
  tipo: "compra",
  id: key,
  accion: "pagar",
  titulo: `Compra ${key}`,
  subtitulo: "Aluar · compra",
  estado: "impaga",
  monto: { monto: 1000, montoOtra: null, moneda: "ars" },
  dias: 10,
  ...extra,
});

const grupos = [
  { clave: "pendiente", label: "Pendiente", items: [item("pagar-a"), item("pagar-b")] },
];

const renderBandeja = (props) =>
  render(
    <Bandeja
      grupos={grupos}
      canManage
      ocupado={null}
      onAbrir={() => {}}
      onEjecutar={() => {}}
      mensajeVacio="Nada pendiente."
      {...props}
    />
  );

describe("Bandeja", () => {
  it("sin foco no marca ninguna fila", () => {
    const { container } = renderBandeja();
    expect(container.querySelectorAll(".bandeja__item--foco")).toHaveLength(0);
  });

  it("con foco marca sólo la fila de esa key y la trae a la vista", () => {
    // jsdom no implementa scrollIntoView: se stubea para poder verificar que
    // se llamó sobre la fila correcta.
    const scrollIntoView = vi.fn();
    Element.prototype.scrollIntoView = scrollIntoView;

    const { container } = renderBandeja({ foco: "pagar-b" });

    const marcadas = container.querySelectorAll(".bandeja__item--foco");
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0].textContent).toContain("Compra pagar-b");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("un foco que no matchea ninguna fila no rompe ni marca nada", () => {
    const { container } = renderBandeja({ foco: "pagar-inexistente" });
    expect(container.querySelectorAll(".bandeja__item--foco")).toHaveLength(0);
  });
});
