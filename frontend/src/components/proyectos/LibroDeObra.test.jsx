// El libro de obra (Movimientos v2, variante 3a) calcula cosas que no se ven
// leyendo el JSX: el saldo acumulado va del movimiento más viejo al más nuevo
// aunque la planilla se muestre al revés, y cada día lleva su propio subtotal
// con signo.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import LibroDeObra, { MOVIMIENTOS_POR_PAGINA } from "./LibroDeObra";

const compra = {
  id: 1,
  descripcion: "Membrana asfáltica y perfilería",
  fecha: "2026-03-12",
  precio_total_ars: 2109183,
  precio_total_usd: 1687.35,
  tipo_factura: "factura_a",
  proveedor_id: 3,
  fase_id: 2,
  estado_pago: "pendiente",
  estado_envio: "entregado",
  detalle: [{ id: 1, producto_id: 7, cantidad: 12 }],
  notas: [{ id: 1, tipo: "nota_credito", monto_ars: 120000, monto_usd: 96 }],
  comprobantes: [{ id: 1, archivo_path: "x/factura.pdf" }],
};
const gasto = {
  id: 2,
  descripcion: "Flete y descarga en obra",
  fecha: "2026-03-09",
  monto_ars: 84500,
  monto_usd: 67.6,
  tipo_factura: "factura_b",
  fase_id: 2,
  comprobantes: [],
};
const cobro = {
  id: 3,
  descripcion: "Anticipo 40% — Etapa 2",
  fecha: "2026-03-05",
  // Cobrado en dólares; el libro es la caja, así que suma sus pesos congelados.
  monto_usd: 3200,
  monto_ars: 3200000,
  monto_neto_usd: 3050,
  monto_neto_ars: 3050000,
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
      compras={[compra]}
      gastos={[gasto]}
      cobros={[cobro]}
      nombreFase={() => "Techos — Etapa 2"}
      nombreProveedor={() => "Aluar Sur"}
      {...props}
    />
  );

