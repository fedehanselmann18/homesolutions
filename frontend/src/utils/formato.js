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

// Timestamp completo (fecha + hora), para el rastro de auditoría. A
// diferencia de formatFecha, acá el valor que manda el backend YA es un
// instante con zona horaria (creado_en es un timestamptz), así que se parsea
// directo: no hace falta -- ni corresponde -- el truco del "T00:00:00".
export function formatFechaHora(instante) {
  if (!instante) return "";
  return new Date(instante).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
