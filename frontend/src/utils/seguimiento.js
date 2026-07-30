// Lo que necesita atención dentro de UN proyecto. La lógica venía de la
// sección "Necesita atención" del Panel (utils/panel.js), que agrupaba por
// proyecto y mostraba un renglón por grupo ("2 compras pendientes de pago").
// Acá se abre item por item, que es lo que sirve cuando ya estás parado
// adentro del proyecto y querés saber cuál es cuál.

// Una fase "en curso" que hace este tiempo que no se toca se marca como
// estancada. Ajustable de una sola línea si a Agus le queda corto o largo.
export const DIAS_FASE_ESTANCADA = 30;

const MS_POR_DIA = 1000 * 60 * 60 * 24;

// Qué cuenta como pendiente. Se exportan para que el Panel muestre los mismos
// contadores por proyecto sin volver a escribir el criterio.
export const esCompraImpaga = (compra) => compra.estado_pago === "pendiente";
export const esCompraSinEntregar = (compra) => compra.estado_envio === "pedido";
export const esCompraSinComprobante = (compra) => (compra.comprobantes ?? []).length === 0;
export const esCobroSinComprobante = (cobro) => (cobro.comprobantes ?? []).length === 0;

// Exportada: la usa también la página de detalle de fase para "hace cuántos
// días está en curso" con el mismo criterio que las fases estancadas de acá.
export function diasDesde(fecha, hoy) {
  const desde = new Date(fecha);
  if (Number.isNaN(desde.getTime())) return 0;
  return Math.max(0, Math.floor((hoy - desde) / MS_POR_DIA));
}

/** "BGH Aire Acondicionado Split 4500W" + cuántos otros productos trae la compra. */
function describirProductos(compra, productos) {
  const detalle = compra.detalle ?? [];
  if (detalle.length === 0) return "Sin detalle de productos";

  const primero = productos.find((p) => p.id === detalle[0].producto_id);
  const nombre = primero ? `${primero.marca} ${primero.modelo}` : "Producto eliminado";
  const otros = detalle.length - 1;
  return otros > 0 ? `${nombre} y ${otros} ${otros === 1 ? "producto más" : "productos más"}` : nombre;
}

function nombreProveedor(compra, proveedores) {
  return proveedores.find((p) => p.id === compra.proveedor_id)?.nombre ?? "Proveedor eliminado";
}

// Exportada: la reutiliza la página de detalle de fase para su propio
// "Seguimiento de la fase", filtrado a las compras de esa fase nomás.
export function describirCompra(compra, productos, proveedores, hoy) {
  return {
    id: compra.id,
    proveedor: nombreProveedor(compra, proveedores),
    productos: describirProductos(compra, productos),
    descripcion: compra.descripcion,
    monto: compra.precio_total,
    fecha: compra.fecha,
    condicionPago: compra.condicion_pago,
    dias: diasDesde(compra.fecha, hoy),
  };
}

/**
 * Devuelve los grupos de pendientes del proyecto, cada uno ordenado por lo
 * más urgente primero (más días de antigüedad / mayor monto).
 *
 * `cobrosVencidos` no está: el modelo de Cobro no tiene fecha de vencimiento
 * ni estado (pendiente/cobrado), un Cobro es plata que ya entró. Mientras no
 * existan esos campos no hay nada que calcular acá.
 */
export function calcularSeguimiento({
  proyecto = null,
  fases = [],
  gastos = [],
  cobros = [],
  compras = [],
  productos = [],
  proveedores = [],
  hoy = new Date(),
}) {
  const comprasImpagas = compras
    .filter(esCompraImpaga)
    .map((c) => describirCompra(c, productos, proveedores, hoy))
    .sort((a, b) => b.dias - a.dias);

  const comprasSinEntregar = compras
    .filter(esCompraSinEntregar)
    .map((c) => describirCompra(c, productos, proveedores, hoy))
    .sort((a, b) => b.dias - a.dias);

  const comprasSinComprobante = compras
    .filter(esCompraSinComprobante)
    .map((c) => describirCompra(c, productos, proveedores, hoy))
    .sort((a, b) => b.dias - a.dias);

  const gastosSinComprobante = gastos
    .filter((g) => (g.comprobantes ?? []).length === 0)
    .map((g) => ({
      id: g.id,
      descripcion: g.descripcion,
      monto: g.monto,
      fecha: g.fecha,
      dias: diasDesde(g.fecha, hoy),
    }))
    .sort((a, b) => b.monto - a.monto);

  const cobrosSinComprobante = cobros
    .filter(esCobroSinComprobante)
    .map((c) => ({
      id: c.id,
      descripcion: c.descripcion,
      monto: c.monto,
      fecha: c.fecha,
      dias: diasDesde(c.fecha, hoy),
    }))
    .sort((a, b) => b.monto - a.monto);

  const fasesEstancadas = fases
    .filter((f) => f.estado === "en_curso")
    .map((f) => ({ id: f.id, nombre: f.nombre, dias: diasDesde(f.fecha_actualizacion, hoy) }))
    .filter((f) => f.dias >= DIAS_FASE_ESTANCADA)
    .sort((a, b) => b.dias - a.dias);

  // Cuánto se le debe a cada proveedor dentro de este proyecto.
  const deuda = new Map();
  comprasImpagas.forEach((compra) => {
    const actual = deuda.get(compra.proveedor) ?? { proveedor: compra.proveedor, monto: 0, compras: 0 };
    actual.monto += compra.monto;
    actual.compras += 1;
    deuda.set(compra.proveedor, actual);
  });
  const deudaPorProveedor = [...deuda.values()].sort((a, b) => b.monto - a.monto);

  const sumar = (items) => items.reduce((acc, i) => acc + i.monto, 0);

  // Cuánto falta cobrar de lo que se acordó con el cliente. Mismo criterio
  // que el Análisis General: cobrado es la suma de los cobros cargados y el
  // pendiente nunca es negativo (si se cobró de más, queda en 0).
  const precioAcordado = Number(proyecto?.precio_acordado ?? 0);
  const cobrado = sumar(cobros);
  const ultimoCobro = cobros.reduce(
    (masReciente, cobro) => (!masReciente || cobro.fecha > masReciente.fecha ? cobro : masReciente),
    null
  );

  const cobranza = {
    precioAcordado,
    cobrado,
    pendiente: Math.max(0, precioAcordado - cobrado),
    pctCobrado: precioAcordado > 0 ? (cobrado / precioAcordado) * 100 : 0,
    cantidadCobros: cobros.length,
    ultimoCobro: ultimoCobro
      ? { fecha: ultimoCobro.fecha, monto: ultimoCobro.monto, dias: diasDesde(ultimoCobro.fecha, hoy) }
      : null,
  };

  return {
    cobranza,
    comprasImpagas,
    comprasSinEntregar,
    comprasSinComprobante,
    gastosSinComprobante,
    cobrosSinComprobante,
    fasesEstancadas,
    deudaPorProveedor,
    totales: {
      deudaTotal: sumar(comprasImpagas),
      montoSinComprobante: sumar(gastosSinComprobante),
      montoComprasSinComprobante: sumar(comprasSinComprobante),
      montoCobrosSinComprobante: sumar(cobrosSinComprobante),
    },
    // Cuántas cosas hay para revisar en total (para el contador de la pestaña).
    pendientes:
      comprasImpagas.length +
      comprasSinEntregar.length +
      comprasSinComprobante.length +
      gastosSinComprobante.length +
      cobrosSinComprobante.length +
      fasesEstancadas.length,
  };
}
