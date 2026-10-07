import { Package, Blocks, Hammer } from "lucide-react";
import { OLIVA, OLIVA_OSCURO, GRIS, TINTA_TENUE } from "./colores";

// El color de un tipo es CATEGÓRICO (el treemap de Análisis, el punto de la
// leyenda): sale de la rampa de PALETA_GRAFICOS. Antes eran un gris frío, el
// ámbar de "atención" y el verde de "terminado" escritos a mano, así que en el
// treemap los materiales se leían como una alerta.
export const TIPOS_PRODUCTO = {
  equipo: { label: "Equipo", icono: Package, color: OLIVA_OSCURO },
  materiales: { label: "Materiales", icono: Blocks, color: OLIVA },
  mano_obra: { label: "Mano de obra", icono: Hammer, color: GRIS },
};

export function getTipoProducto(tipo) {
  return TIPOS_PRODUCTO[tipo] ?? { label: tipo, icono: null, color: TINTA_TENUE };
}
