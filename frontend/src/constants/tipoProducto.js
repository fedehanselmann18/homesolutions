import { Package, Blocks, Hammer } from "lucide-react";

export const TIPOS_PRODUCTO = {
  equipo: { label: "Equipo", icono: Package, color: "#64748b" },
  materiales: { label: "Materiales", icono: Blocks, color: "#d97706" },
  mano_obra: { label: "Mano de obra", icono: Hammer, color: "#16a34a" },
};

export function getTipoProducto(tipo) {
  return TIPOS_PRODUCTO[tipo] ?? { label: tipo, icono: null, color: "#6b7280" };
}
