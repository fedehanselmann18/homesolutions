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
// SeccionPlazos invalida queries al marcar un plazo: acá no hay provider.
vi.mock("@tanstack/react-query", async (original) => ({
  ...(await original()),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));
vi.mock("../../context/useToast", () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));
vi.mock("../../hooks/useExtraccionIA", () => ({
  useExtraccionIA: () => ({ extraer: vi.fn(), extrayendo: false }),
}));
// La sugerencia del dólar del día (useCotizacionDia): una fija, sin servidor.
// Y los tipos de factura de Ajustes, los de fábrica.
vi.mock("../../hooks/queries", async () => {
  const { TIPOS_FACTURA_PRUEBA, CONDICIONES_PAGO_PRUEBA, MEDIOS_PAGO_PRUEBA } =
    await import("../../test/tiposFactura");
  return {
    useUltimaCotizacion: () => ({
      isLoading: false,
      data: { id: "c1", fecha: "2026-03-01", tipo: "blue", valor: 1250 },
    }),
    useTiposFactura: () => ({ isLoading: false, data: TIPOS_FACTURA_PRUEBA }),
    useMediosPago: () => ({ isLoading: false, data: MEDIOS_PAGO_PRUEBA }),
    useCondicionesPago: () => ({ isLoading: false, data: CONDICIONES_PAGO_PRUEBA }),
  };
});

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
  condicion_pago_id: "cp30",
  condicion_pago: { id: "cp30", nombre: "30 días", dias: [30] },
  medio_pago: "transferencia",
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
    // Como en un comercio: sin impuestos, con impuestos y, con notas, el final.
    expect(screen.getByText("Precio sin impuestos")).toBeInTheDocument();
    expect(screen.getByText("IVA 21%")).toBeInTheDocument();
    expect(screen.getByText("Precio con impuestos")).toBeInTheDocument();
    expect(screen.getByText("Notas de crédito")).toBeInTheDocument();
    expect(screen.getByText("Precio final")).toBeInTheDocument();
    // Pesos primero (se pagó en pesos) y el USD congelado entre paréntesis.
    const textos = [...document.querySelectorAll("span")].map((n) =>
      n.textContent.replace(/\u00a0/g, " ")
    );
    expect(textos).toContain("$ 1.842.300 (US$ 1.474)");
    expect(textos).toContain("$ 2.229.183 (US$ 1.783)");
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

    // El badge también es el control que cambia el estado (como en la fila
    // del libro).
    await userEvent.click(screen.getByRole("button", { name: /vencida hace .* — marcar pagado/i }));
    expect(onTogglePago).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: /entregado — marcar sin entregar/i }));
    expect(onToggleEnvio).toHaveBeenCalled();

    // En el pie, un interruptor "Pagado" en vez del botón grande "Marcar
    // pagado": apagado mientras la compra está impaga.
    const interruptor = screen.getByRole("switch", { name: "Pagado" });
    expect(interruptor).toHaveAttribute("aria-checked", "false");
    await userEvent.click(interruptor);
    expect(onTogglePago).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: "Marcar pagado" })).not.toBeInTheDocument();

    // Y otro para el envío: prendido porque la compra de prueba está entregada.
    const entregado = screen.getByRole("switch", { name: "Entregado" });
    expect(entregado).toHaveAttribute("aria-checked", "true");
    await userEvent.click(entregado);
    expect(onToggleEnvio).toHaveBeenCalledTimes(2);
  });

  it("a un usuario de lectura los estados no le cambian nada", () => {
    render(<ModalDetalleCompra compra={compra} productos={productos} onCerrar={noop} />);
    expect(screen.getByRole("button", { name: /vencida hace/i })).toBeDisabled();
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
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

  // v5 (variantes 5c/5d): gasto y cobro son un ModalShell de 560px. El
  // comprobante va primero, el tipo de factura es un control de opción y el
  // monto lleva la moneda adentro con la conversión al lado.

  it("gasto y cobro dicen en el título si se carga o se edita", () => {
    const { unmount: u1 } = render(<ModalGasto gasto={gasto} onGuardar={noop} onCerrar={noop} />);
    expect(screen.getByRole("dialog", { name: "Editar gasto" })).toBeInTheDocument();
    u1();

    const { unmount: u2 } = render(
      <ModalCobro proyectoActual={{ id: 1, nombre: "Olleros" }} onGuardar={noop} onCerrar={noop} />
    );
    expect(screen.getByRole("dialog", { name: "Nuevo cobro" })).toBeInTheDocument();
    // El proyecto va en el header, no como un campo deshabilitado.
    expect(document.querySelector(".shell__contexto")).toHaveTextContent("Olleros");
    expect(screen.queryByDisplayValue(/proyecto actual/)).toBeNull();
    u2();
  });

  it("el monto del gasto lleva los pesos adentro y el equivalente en dólares al lado", () => {
    const { container } = render(<ModalGasto gasto={gasto} onGuardar={noop} onCerrar={noop} />);

    const caja = container.querySelector(".campo--monto");
    expect(caja.querySelector(".campo__prefijo")).toHaveTextContent("$");
    expect(caja.querySelector("input")).toHaveValue(84500);
    // Equivalente con la cotización que quedó congelada (1250).
    expect(caja.querySelector(".campo__sufijo")).toHaveTextContent("≈ US$ 68");
  });

  it("el comprobante ofrece los tipos de Ajustes, incluido «Factura interna»", () => {
    render(<ModalCobro onGuardar={noop} onCerrar={noop} />);
    const grupo = screen.getByRole("radiogroup", { name: "Comprobante" });
    const opciones = [...grupo.querySelectorAll('[role="radio"]')].map((r) => r.textContent);
    expect(opciones).toContain("Factura interna");
    expect(opciones.at(-1)).toBe("Otros");
  });

  it("el tipo de factura es un control de opción, sin selects ni switches", () => {
    render(<ModalGasto gasto={gasto} onGuardar={noop} onCerrar={noop} />);
    const grupo = screen.getByRole("radiogroup", { name: "Comprobante" });
    expect(grupo).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Factura B" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
  });

  it("al guardar sin datos, cada campo dice qué le falta y el pie los cuenta", async () => {
    const onGuardar = vi.fn();
    render(<ModalGasto onGuardar={onGuardar} onCerrar={noop} />);
    await userEvent.click(screen.getByRole("button", { name: "Crear gasto" }));

    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("Escribí una descripción corta.")).toBeInTheDocument();
    expect(screen.getByText("Elegí el tipo de comprobante.")).toBeInTheDocument();
    expect(document.querySelector(".shell__footer-aviso")).toHaveTextContent(
      // La fecha ya no falta: arranca en hoy.
      /Faltan 3 campos: Descripción, Monto, Comprobante/
    );
  });

  it("ModalCobro muestra el neto y las notas que lo explican", () => {
    // El cobro de la fixture es 3200 USD bruto con una nota de crédito de
    // 150 USD -> neto 3050 USD.
    const { container } = render(<ModalCobro cobro={cobro} onGuardar={noop} onCerrar={noop} />);

    const neto = container.querySelector(".cobro-neto");
    expect(neto).toHaveTextContent("Neto con notas");
    expect(neto).toHaveTextContent("US$ 3.050");
    // La nota va desplegada, sin toggle, igual que en Compra.
    expect(neto).toHaveTextContent("Ajuste");
    expect(container.querySelector(".seccion-notas-item-toggle")).toBeNull();
  });

  it("un cobro sin notas no muestra el neto", () => {
    const sinNotas = { ...cobro, notas: [] };
    const { container } = render(<ModalCobro cobro={sinNotas} onGuardar={noop} onCerrar={noop} />);

    expect(container.querySelector(".cobro-neto")).toBeNull();
    expect(container.querySelector(".campo--monto input")).toHaveValue(3200);
  });

  it("un cobro nuevo muestra adónde llega lo cobrado del proyecto", async () => {
    const { container } = render(
      <ModalCobro
        proyectoActual={{ id: 1, nombre: "Torre", precio_acordado_usd: 19000, cobrado_usd: 11020 }}
        onGuardar={noop}
        onCerrar={noop}
      />
    );
    await userEvent.type(container.querySelector(".campo--monto input"), "2500");
    expect(container.querySelector(".cobro-avance")).toHaveTextContent(
      "Con este cobro llegás al 71%"
    );
  });

  // Nueva compra: el híbrido 5ab (DESIGN.md §14).

  it("Nueva compra arranca en el paso 1, con el comprobante y la IA al lado del archivo", () => {
    render(<ModalCompra onGuardar={noop} onCerrar={noop} />);
    const pasos = screen.getByRole("list", { name: "Pasos de la compra" });
    expect(pasos).toHaveTextContent("Comprobante y datos");
    expect(pasos).toHaveTextContent("Condiciones");
    expect(pasos).toHaveTextContent("Productos e impuestos");
    expect(screen.getByRole("button", { name: /Comprobante y datos/ })).toHaveAttribute(
      "aria-current",
      "step"
    );
    expect(screen.getByText(/arrastrá la factura o/i)).toBeInTheDocument();
    // Sin el paso "IA primero": el formulario está desde el principio.
    expect(screen.getByLabelText("Descripción")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cargar los datos a mano/i })).toBeNull();
  });

  it("Siguiente no avanza con datos faltantes y dice cuáles en cada campo", async () => {
    render(
      <ModalCompra
        proveedores={[{ id: 3, nombre: "Aluar Sur" }]}
        onGuardar={noop}
        onCerrar={noop}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    expect(screen.getByRole("button", { name: /Comprobante y datos/ })).toHaveAttribute(
      "aria-current",
      "step"
    );
    expect(screen.getByText("Elegí el proveedor.")).toBeInTheDocument();
    expect(screen.getByText("Escribí una descripción corta.")).toBeInTheDocument();
  });

  it("en Condiciones, factura y pago son controles de opción a la vista, sin switches", async () => {
    render(
      <ModalCompra
        compra={compra}
        productosDisponibles={productos}
        onGuardar={noop}
        onCerrar={noop}
      />
    );
    await userEvent.click(screen.getByRole("button", { name: /Condiciones/ }));

    expect(screen.getByRole("radio", { name: "Factura A" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "30 días" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Pendiente" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.getByRole("radio", { name: "Entregado" })).toHaveAttribute(
      "aria-checked",
      "true"
    );
    expect(screen.queryAllByRole("switch")).toHaveLength(0);
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
  });

  it("el pie tiene el desglose en su fila y el total abajo; al editar se guarda desde cualquier paso", () => {
    const { container } = render(
      <ModalCompra
        compra={compra}
        productosDisponibles={productos}
        onGuardar={noop}
        onCerrar={noop}
      />
    );
    const desglose = container.querySelector(".shell__desglose");
    expect(desglose).toHaveTextContent("Sin impuestos $ 1.284.000 (1 producto)");
    expect(desglose).toHaveTextContent("impuestos $ 386.883");
    expect(desglose).toHaveTextContent("con impuestos $ 1.670.883");
    expect(desglose).toHaveTextContent("notas de crédito −$ 120.000");
    expect(container.querySelector(".shell__footer-total-monto")).toHaveTextContent("$ 1.550.883");
    // Con notas, el total del pie es el final, no el "con impuestos".
    expect(container.querySelector(".shell__footer-total-label")).toHaveTextContent("Final");
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });
});

describe("proveedor y producto: errores en cada campo", () => {
  it("proveedor sin nombre no se guarda y dice qué falta", async () => {
    const onGuardar = vi.fn();
    render(<ModalProveedor onGuardar={onGuardar} onCerrar={noop} />);
    await userEvent.click(screen.getByRole("button", { name: "Crear proveedor" }));
    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("Escribí el nombre del proveedor.")).toBeInTheDocument();
    expect(screen.getByText("Falta 1 campo: Nombre")).toBeInTheDocument();
  });

  it("proveedor con un email mal escrito marca el email", async () => {
    const onGuardar = vi.fn();
    render(<ModalProveedor onGuardar={onGuardar} onCerrar={noop} />);
    await userEvent.type(screen.getByLabelText("Nombre"), "CobreSur");
    await userEvent.type(screen.getByLabelText(/Email/), "ventas@cobresur");
    await userEvent.click(screen.getByRole("button", { name: "Crear proveedor" }));
    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("Revisá el email.")).toBeInTheDocument();
  });

  it("producto vacío marca marca, modelo, tipo y precio", async () => {
    const onGuardar = vi.fn();
    render(<ModalProducto onGuardar={onGuardar} onCerrar={noop} />);
    expect(screen.getByText("Elegí el tipo para ver sus categorías.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Crear producto" }));
    expect(onGuardar).not.toHaveBeenCalled();
    expect(screen.getByText("Faltan 4 campos: Marca, Modelo, Tipo, Precio")).toBeInTheDocument();
  });
});

