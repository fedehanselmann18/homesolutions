const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function formatearFechaLarga(fecha) {
  let dia, mes, anio;

  if (fecha instanceof Date) {
    dia = fecha.getDate();
    mes = fecha.getMonth() + 1;
    anio = fecha.getFullYear();
  } else if (typeof fecha === "string") {
    if (fecha.includes("/")) {
      // dd/mm/aaaa
      [dia, mes, anio] = fecha.split("/").map(Number);
    } else if (fecha.includes("-")) {
      // aaaa-mm-dd (ISO, típico de FastAPI/Postgres)
      [anio, mes, dia] = fecha.split("T")[0].split("-").map(Number);
    }
  }

  if (!dia || !mes || !anio) return "Fecha inválida";

  return `${dia} de ${MESES[mes - 1]} de ${anio}`;
}
