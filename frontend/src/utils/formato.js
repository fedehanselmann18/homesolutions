// Doble moneda: "ars" -> "$ 1.234", "usd" ->
// "US$ 1.234". Es el formato es-AR de Intl, así que en pantalla "$" pelado
// siempre significa pesos. El default es pesos porque es la moneda de todo lo
// que no se convirtió (catálogo de proveedores, detalle de compra, impuestos).
const CODIGO_ISO = { ars: "ARS", usd: "USD" };

export function formatMoneda(monto, moneda = "ars") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: CODIGO_ISO[moneda],
    maximumFractionDigits: 0,
  }).format(monto);
}

// Un número sin moneda, en es-AR y con decimales fijos: "59,3" y no "59.3"
// (toFixed), que en una pantalla en castellano se lee como miles.
export function formatNumero(numero, decimales = 0) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(numero);
}

// Versión compacta para ejes y etiquetas de gráficos: $3,9 M / US$ 3,9 M
export function formatMonedaCorta(monto, moneda = "ars") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: CODIGO_ISO[moneda],
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(monto);
}

/**
 * Una cifra en las dos monedas: la principal y la otra entre paréntesis
 * ("US$ 41.379 ($ 60.000.000)"). USD principal por default, que es la vara
 * de rentabilidad; `principal: "ars"` para lo que se debe o se pagó en pesos
 * (deuda a proveedores, un gasto). `ars` en null (ej. precio acordado sin
 * ninguna cotización cargada) muestra solo la principal.
 */
export function formatMonedaDual(ars, usd, { principal = "usd" } = {}) {
  const [primera, segunda] =
    principal === "usd"
      ? [
          [usd, "usd"],
          [ars, "ars"],
        ]
      : [
          [ars, "ars"],
          [usd, "usd"],
        ];
  if (segunda[0] == null) return formatMoneda(primera[0], primera[1]);
  return `${formatMoneda(primera[0], primera[1])} (${formatMoneda(segunda[0], segunda[1])})`;
}

// Cotización del dólar: pesos con centavos ("$ 1.487,35"), a diferencia de
// formatMoneda que redondea al peso -- en un tipo de cambio los centavos sí
// importan.
export function formatCotizacion(valor) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(valor);
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

// "Jueves 5 de marzo" (y el año sólo si no es el actual): el día de un grupo
// en el libro de obra y la fecha del header del detalle de un movimiento. Se
// arma por partes porque es-AR pone una coma después del día de la semana
// ("jueves, 5 de marzo") que el diseño no tiene.
export function formatFechaLarga(fecha) {
  if (!fecha) return "";
  const dia = new Date(`${fecha}T00:00:00`);
  const parte = (opciones) => dia.toLocaleDateString("es-AR", opciones);
  const semana = parte({ weekday: "long" });
  const anio = dia.getFullYear() !== new Date().getFullYear() ? ` de ${dia.getFullYear()}` : "";
  return `${semana.charAt(0).toUpperCase()}${semana.slice(1)} ${dia.getDate()} de ${parte({
    month: "long",
  })}${anio}`;
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

// Cantidad con su sustantivo concordado: "1 compra" / "3 compras". El plural
// por default agrega una "s"; cuando eso no alcanza (frases con verbo o
// adjetivo, "compra que no tiene" / "compras que no tienen") se pasa entero.
export function pluralizar(cantidad, singular, plural = `${singular}s`) {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`;
}

// Tamaño de archivo legible (1536 -> "1.5 KB"), para la reconciliación de
// R2 (ver GestionArchivos.jsx). Los comprobantes están topeados a 10MB (ver
// MAX_SIZE_BYTES en el backend), así que nunca hace falta ir más allá de MB.
export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// "Visto por última vez" (planilla de Equipo en
// Manager): relativo y no una fecha/hora pelada -- para esto importa "hace
// cuánto", no el instante exacto. Pasado el día cae a formatFechaHora
// (fecha+hora concreta), donde lo relativo deja de aportar más que confundir.
export function formatUltimaActividad(instante) {
  if (!instante) return "Nunca";

  const minutos = (Date.now() - new Date(instante).getTime()) / 60000;
  if (minutos < 1) return "Ahora";
  if (minutos < 60) return `Hace ${Math.floor(minutos)} min`;
  if (minutos < 60 * 24) return `Hace ${Math.floor(minutos / 60)} h`;
  return formatFechaHora(instante);
}

// "mlopez" -> "ML", "Agustin" -> "AG", "ClimaTotal Instalaciones" -> "CI": las
// dos letras de un avatar. Con dos palabras o más, la inicial de las dos
// primeras; con una sola, sus dos primeras letras.
export function iniciales(nombre = "") {
  const partes = nombre.split(/[.\s_-]+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nombre.slice(0, 2).toUpperCase();
}
