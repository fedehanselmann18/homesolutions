// Cuenta corriente: nota de crédito / nota de débito, adjuntas a una Compra o
// un Cobro puntual. Espejo de NotaCompra/NotaCobro en el backend
// (app/db/models.py). No confundir con Comprobante* (factura, remito...),
// que es solo el archivo sin plata propia.

export const TIPOS_NOTA = [
  { value: "nota_credito", label: "Nota de crédito" },
  { value: "nota_debito", label: "Nota de débito" },
];

export function getTipoNotaLabel(value) {
  return TIPOS_NOTA.find((t) => t.value === value)?.label ?? value;
}

// Origen: por qué existe la nota. Distinto según sea del lado Compra
// (proveedor) o Cobro (cliente/proyecto) -- Compra puede ser por devolución
// de un producto puntual; Cobro no tiene líneas de producto, así que su
// equivalente es un ajuste de precio.
export const ORIGENES_NOTA_COMPRA = [
  { value: "devolucion_producto", label: "Devolución de producto" },
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
