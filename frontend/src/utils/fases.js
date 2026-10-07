import { pluralizar } from "./formato";

// Una fase "auditada" ya está cerrada: cuenta como terminada, mismo criterio
// que el avance de la pestaña Fases y el del Panel.
export const ESTADOS_FASE_CERRADA = ["terminada", "auditada"];

/**
 * Dónde está una fase en la obra: "cerrada", "actual" o "pendiente". Es
 * PROGRESO (el punto de la línea de tiempo de Fases, el número del header de
 * una fase), no ESTADO: el estado es el badge del semáforo de estados.js.
 */
export function etapaDeFase(estado) {
  if (ESTADOS_FASE_CERRADA.includes(estado)) return "cerrada";
  if (estado === "en_curso") return "actual";
  return "pendiente";
}

/**
 * "Fase 3 de 4 · Montaje": en qué fase va un proyecto. La fase actual es la
 * primera en curso por `orden`, y N es su posición en la lista ordenada (no
 * `fase.orden`, que puede tener huecos). Sin ninguna en curso no se inventa
 * una "actual": se dice cuántas hay y en qué quedaron.
 *
 * Devuelve `{ numero, total, nombre }` (numero null si no hay una en curso),
 * o null si el proyecto no tiene fases. `texto` es la frase lista para pintar.
 */
export function describirFaseActual(fases) {
  if (!fases?.length) return null;
  const ordenadas = [...fases].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const total = ordenadas.length;
  const indice = ordenadas.findIndex((f) => f.estado === "en_curso");
  if (indice >= 0) {
    const nombre = ordenadas[indice].nombre;
    return {
      numero: indice + 1,
      total,
      nombre,
      texto: `Fase ${indice + 1} de ${total} · ${nombre}`,
    };
  }
  const texto = ordenadas.every((f) => ESTADOS_FASE_CERRADA.includes(f.estado))
    ? total === 1
      ? "1 fase terminada"
      : `${total} fases terminadas`
    : `${pluralizar(total, "fase")}, ninguna en curso`;
  return { numero: null, total, nombre: texto, texto };
}
