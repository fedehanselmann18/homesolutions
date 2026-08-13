// Helpers para agregar notas de crédito/débito (cuenta corriente) a través de
// varias Compras/Cobros -- se usan en las vistas de Proveedor, donde hay que
// mostrar "esta nota pertenece a tal compra" en vez de listar comprobantes sueltos.

/**
 * Aplana las notas de una lista de Compras en un solo array, cada una con la
 * referencia a su Compra de origen (id, descripción, fecha).
 */
export function notasDeCompras(compras = []) {
  return compras.flatMap((compra) =>
    (compra.notas ?? []).map((n) => ({
      ...n,
      origenTipo: "compra",
      origenId: compra.id,
      origenDescripcion: compra.descripcion,
      origenFecha: compra.fecha,
    }))
  );
}

/** Mismo criterio que notasDeCompras pero para Cobros. */
export function notasDeCobros(cobros = []) {
  return cobros.flatMap((cobro) =>
    (cobro.notas ?? []).map((n) => ({
      ...n,
      origenTipo: "cobro",
      origenId: cobro.id,
      origenDescripcion: cobro.descripcion,
      origenFecha: cobro.fecha,
    }))
  );
}

export function totalNotasCredito(notas = []) {
  return notas
    .filter((n) => n.tipo === "nota_credito")
    .reduce((acc, n) => acc + (Number(n.monto) || 0), 0);
}

export function totalNotasDebito(notas = []) {
  return notas
    .filter((n) => n.tipo === "nota_debito")
    .reduce((acc, n) => acc + (Number(n.monto) || 0), 0);
}

/**
 * Cuánto de una línea de compra (DetalleCompra) queda disponible para
 * devolver: la cantidad comprada menos lo ya acreditado en notas de
 * devolución anteriores de esa misma compra. Mismo criterio que
 * `_restante_detalle_compra` en el backend (routes/compras.py) -- se usa acá
 * SOLO para limitar la cantidad en el formulario antes de mandar el POST; la
 * validación real (la que importa) la vuelve a hacer el backend.
 */
export function restanteDetalleCompra(compra, detalleCompraId) {
  const linea = (compra?.detalle ?? []).find((d) => d.id === detalleCompraId);
  if (!linea) return 0;

  const yaDevuelto = (compra?.notas ?? [])
    .flatMap((n) => n.detalles ?? [])
    .filter((d) => d.detalle_compra_id === detalleCompraId)
    .reduce((acc, d) => acc + (Number(d.cantidad) || 0), 0);

  return Number(linea.cantidad) - yaDevuelto;
}