describe("LibroDeObra", () => {
  it("acumula el saldo del movimiento más viejo al más nuevo, en pesos", () => {
    render_();

    // 05/03 cobro +3.050.000 -> 09/03 gasto -84.500 -> 12/03 compra -2.109.183
    const saldos = [...document.querySelectorAll(".libro__saldo-fila")].map(texto);
    expect(saldos).toEqual(["$ 856.317", "$ 2.965.500", "$ 3.050.000"]);
  });

  it("titula la columna de saldo en pesos", () => {
    render_();
    expect(screen.getByText("Saldo $")).toBeInTheDocument();
  });

  it("agrupa por día con el subtotal firmado de cada uno", () => {
    render_();

    expect(screen.getByText(/jueves 5 de marzo/i)).toBeInTheDocument();
    expect(
      screen.getByText((_, e) => texto(e) === "Subtotal del día +$ 3.050.000")
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, e) => texto(e) === "Subtotal del día −$ 84.500")
    ).toBeInTheDocument();
    expect(
      screen.getByText((_, e) => texto(e) === "Subtotal del día −$ 2.109.183")
    ).toBeInTheDocument();
  });

  it("nombra el tipo de cada fila en su ícono", () => {
    render_();

    const tipos = [...document.querySelectorAll(".libro__tipo")].map((e) =>
      e.getAttribute("aria-label")
    );
    expect(tipos).toEqual(["Compra", "Gasto", "Cobro"]);
  });

  it("pone fase y proveedor en el contexto, y la factura y los productos en la meta", () => {
    render_();

    const contexto = document.querySelectorAll(".libro__movimiento-contexto")[0];
    expect(contexto.textContent).toContain("Techos — Etapa 2");
    expect(contexto.textContent).toContain("Aluar Sur");
    expect(contexto.querySelector(".libro__meta").textContent).toBe("Factura A · 1 producto");
  });

  it("una compra impaga dice 'A pagar' y la antigüedad va en el título", () => {
    const hace = (dias) => {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() - dias);
      return fecha.toISOString().slice(0, 10);
    };
    render_({ compras: [{ ...compra, fecha: hace(12) }] });

    const badge = screen.getByRole("button", { name: /impaga hace 12 días/i });
    expect(badge).toHaveTextContent("A pagar");
  });

  it("desde los 90 días impaga la compra pasa a decir cuántos", () => {
    render_();
    // La compra de prueba es de marzo y quedó en "pendiente".
    expect(screen.getByText(/\d+ días sin pagar/)).toBeInTheDocument();
  });

  it("no marca como impaga una compra ya pagada", () => {
    render_({ compras: [{ ...compra, estado_pago: "pagado" }] });
    expect(screen.queryByText(/días sin pagar/)).not.toBeInTheDocument();
    expect(screen.queryByText("A pagar")).not.toBeInTheDocument();
  });

  it("muestra cada importe con su signo y en la moneda en que se cargó", () => {
    render_();

    const importes = [...document.querySelectorAll(".libro__importe")].map(texto);
    // Menos tipográfico (U+2212), no guion: mismo glifo que usa el Panel en
    // "Actividad reciente" -- ver signoTexto() en constants/tipoMovimiento.js.
    // El cobro va en dólares (su cifra de verdad); compra y gasto en pesos.
    expect(importes).toEqual(["−$ 2.109.183", "−$ 84.500", "+US$ 3.050"]);

    const monedas = [...document.querySelectorAll(".libro__moneda")].map((e) => e.textContent);
    expect(monedas).toEqual(["ARS", "ARS", "USD"]);
  });

  it("abre el detalle al hacer click en la fila", async () => {
    const onAbrirDetalle = vi.fn();
    render_({ onAbrirDetalle });

    await userEvent.click(screen.getByText("Flete y descarga en obra"));

    expect(onAbrirDetalle).toHaveBeenCalledWith("gasto", gasto);
  });

  it("marca la fila del movimiento que tiene el detalle abierto", () => {
    render_({ movimientoActivo: { tipo: "gasto", id: 2 } });

    const activas = document.querySelectorAll(".libro__fila--activa");
    expect(activas).toHaveLength(1);
    expect(activas[0]).toHaveTextContent("Flete y descarga en obra");
  });

  it("togglea el estado de pago sin abrir el detalle", async () => {
    const onAbrirDetalle = vi.fn();
    const onTogglePagoCompra = vi.fn();
    render_({ canManage: true, onAbrirDetalle, onTogglePagoCompra });

    await userEvent.click(screen.getByTitle(/click para marcar pagado/i));

    expect(onTogglePagoCompra).toHaveBeenCalledWith(compra);
    expect(onAbrirDetalle).not.toHaveBeenCalled();
  });

  it("muestra los estados con su texto aunque el usuario no pueda cambiarlos", () => {
    render_({ canManage: false });

    expect(screen.getByRole("button", { name: /impaga hace/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Entregado" })).toBeDisabled();
  });

  it("avisa el comprobante que falta y deja abrir el que está", () => {
    render_();

    // La compra tiene comprobante; el gasto y el cobro no.
    expect(screen.getAllByRole("button", { name: "Ver comprobante" })).toHaveLength(1);
    expect(screen.getAllByRole("img", { name: "Falta el comprobante" })).toHaveLength(2);
  });

  it("marca las notas de crédito en la fila", () => {
    render_();
    expect(screen.getByTitle("Notas de crédito")).toHaveTextContent("1 nota de crédito");
  });

  it("no ofrece acciones de admin a un usuario de lectura", () => {
    render_({ canManage: false });
    expect(screen.queryByTitle("Editar")).not.toBeInTheDocument();
    expect(screen.queryByTitle("Eliminar")).not.toBeInTheDocument();
  });

  it("pagina de a MOVIMIENTOS_POR_PAGINA y cuenta todos los resultados", async () => {
    const muchos = Array.from({ length: MOVIMIENTOS_POR_PAGINA + 5 }, (_, i) => ({
      ...gasto,
      id: 100 + i,
      descripcion: `Gasto ${i}`,
    }));
    render_({ compras: [], cobros: [], gastos: muchos });

    expect(screen.getByText(`${MOVIMIENTOS_POR_PAGINA + 5} resultados`)).toBeInTheDocument();
    expect(document.querySelectorAll(".libro__fila")).toHaveLength(MOVIMIENTOS_POR_PAGINA);

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(document.querySelectorAll(".libro__fila")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });
});
