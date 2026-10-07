import { describe, it, expect } from "vitest";
import { calcularSeguimiento, armarBandeja } from "./seguimiento";

const HOY = new Date("2026-10-07T12:00:00");
const haceDias = (n) => new Date(HOY.getTime() - n * 86400000).toISOString().slice(0, 10);

const compra = (id, dias, extra = {}) => ({
  id,
  descripcion: `Compra ${id}`,
  proveedor_id: 1,
  fecha: haceDias(dias),
  estado_pago: "pagado",
  estado_envio: "entregado",
  precio_total_ars: 1000,
  precio_total_usd: 1,
  comprobantes: [{ id: 1 }],
  ...extra,
});

const armar = (datos) =>
  armarBandeja(
    calcularSeguimiento({
      proyecto: { precio_acordado_usd: 0 },
      proveedores: [{ id: 1, nombre: "ClimaTotal" }],
      hoy: HOY,
      ...datos,
    }),
    { diasVencida: 90 }
  );

describe("armarBandeja", () => {
  it("una compra impaga de 90 días o más va a Vencido; una más nueva, a Pendiente", () => {
    const grupos = armar({
      compras: [
        compra("vieja", 120, { estado_pago: "pendiente" }),
        compra("nueva", 12, { estado_pago: "pendiente" }),
      ],
    });
    expect(grupos.map((g) => g.clave)).toEqual(["vencido", "pendiente"]);
    expect(grupos[0].items.map((i) => i.id)).toEqual(["vieja"]);
    expect(grupos[1].items[0]).toMatchObject({ id: "nueva", accion: "pagar", estado: "impaga" });
  });

  it("ordena lo pendiente por antigüedad, mezclando pagos y entregas", () => {
    const grupos = armar({
      compras: [
        compra("a", 3, { estado_pago: "pendiente" }),
        compra("b", 20, { estado_envio: "pedido" }),
      ],
    });
    expect(grupos[0].items.map((i) => [i.id, i.accion])).toEqual([
      ["b", "entregar"],
      ["a", "pagar"],
    ]);
  });

  it("el saldo del contrato va al final de lo pendiente con su acción de cobro", () => {
    const grupos = armar({
      proyecto: { precio_acordado_usd: 10000 },
      cobros: [{ id: 1, monto_neto_usd: 4000, monto_usd: 4000, comprobantes: [{ id: 1 }] }],
      compras: [compra("a", 3, { estado_pago: "pendiente" })],
    });
    const ultimo = grupos[0].items.at(-1);
    expect(ultimo).toMatchObject({ tipo: "cobranza", accion: "cobrar" });
    expect(ultimo.monto).toMatchObject({ monto: 6000, moneda: "usd" });
  });

  it("lo que no tiene comprobante y las fases estancadas van a Para revisar", () => {
    const grupos = armar({
      compras: [compra("c", 5, { comprobantes: [] })],
      gastos: [
        { id: "g", descripcion: "Flete", fecha: haceDias(2), monto_ars: 85000, monto_usd: 60 },
      ],
      fases: [
        { id: "f", nombre: "Montaje", estado: "en_curso", fecha_en_curso_desde: haceDias(40) },
      ],
    });
    expect(grupos.map((g) => g.clave)).toEqual(["revisar"]);
    expect(grupos[0].items.map((i) => [i.tipo, i.accion])).toEqual([
      ["fase", "verFase"],
      ["compra", "adjuntar"],
      ["gasto", "adjuntar"],
    ]);
  });

  it("sin nada pendiente no devuelve grupos", () => {
    expect(armar({ compras: [compra("ok", 3)] })).toEqual([]);
  });
});
