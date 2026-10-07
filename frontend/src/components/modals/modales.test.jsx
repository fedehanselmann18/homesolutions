// Smoke test de los 12 modales tras el rediseño (direcciones 3a y 5c del
// handoff en claudedesign/): que cada uno monte con datos realistas y que el
// desglose del total -- neto, impuestos, notas de crédito -- siga estando a la
// vista en el modal de lectura, que es lo que no se puede perder.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../context/useAuth", () => ({
  default: () => ({ usuario: { rol: "admin" } }),
  useAuth: () => ({ usuario: { rol: "admin" } }),
}));
vi.mock("../../context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("../../hooks/useExtraccionIA", () => ({
  useExtraccionIA: () => ({ extraer: vi.fn(), extrayendo: false }),
}));
// La sugerencia del dólar del día (useCotizacionDia): una fija, sin servidor.
vi.mock("../../hooks/queries", () => ({
  useUltimaCotizacion: () => ({
    isLoading: false,
    data: { id: "c1", fecha: "2026-03-01", tipo: "blue", valor: 1250 },
  }),
}));

import ModalCompra from "./ModalCompra";
import ModalGasto from "./ModalGasto";
import ModalCobro from "./ModalCobro";
import ModalProveedor from "./ModalProveedor";
import ModalFase from "./ModalFase";
import ModalProducto from "./ModalProducto";
import ModalProyecto from "./ModalProyecto";
import ModalNota from "./ModalNota";
import ModalConfirmar from "./ModalConfirmar";
import ModalDetalleCompra from "./ModalDetalleCompra";
import ModalDetalleGasto from "./ModalDetalleGasto";
import ModalDetalleCobro from "./ModalDetalleCobro";

const noop = () => {};

const compra = {
  id: 1,
  descripcion: "Membrana asfáltica",
  fecha: "2026-03-12",
  tipo_factura: "factura_a",
  condicion_pago: "cuenta_corriente",
  estado_pago: "pendiente",
  estado_envio: "entregado",
  // Doble moneda: pesos tipeados, USD congelado por el backend a 1250 (la nota
  // de crédito, de otro día, con su propio dólar a 1500).
  precio_neto_ars: 1842300,
  precio_neto_usd: 1473.84,
  precio_total_ars: 2109183,
  precio_total_usd: 1702.35,
  cotizacion_dolar: 1250,
  tipo_cambio: "blue",
  proveedor_id: 3,
  fase_id: 2,
  detalle: [{ id: 1, producto_id: 7, cantidad: 12, precio_unitario: 107000 }],
  impuestos_aplicados: [{ id: 1, impuesto_id: 1, monto: 386883, impuesto: { nombre: "IVA 21%" } }],
  notas: [
    {
      id: 1,
      tipo: "nota_credito",
      monto_ars: 120000,
      monto_usd: 80,
      cotizacion_dolar: 1500,
      tipo_cambio: "blue",
      descripcion: "Devolución 2 rollos",
      origen: "devolucion_producto",
      fecha: "2026-03-14",
      detalles: [{ detalle_compra_id: 1, cantidad: 2 }],
    },
  ],
  comprobantes: [{ id: 1, archivo_path: "x/factura-A-0012.pdf" }],
};
const gasto = {
  id: 2,
  descripcion: "Flete y descarga",
  fecha: "2026-03-09",
  monto_ars: 84500,
  monto_usd: 67.6,
  cotizacion_dolar: 1250,
  tipo_cambio: "blue",
  tipo_factura: "factura_b",
  categorias: [{ id: 1, nombre: "Logística" }],
  comprobantes: [],
};
const cobro = {
  id: 3,
  descripcion: "Anticipo 40%",
  fecha: "2026-03-05",
  // Se cobra en dólares: 3200 USD a 1000, con una nota de crédito de 150 USD.
  monto_usd: 3200,
  monto_ars: 3200000,
  monto_neto_usd: 3050,
  monto_neto_ars: 3050000,
  cotizacion_dolar: 1000,
  tipo_cambio: "blue",
  tipo_factura: "factura_a",
  notas: [
    {
      id: 2,
      tipo: "nota_credito",
      monto_usd: 150,
      monto_ars: 150000,
      cotizacion_dolar: 1000,
      tipo_cambio: "blue",
      descripcion: "Ajuste",
    },
  ],
  comprobantes: [],
};
const productos = [
  {
    id: 7,
    marca: "Rheem",
    modelo: "Membrana 4mm",
    proveedor_id: 3,
    precio: 107000,
    tipo: "material",
  },
];

