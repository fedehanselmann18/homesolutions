// Validaciones compartidas por los formularios de compra/gasto/cobro y por
// los de contraseña (registro y reseteo), para mostrar el error debajo del
// campo apenas se detecta (onChange), no recién al hacer submit.

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

// Mismo mínimo que valida el backend (MINIMO_PASSWORD en
// backend/app/schemas.py). Sin este chequeo en el front, una contraseña
// corta viaja igual y vuelve como 422 -- que el usuario leía como un error
// cualquiera, sin saber que el problema era el largo.
export const MINIMO_PASSWORD = 10;

export function validarPassword(valor) {
  if (!valor) return "La contraseña es obligatoria.";
  if (valor.length < MINIMO_PASSWORD) {
    return `La contraseña tiene que tener al menos ${MINIMO_PASSWORD} caracteres.`;
  }
  return null;
}

/**
 * El aviso del pie de un modal cuando no se pudo guardar: "Falta 1 campo:
 * Descripción" / "Faltan 2 campos: Monto, Fecha". null si no falta nada.
 * Reemplaza al banner rojo de arriba del formulario (variante 5a): el error
 * ya está en cada campo, el pie sólo cuenta cuántos y cuáles.
 */
export function avisoFaltantes(faltantes) {
  if (!faltantes.length) return null;
  const cuantos = faltantes.length === 1 ? "Falta 1 campo" : `Faltan ${faltantes.length} campos`;
  return `${cuantos}: ${faltantes.join(", ")}`;
}