describe("ModalFase: nombre de la lista o a mano", () => {
  const SUGERIDOS = ["Relevamiento y anteproyecto", "Calefacción"];

  it("el nombre se elige de las fases predeterminadas", async () => {
    const onGuardar = vi.fn();
    render(<ModalFase nombresSugeridos={SUGERIDOS} onGuardar={onGuardar} onCerrar={noop} />);

    await userEvent.selectOptions(screen.getByRole("combobox", { name: /nombre/i }), "Calefacción");
    await userEvent.click(screen.getByRole("button", { name: "Crear fase" }));

    expect(onGuardar).toHaveBeenCalledWith(expect.objectContaining({ nombre: "Calefacción" }));
  });

  it("con «Otra (escribir a mano)» se tipea un nombre libre, y se puede volver a la lista", async () => {
    const onGuardar = vi.fn();
    render(<ModalFase nombresSugeridos={SUGERIDOS} onGuardar={onGuardar} onCerrar={noop} />);

    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: /nombre/i }),
      "Otra (escribir a mano)"
    );
    await userEvent.type(screen.getByRole("textbox", { name: /nombre/i }), "Entrega y garantía");
    await userEvent.click(screen.getByRole("button", { name: "Crear fase" }));
    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ nombre: "Entrega y garantía" })
    );

    await userEvent.click(screen.getByRole("button", { name: "elegir de la lista" }));
    expect(screen.getByRole("combobox", { name: /nombre/i })).toBeInTheDocument();
  });

  it("una fase con un nombre fuera de la lista se edita a mano", () => {
    render(
      <ModalFase
        fase={{ id: 1, nombre: "Entrega y garantía", estado: "por_empezar" }}
        nombresSugeridos={SUGERIDOS}
        onGuardar={noop}
        onCerrar={noop}
      />
    );
    expect(screen.getByRole("textbox", { name: /nombre/i })).toHaveValue("Entrega y garantía");
  });

  it("sin fases predeterminadas queda el input de texto, sin link a la lista", () => {
    render(<ModalFase onGuardar={noop} onCerrar={noop} />);
    expect(screen.getByRole("textbox", { name: /nombre/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "elegir de la lista" })).toBeNull();
  });
});

