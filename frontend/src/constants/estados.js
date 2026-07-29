// constants/estados.js

export const ESTADOS = {
  a_iniciar: { color: "#94A3B8", label: "A iniciar", icono: "⏳" },
  en_curso: { color: "#F5A623", label: "En curso", icono: "▶️" },
  terminado: { color: "#10B981", label: "Terminado", icono: "✅" },
};

export const ESTADO_LABELS = {
    por_empezar: { color: "#94A3B8", label: "Por empezar", icono: "⏳" },
    en_curso: { color: "#F5A623", label: "En curso", icono: "▶️" },
    terminada: { color: "#10B981", label: "Terminada", icono: "✅" },
    auditada: { color: "#2563EB", label: "Auditada", icono: "🔍" },
};

export function getEstado(estado) {
  return ESTADOS[estado] || { color: "#94A3B8", label: estado };
}

export function getEstadoLabel(estado) {
  return ESTADO_LABELS[estado] || estado;
}