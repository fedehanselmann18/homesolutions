// Cuenta corriente: nota de crédito / nota de débito, adjuntas a una Compra o
// un Cobro puntual. Espejo de NotaCompra/NotaCobro en el backend
// (app/db/models/). No confundir con Comprobante* (factura, remito...),
// que es solo el archivo sin plata propia.

export const TIPOS_NOTA = [
  { value: "nota_credito", label: "Nota de crédito" },
  { value: "nota_debito", label: "Nota de débito" },
];

// Origen: por qué existe la nota. Distinto según sea del lado Compra
// (proveedor) o Cobro (cliente/proyecto) -- Compra puede ser por devolución
// de un producto puntual; Cobro no tiene líneas de producto, así que su
// equivalente es un ajuste de precio.
//
// "devolucion_producto" es SOLO nota_credito (te devuelven la plata de un
// producto puntual). "reposicion_producto" es SOLO nota_debito -- caso
// típico: te cambian 3 aires fallados (nota_credito devolucion_producto por
// esos 3) y te facturan los 3 aires nuevos que te mandan de reposición (esta
// nota_debito). Ambos usan el mismo selector de producto+cantidad de la
// compra, ver ModalNota.jsx.
export const ORIGENES_NOTA_COMPRA = [
  { value: "devolucion_producto", label: "Devolución de producto" },
  { value: "reposicion_producto", label: "Reposición de producto" },
  { value: "acuerdo_comercial", label: "Acuerdo comercial" },
  { value: "otro", label: "Otro" },
];

export const ORIGENES_NOTA_COBRO = [
  { value: "ajuste_precio", label: "Ajuste de precio" },
  { value: "acuerdo_comercial", label: "Acuerdo comercial" },
  { value: "otro", label: "Otro" },
];

export function getOrigenNotaLabel(value, contexto = "compra") {
  const opciones = contexto === "cobro" ? ORIGENES_NOTA_COBRO : ORIGENES_NOTA_COMPRA;
  return opciones.find((o) => o.value === value)?.label ?? value;
}