describe("ModalFase: en curso desde", () => {
  it("la fecha sólo aparece con la fase en curso, y viaja con lo que se guarda", async () => {
    const onGuardar = vi.fn();
    render(<ModalFase onGuardar={onGuardar} onCerrar={noop} />);
    expect(screen.queryByLabelText(/en curso desde/i)).toBeNull();

    await userEvent.type(screen.getByRole("textbox", { name: /nombre/i }), "Montaje");
    await userEvent.click(screen.getByRole("radio", { name: /en curso/i }));
    const fecha = screen.getByLabelText(/en curso desde/i);
    await userEvent.clear(fecha);
    await userEvent.type(fecha, "2026-05-04");
    await userEvent.click(screen.getByRole("button", { name: "Crear fase" }));

    expect(onGuardar).toHaveBeenCalledWith(
      expect.objectContaining({ estado: "en_curso", fecha_en_curso_desde: "2026-05-04" })
    );
  });

  it("al editar trae la fecha guardada, y si la fase no queda en curso no la manda", async () => {
    const onGuardar = vi.fn();
    render(
      <ModalFase
        fase={{ id: 1, nombre: "Montaje", estado: "en_curso", fecha_en_curso_desde: "2026-03-02" }}
        onGuardar={onGuardar}
        onCerrar={noop}
      />
    );
    expect(screen.getByLabelText(/en curso desde/i)).toHaveValue("2026-03-02");

    await userEvent.click(screen.getByRole("radio", { name: /terminada/i }));
    await userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));
    expect(onGuardar.mock.calls[0][0]).not.toHaveProperty("fecha_en_curso_desde");
  });
});

// El aviso de lo que se borra en cascada (ver utils/proyectos.js, que arma las
// líneas). Acá sólo se prueba que el modal las muestre y que sin líneas no
// dibuje una lista vacía.
describe("ModalConfirmar: lo que se va a borrar", () => {
  it("lista una línea por cosa, debajo del nombre de la obra", () => {
    render(
      <ModalConfirmar
        titulo="Eliminar proyecto"
        mensaje="No se puede deshacer."
        nombreRecurso="Terravista"
        detalles={["3 compras", "1 gasto", "2 cobros"]}
        onConfirmar={noop}
        onCancelar={noop}
      />
    );
    expect(screen.getByText("Terravista")).toBeInTheDocument();
    ["3 compras", "1 gasto", "2 cobros"].forEach((linea) =>
      expect(screen.getByText(linea)).toBeInTheDocument()
    );
  });

  it("sin nada que listar no dibuja la lista", () => {
    const { container } = render(
      <ModalConfirmar
        mensaje="No se puede deshacer."
        nombreRecurso="Obra nueva"
        detalles={[]}
        onConfirmar={noop}
        onCancelar={noop}
      />
    );
    expect(container.querySelector(".modal-confirmar-detalles")).toBeNull();
  });
});
