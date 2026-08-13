// Validaciones compartidas por los formularios de compra/gasto/cobro, para
// mostrar el error debajo del campo apenas se detecta (onChange), no recién
// al hacer submit.

export function validarRequerido(valor, mensaje = "Este campo es obligatorio.") {
  if (valor === null || valor === undefined || String(valor).trim() === "") return mensaje;
  return null;
}

export function validarMonto(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") {
    return "El monto es obligatorio.";
  }
  const numero = Number(valor);
  if (Number.isNaN(numero)) return "Ingresá un monto válido.";
  if (numero < 0) return "El monto no puede ser negativo.";
  return null;
}

export function validarFecha(valor) {
  if (!valor) return "La fecha es obligatoria.";
  const hoy = new Date().toISOString().split("T")[0];
  if (valor > hoy) return "La fecha no puede ser futura.";
  return null;
}
