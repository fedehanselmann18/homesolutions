import { describe, it, expect } from "vitest";

import {
  condicionBloqueada,
  leerDias,
  nombreSugerido,
  pendienteCompra,
  describirDias,
  diasEntre,
  diasVencida,
  dividir,
  montoPendiente,
  previsualizarPlazos,
  sumarDias,
} from "./plazos";

describe("fechas", () => {
  it("suma días sin correrse por zona horaria", () => {
    expect(sumarDias("2026-03-01", 30)).toBe("2026-03-31");
    expect(sumarDias("2026-01-31", 30)).toBe("2026-03-02");
    expect(sumarDias("2026-12-15", 30)).toBe("2027-01-14");
  });

  it("cuenta días entre dos fechas", () => {
    expect(diasEntre("2026-03-01", "2026-03-31")).toBe(30);
    expect(diasEntre("2026-03-31", "2026-03-01")).toBe(-30);
  });
});

describe("dividir (igual que el backend)", () => {
  it("partes iguales, el último absorbe el redondeo", () => {
    expect(dividir(1000000, 2)).toEqual([500000, 500000]);
    expect(dividir(100, 3)).toEqual([33.33, 33.33, 33.34]);
    expect(dividir(121000, 3)).toEqual([40333.33, 40333.33, 40333.34]);
  });
});

describe("previsualizarPlazos", () => {
  it("30/60 desde la fecha de la factura", () => {
    expect(previsualizarPlazos([30, 60], "2026-03-01", 1000000)).toEqual([
      { dias: 30, fecha_vencimiento: "2026-03-31", monto: 500000 },
      { dias: 60, fecha_vencimiento: "2026-04-30", monto: 500000 },
    ]);
  });

  it("contado es un solo pago el mismo día", () => {
    expect(previsualizarPlazos([], "2026-03-01", 500)).toEqual([
      { dias: 0, fecha_vencimiento: "2026-03-01", monto: 500 },
    ]);
  });
});

describe("describirDias", () => {
  it("dice los días como los dice Agus", () => {
    expect(describirDias([])).toBe("Un pago, el día de la factura");
    expect(describirDias([30])).toBe("A 30 días");
    expect(describirDias([30, 60, 90])).toBe("A 30, 60 y 90 días");
  });
});

describe("vencimientos", () => {
  const compra = {
    plazos: [
      { numero: 1, fecha_vencimiento: "2026-03-31", monto: 500000, pagado: true },
      { numero: 2, fecha_vencimiento: "2026-04-30", monto: 300000, pagado: false },
      { numero: 3, fecha_vencimiento: "2026-05-30", monto: 200000, pagado: false },
    ],
  };

  it("vencida desde el plazo pendiente más viejo", () => {
    expect(diasVencida(compra, "2026-04-30")).toBeNull(); // vence hoy: todavía no
    expect(diasVencida(compra, "2026-05-10")).toBe(10);
    expect(diasVencida(compra, "2026-06-09")).toBe(40);
  });

  it("un plazo pagado no cuenta como vencido", () => {
    expect(diasVencida(compra, "2026-04-15")).toBeNull();
  });

  it("lo pendiente suma sólo los plazos sin pagar", () => {
    expect(montoPendiente(compra)).toBe(500000);
  });
});

describe("condiciones", () => {
  it("lee los días como los escribe Agus", () => {
    expect(leerDias("30/60/90")).toEqual([30, 60, 90]);
    expect(leerDias("60, 30 30")).toEqual([30, 60]);
    expect(leerDias("")).toEqual([]);
    expect(leerDias("30/abc")).toBeNull();
    expect(leerDias("0")).toBeNull();
    expect(nombreSugerido([45, 90])).toBe("45/90 días");
  });

  it("la condición se bloquea con pagos, salvo que se pase de Pagado a A pagar", () => {
    const pagado = { estado_pago: "pagado", plazos: [{ pagado: true }] };
    const parcial = { estado_pago: "pendiente", plazos: [{ pagado: true }, { pagado: false }] };
    expect(condicionBloqueada(pagado, "pagado")).toBe(true);
    expect(condicionBloqueada(pagado, "pendiente")).toBe(false);
    expect(condicionBloqueada(parcial, "pendiente")).toBe(true);
    expect(condicionBloqueada({ plazos: [{ pagado: false }] }, "pendiente")).toBe(false);
  });

  it("lo pendiente de una compra en dólares usa su cotización", () => {
    const compra = {
      cotizacion_dolar: 1000,
      plazos: [
        { monto: 600, pagado: true },
        { monto: 400, pagado: false },
      ],
    };
    expect(pendienteCompra(compra, "ars")).toBe(400);
    expect(pendienteCompra(compra, "usd")).toBe(0.4);
  });
});
