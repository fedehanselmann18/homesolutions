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
  precio_neto: 1842300,
  precio_total: 2109183,
  proveedor_id: 3,
  fase_id: 2,
  detalle: [{ id: 1, producto_id: 7, cantidad: 12, precio_unitario: 107000 }],
  impuestos_aplicados: [{ id: 1, impuesto_id: 1, monto: 386883, impuesto: { nombre: "IVA 21%" } }],
  notas: [
    {
      id: 1,
      tipo: "nota_credito",
      monto: 120000,
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
  monto: 84500,
  tipo_factura: "factura_b",
  categorias: [{ id: 1, nombre: "Logística" }],
  comprobantes: [],
};
const cobro = {
  id: 3,
  descripcion: "Anticipo 40%",
  fecha: "2026-03-05",
  monto: 3200000,
  monto_neto: 3050000,
  tipo_factura: "factura_a",
  notas: [{ id: 2, tipo: "nota_credito", monto: 150000, descripcion: "Ajuste" }],
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
    // "Neto" aparece dos veces a propósito: en la leyenda de la barra de
    // composición y en la fila del desglose numérico.
    expect(screen.getAllByText("Neto").length).toBeGreaterThan(0);
    expect(screen.getByText("IVA 21%")).toBeInTheDocument();
    expect(screen.getByText("Notas de crédito")).toBeInTheDocument();
    expect(screen.getAllByText("Total").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$ 1.842.300").length).toBeGreaterThan(0);
    expect(screen.getAllByText("-$ 120.000").length).toBeGreaterThan(0);
    expect(screen.getAllByText("$ 2.109.183").length).toBeGreaterThan(0);
  });

  it("ModalDetalleCompra muestra qué productos devuelve cada nota", () => {
    render(<ModalDetalleCompra compra={compra} productos={productos} onCerrar={noop} />);
    expect(screen.getByText("Devolución 2 rollos")).toBeInTheDocument();
    expect(screen.getByText(/Productos devueltos: Rheem Membrana 4mm x2/)).toBeInTheDocument();
  });

  it("ModalDetalleCompra togglea pago y envío desde el modal", async () => {
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

    const switches = screen.getAllByRole("switch");
    expect(switches).toHaveLength(2);
    // pendiente / entregado
    expect(switches[0]).toHaveAttribute("aria-checked", "false");
    expect(switches[1]).toHaveAttribute("aria-checked", "true");

    await userEvent.click(switches[0]);
    expect(onTogglePago).toHaveBeenCalled();
  });

  it("no muestra switches a un usuario de lectura", () => {
    render(<ModalDetalleCompra compra={compra} productos={productos} onCerrar={noop} />);
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("ModalCompra nuevo arranca en el paso del comprobante", () => {
    render(<ModalCompra onGuardar={noop} onCerrar={noop} />);
    expect(screen.getByText(/arrastrá la factura o el remito/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cargar los datos a mano/i })).toBeInTheDocument();
  });
});
