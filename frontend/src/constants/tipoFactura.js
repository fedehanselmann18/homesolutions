// Los tipos de factura ya no son una lista fija: se arman en Ajustes y
// vienen de la API (useTiposFactura). Los movimientos guardan el `codigo`
// (factura_a, remito...) y acá se traduce al `nombre` que se muestra.
// Las versiones con hook están en hooks/useTiposFactura.js.

/** Nombre del tipo; si no está en la lista (todavía no llegó, o es un código
 * viejo), el código crudo para que al menos se vea algo. */
export function getTipoFacturaLabel(codigo, tipos = []) {
  return tipos.find((t) => t.codigo === codigo)?.nombre ?? codigo;
}

/** Opciones para ControlOpcion. Si el valor actual no está en la lista (al
 * editar, antes de que llegue la query), se agrega para que se vea elegido. */
export function opcionesTipoFactura(tipos = [], valorActual = "") {
  const opciones = tipos.map((t) => ({ valor: t.codigo, label: t.nombre }));
  if (valorActual && !opciones.some((o) => o.valor === valorActual)) {
    opciones.push({ valor: valorActual, label: valorActual });
  }
  return opciones;
}
