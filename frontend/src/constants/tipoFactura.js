export const TIPOS_FACTURA = [
  { value: "factura_a", label: "Factura A" },
  { value: "factura_b", label: "Factura B" },
  { value: "factura_c", label: "Factura C" },
  { value: "remito", label: "Remito" },
  { value: "recibo", label: "Recibo" },
  { value: "otros", label: "Otros" },
];

export function getTipoFacturaLabel(value) {
  return TIPOS_FACTURA.find((t) => t.value === value)?.label ?? value;
}
