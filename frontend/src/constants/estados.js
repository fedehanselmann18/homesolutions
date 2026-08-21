// constants/estados.js
//
// El semáforo de estado (proyecto y fase) sale de acá. Los colores se importan
// de colores.js y no se escriben a mano: este archivo tenía los cuatro hex
// literales -- los mismos valores, pero fuera del único lugar que colores.js
// declara como válido para un hex en JS, así que un cambio de paleta los
// dejaba atrás justo en lo que pinta el estado de toda la app.
import { Clock, CirclePlay, CircleCheckBig, Search } from "lucide-react";

import { TINTA_MUTED, NARANJA, VERDE, AZUL } from "./colores";

const ESTADOS = {
  a_iniciar: { color: TINTA_MUTED, label: "A iniciar", icono: Clock },
  en_curso: { color: NARANJA, label: "En curso", icono: CirclePlay },
  terminado: { color: VERDE, label: "Terminado", icono: CircleCheckBig },
};

export const ESTADO_LABELS = {
  por_empezar: { color: TINTA_MUTED, label: "Por empezar", icono: Clock },
  en_curso: { color: NARANJA, label: "En curso", icono: CirclePlay },
  terminada: { color: VERDE, label: "Terminada", icono: CircleCheckBig },
  auditada: { color: AZUL, label: "Auditada", icono: Search },
};

export function getEstado(estado) {
  return ESTADOS[estado] || { color: TINTA_MUTED, label: estado };
}

export function getEstadoLabel(estado) {
  return ESTADO_LABELS[estado] || estado;
}
