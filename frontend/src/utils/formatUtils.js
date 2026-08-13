// utils/formatUtils.js
export function formatearMoneda(valor) {
  return valor.toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
  });
}

export function formatearEstado(estado) {
  const ESTADOS_LEGIBLES = {
    en_curso: "En curso",
    terminado: "Terminado",
    a_iniciar: "A iniciar",
  };
  return ESTADOS_LEGIBLES[estado] || estado;
}
