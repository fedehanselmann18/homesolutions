export function formatMoneda(monto) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(monto);
}

// Versión compacta para ejes y etiquetas de gráficos: $3,9 M
export function formatMonedaCorta(monto) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(monto);
}

export function formatFecha(fecha) {
  if (!fecha) return "";
  // Evita el corrimiento de un día por timezone al parsear "YYYY-MM-DD"
  return new Date(`${fecha}T00:00:00`).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
