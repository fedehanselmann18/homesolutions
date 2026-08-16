// El libro de obra (dirección 3b del handoff en claudedesign/) calcula cosas
// que no se ven leyendo el JSX: el saldo acumulado va del movimiento más viejo
// al más nuevo aunque la planilla se muestre al revés, y cada día lleva su
// propio subtotal con signo.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LibroDeObra from "./LibroDeObra";

const compra = {
  id: 1,
  descripcion: "Membrana asfáltica y perfilería",
  fecha: "2026-03-12",
  precio_total: 2109183,
  tipo_factura: "factura_a",
  proveedor_id: 3,
  fase_id: 2,
  estado_pago: "pendiente",
  estado_envio: "entregado",
  detalle: [{ id: 1, producto_id: 7, cantidad: 12 }],
  notas: [{ id: 1, tipo: "nota_credito", monto: 120000 }],
  comprobantes: [{ id: 1, archivo_path: "x/factura.pdf" }],
};
const gasto = {
  id: 2,
  descripcion: "Flete y descarga en obra",
  fecha: "2026-03-09",
  monto: 84500,
  tipo_factura: "factura_b",
  fase_id: 2,
  comprobantes: [],
};
const cobro = {
  id: 3,
  descripcion: "Anticipo 40% — Etapa 2",
  fecha: "2026-03-05",
  monto: 3200000,
  monto_neto: 3050000,
  tipo_factura: "factura_a",
  notas: [],
  comprobantes: [],
};

// Intl.NumberFormat("es-AR") separa el símbolo con un espacio duro (U+00A0),
// que no es el espacio que se escribe en un literal del test.
const texto = (nodo) => nodo.textContent.replace(/\u00a0/g, " ");

const render_ = (props = {}) =>
  render(
    <LibroDeObra
      titulo="Movimientos — Olleros"
      compras={[compra]}
      gastos={[gasto]}
      cobros={[cobro]}
      nombreFase={() => "Techos — Etapa 2"}
      nombreProveedor={() => "Aluar Sur"}
      {...props}
    />
  );

describe("LibroDeObra", () => {
  it("acumula el saldo del movimiento más viejo al más nuevo", () => {
    render_();

    // 05/03 cobro +3.050.000 -> 09/03 gasto -84.500 -> 12/03 compra -2.109.183
    const saldos = [...document.querySelectorAll(".libro__saldo-fila")].map(texto);
    expect(saldos).toEqual(["$ 856.317", "$ 2.965.500", "$ 3.050.000"]);

    expect(texto(document.querySelector(".libro__saldo-monto"))).toBe("$ 856.317");
  });

  it("agrupa por día con el subtotal firmado de cada uno", () => {
    render_();

    expect(screen.getByText(/jueves 05\/03\/2026/i)).toBeInTheDocument();
    expect(
      screen.getByText((_, e) => texto(e) === "Subtotal del día +$ 3.050.000")
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, e) => texto(e) === "Subtotal del día -$ 84.500")
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, e) => texto(e) === "Subtotal del día -$ 2.109.183")
    ).toBeInTheDocument();
  });

  it("etiqueta cada fila con su tipo de movimiento", () => {
    render_();

    const tipos = [...document.querySelectorAll(".libro__tipo")].map((e) => e.textContent);
    expect(tipos).toEqual(["Compra", "Gasto", "Cobro"]);
  });

  it("no repite el tipo en el subtítulo, que ahora es su propia columna", () => {
    render_();

    const contextos = [...document.querySelectorAll(".libro__movimiento-contexto")].map(
      (e) => e.textContent
    );
    expect(contextos[0]).not.toMatch(/^Compra ·/);
    expect(contextos[0]).toContain("Aluar Sur · Techos — Etapa 2 · Factura A · 1 producto");
  });

  it("avisa hace cuánto está impaga una compra", () => {
    render_();

    // La compra de prueba quedó en "pendiente", así que la fila tiene que
    // decir hace cuántos días -- es lo que alimenta el KPI de "sin pagar".
    expect(screen.getByText(/\d+ días sin pagar/)).toBeInTheDocument();
  });

  it("no marca como impaga una compra ya pagada", () => {
    render_({ compras: [{ ...compra, estado_pago: "pagado" }] });
    expect(screen.queryByText(/días sin pagar/)).not.toBeInTheDocument();
  });

  it("muestra los importes con el signo según entren o salgan", () => {
    render_();

    const importes = [...document.querySelectorAll(".libro__importe")].map(texto);
    expect(importes).toEqual(["-$ 2.109.183", "-$ 84.500", "+$ 3.050.000"]);
  });

  it("abre el detalle al hacer click en la fila", async () => {
    const onAbrirDetalle = vi.fn();
    render_({ onAbrirDetalle });

    await userEvent.click(screen.getByText("Flete y descarga en obra"));

    expect(onAbrirDetalle).toHaveBeenCalledWith("gasto", gasto);
  });

  it("togglea el estado de pago sin abrir el detalle", async () => {
    const onAbrirDetalle = vi.fn();
    const onTogglePagoCompra = vi.fn();
    render_({ canManage: true, onAbrirDetalle, onTogglePagoCompra });

    await userEvent.click(screen.getByTitle(/pago pendiente/i));

    expect(onTogglePagoCompra).toHaveBeenCalledWith(compra);
    expect(onAbrirDetalle).not.toHaveBeenCalled();
  });

  it("marca las notas de crédito en la fila", () => {
    render_();
    expect(screen.getByTitle("Notas de crédito")).toBeInTheDocument();
  });

  it("no ofrece acciones de admin a un usuario de lectura", () => {
    render_({ canManage: false });
    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Eliminar")).not.toBeInTheDocument();
  });
});