describe("smoke de modales", () => {
  const casos = [
    ["ModalCompra nuevo", () => <ModalCompra onGuardar={noop} onCerrar={noop} />],
    [
      "ModalCompra edición",
      () => (
        <ModalCompra
          compra={compra}
          productosDisponibles={productos}
          onGuardar={noop}
          onCerrar={noop}
        />
      ),
    ],
    ["ModalGasto nuevo", () => <ModalGasto onGuardar={noop} onCerrar={noop} />],
    ["ModalGasto edición", () => <ModalGasto gasto={gasto} onGuardar={noop} onCerrar={noop} />],
    [
      "ModalCobro nuevo",
      () => (
        <ModalCobro
          proyectoActual={{ id: 1, nombre: "Olleros" }}
          onGuardar={noop}
          onCerrar={noop}
        />
      ),
    ],
    ["ModalCobro edición", () => <ModalCobro cobro={cobro} onGuardar={noop} onCerrar={noop} />],
    ["ModalProveedor", () => <ModalProveedor onGuardar={noop} onCerrar={noop} />],
    ["ModalFase", () => <ModalFase onGuardar={noop} onCerrar={noop} />],
    [
      "ModalProducto",
      () => (
        <ModalProducto
          proveedor={{ id: 3, nombre: "Aluar Sur" }}
          onGuardar={noop}
          onCerrar={noop}
        />
      ),
    ],
    ["ModalProyecto", () => <ModalProyecto onGuardar={noop} onCerrar={noop} />],
    [
      "ModalNota",
      () => (
        <ModalNota
          contexto="compra"
          entidad={compra}
          productos={productos}
          onGuardar={noop}
          onCerrar={noop}
        />
      ),
    ],
    [
      "ModalConfirmar",
      () => (
        <ModalConfirmar
          mensaje="No se puede deshacer."
          nombreRecurso="Membrana"
          onConfirmar={noop}
          onCancelar={noop}
        />
      ),
    ],
    [
      "ModalDetalleCompra",
      () => (
        <ModalDetalleCompra
          compra={compra}
          productos={productos}
          faseNombre="Techos"
          proveedorNombre="Aluar Sur"
          onCerrar={noop}
        />
      ),
    ],
    [
      "ModalDetalleGasto",
      () => <ModalDetalleGasto gasto={gasto} faseNombre="Techos" onCerrar={noop} />,
    ],
    ["ModalDetalleCobro", () => <ModalDetalleCobro cobro={cobro} onCerrar={noop} />],
  ];

  it.each(casos)("%s monta sin romperse", (_nombre, crear) => {
    const { unmount } = render(crear());
    expect(document.querySelector(".modal-contenido")).toBeTruthy();
    unmount();
  });

  it("ModalDetalleCompra muestra el desglose completo", () => {
    render(<ModalDetalleCompra compra={compra} productos={productos} onCerrar={noop} />);
    expect(screen.getByText("Neto")).toBeInTheDocument();
    expect(screen.getByText("IVA 21%")).toBeInTheDocument();
    expect(screen.getByText("Notas de crédito")).toBeInTheDocument();
    expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
    // Pesos primero (se pagó en pesos) y el USD congelado entre paréntesis.
    const textos = [...document.querySelectorAll("span")].map((n) =>
      n.textContent.replace(/\u00a0/g, " ")
    );
    expect(textos).toContain("$ 1.842.300 (US$ 1.474)");
    expect(textos).toContain("-$ 120.000 (US$ 80)");
    expect(textos).toContain("$ 2.109.183 (US$ 1.702)");
  });

  it("ModalDetalleCompra muestra el USD congelado y la cotización debajo del total", () => {
    const { container } = render(
      <ModalDetalleCompra compra={compra} productos={productos} onCerrar={noop} />
    );
    const secundario = container.querySelector(".detalle__total-secundario");
    expect(secundario).toHaveTextContent("US$ 1.702");
    expect(secundario).toHaveTextContent("dólar blue $ 1.250,00");
  });

  it("un gasto nuevo precarga la cotización sugerida del día", async () => {
    const { container } = render(<ModalGasto onGuardar={noop} onCerrar={noop} />);
    // Gasto nuevo arranca en el paso del comprobante: se pasa a mano.
    await userEvent.click(screen.getByRole("button", { name: /cargar los datos a mano/i }));

    // DESIGN.md §9: el dólar es un hint debajo del monto, con "cambiar".
    expect(screen.getByText(/Dólar blue \$\s1\.250,00 del 01\/03\/2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "cambiar" }));
    expect(container.querySelector('input[name="cotizacion_dolar"]')).toHaveValue(1250);
  });

  it("al editar, la cotización es la congelada del movimiento, no la sugerida", async () => {
    const { container } = render(<ModalCobro cobro={cobro} onGuardar={noop} onCerrar={noop} />);
    expect(container.querySelector(".campos-cotizacion")).toHaveTextContent(
      /Dólar blue \$\s1\.000,00/
    );
    await userEvent.click(screen.getByRole("button", { name: "cambiar" }));
    expect(container.querySelector('input[name="cotizacion_dolar"]')).toHaveValue(1000);
  });

  it("ModalDetalleCompra muestra qué productos devuelve cada nota", () => {
    render(<ModalDetalleCompra compra={compra} productos={productos} onCerrar={noop} />);
    expect(screen.getByText("Devolución 2 rollos")).toBeInTheDocument();
    expect(screen.getByText(/Productos devueltos: Rheem Membrana 4mm x2/)).toBeInTheDocument();
  });

  it("ModalDetalleCompra togglea pago y envío desde sus badges", async () => {
    const onTogglePago = vi.fn();
    const onToggleEnvio = vi.fn();
    render(
      <ModalDetalleCompra
        compra={compra}
        productos={productos}
        canManage
        onTogglePago={onTogglePago}
        onToggleEnvio={onToggleEnvio}
        onCerrar={noop}
      />
    );

    // DESIGN.md §9: nada de switches. El estado es el badge, y el badge es el
    // control que lo cambia (como en la fila del libro).
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: /impaga hace .* — marcar pagado/i }));
    expect(onTogglePago).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /entregado — marcar sin entregar/i }));
    expect(onToggleEnvio).toHaveBeenCalled();

    // Impaga: "Marcar pagado" es la acción principal del pie.
    await userEvent.click(screen.getByRole("button", { name: "Marcar pagado" }));
    expect(onTogglePago).toHaveBeenCalledTimes(2);
  });

  it("a un usuario de lectura los estados no le cambian nada", () => {
    render(<ModalDetalleCompra compra={compra} productos={productos} onCerrar={noop} />);
    expect(screen.getByRole("button", { name: /impaga hace/i })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Marcar pagado" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /borrar/i })).not.toBeInTheDocument();
  });

  it("el detalle tiene header claro con el tipo y Borrar a la izquierda del pie", async () => {
    const onEliminar = vi.fn();
    render(
      <ModalDetalleGasto gasto={gasto} onCerrar={noop} onEditar={noop} onEliminar={onEliminar} />
    );
    expect(screen.getByRole("dialog", { name: "Gasto: Flete y descarga" })).toBeInTheDocument();
    expect(document.querySelector(".shell__header")).toHaveTextContent("Gasto");
    await userEvent.click(screen.getByRole("button", { name: /borrar/i }));
    expect(onEliminar).toHaveBeenCalled();
  });

  it("avisa con una banda cuando falta el comprobante", () => {
    render(<ModalDetalleGasto gasto={gasto} onCerrar={noop} onAgregarComprobante={noop} />);
    expect(screen.getByRole("status")).toHaveTextContent("Falta adjuntar el comprobante");
    expect(screen.getByRole("button", { name: /adjuntar/i })).toBeInTheDocument();
  });

  // Los tres modales de edición comparten el lenguaje de la ficha de detalle
  // (EditarShell): header oscuro con el tipo del movimiento y, en los que
  // tienen un total derivado, el riel con el resumen.

  it("los modales de edición usan el header con el tipo de movimiento", () => {
    const { unmount: u1 } = render(<ModalGasto gasto={gasto} onGuardar={noop} onCerrar={noop} />);
    expect(screen.getByText(/Gasto · Editar/)).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(<ModalCobro cobro={cobro} onGuardar={noop} onCerrar={noop} />);
    expect(screen.getByText(/Cobro · Editar/)).toBeInTheDocument();
    u2();

    render(<ModalCompra compra={compra} onGuardar={noop} onCerrar={noop} />);
    expect(screen.getByText(/Compra · Editar/)).toBeInTheDocument();
  });

  it("ModalGasto no lleva riel: su monto se tipea, va al footer", () => {
    const { container } = render(<ModalGasto gasto={gasto} onGuardar={noop} onCerrar={noop} />);

    expect(container.querySelector(".mov-edit__riel")).toBeNull();
    expect(container.querySelector(".mov-edit__footer-total-monto")).toHaveTextContent("$ 84.500");
    // Equivalente en USD con la cotización que quedó congelada (1250).
    expect(container.querySelector(".mov-edit__footer-total-secundario")).toHaveTextContent(
      "US$ 68"
    );
  });

  it("ModalCobro muestra en el riel el neto y las notas que lo explican", () => {
    // El cobro de la fixture es 3200 USD bruto con una nota de crédito de
    // 150 USD -> neto 3050 USD.
    const { container } = render(<ModalCobro cobro={cobro} onGuardar={noop} onCerrar={noop} />);

    const riel = container.querySelector(".mov-edit__riel");
    expect(riel).toBeTruthy();
    expect(riel).toHaveTextContent("Neto");
    expect(riel).toHaveTextContent("US$ 3.050");
    // La nota va desplegada, sin toggle, igual que en Compra.
    expect(riel).toHaveTextContent("Ajuste");
    expect(container.querySelector(".seccion-notas-item-toggle")).toBeNull();
  });

  it("un cobro sin notas no muestra la sección de notas en el riel", () => {
    const sinNotas = { ...cobro, notas: [] };
    const { container } = render(<ModalCobro cobro={sinNotas} onGuardar={noop} onCerrar={noop} />);

    expect(container.querySelector(".mov-edit__notas")).toBeNull();
    expect(container.querySelector(".mov-edit__riel")).toHaveTextContent("US$ 3.200");
  });

  it("ModalCompra nuevo arranca en el paso del comprobante", () => {
    render(<ModalCompra onGuardar={noop} onCerrar={noop} />);
    expect(screen.getByText(/arrastrá el comprobante o/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cargar los datos a mano/i })).toBeInTheDocument();
  });
});
