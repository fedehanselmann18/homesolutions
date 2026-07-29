export const TIPOS_PRODUCTO = {
  equipo: { label: "Equipo", icono: "📦", color: "#2563EB" },
  materiales: { label: "Materiales", icono: "🧱", color: "#B45309" },
  mano_obra: { label: "Mano de obra", icono: "🛠️", color: "#6F7F45" },
};

export function getTipoProducto(tipo) {
  return TIPOS_PRODUCTO[tipo] ?? { label: tipo, icono: "•", color: "#94A3B8" };
}
