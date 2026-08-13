// constants/estados.js
import { Clock, CirclePlay, CircleCheckBig, Search } from "lucide-react";

export const ESTADOS = {
  a_iniciar: { color: "#6b7280", label: "A iniciar", icono: Clock },
  en_curso: { color: "#d97706", label: "En curso", icono: CirclePlay },
  terminado: { color: "#16a34a", label: "Terminado", icono: CircleCheckBig },
};

export const ESTADO_LABELS = {
  por_empezar: { color: "#6b7280", label: "Por empezar", icono: Clock },
  en_curso: { color: "#d97706", label: "En curso", icono: CirclePlay },
  terminada: { color: "#16a34a", label: "Terminada", icono: CircleCheckBig },
  auditada: { color: "#64748b", label: "Auditada", icono: Search },
};

export function getEstado(estado) {
  return ESTADOS[estado] || { color: "#6b7280", label: estado };
}

export function getEstadoLabel(estado) {
  return ESTADO_LABELS[estado] || estado;
}
