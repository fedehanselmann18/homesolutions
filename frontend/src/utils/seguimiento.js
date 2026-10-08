import { montoCobroNeto, montoGasto, precioTotalCompra, saldoPorCobrar } from "./moneda";

// Lo que necesita atención dentro de UN proyecto. La lógica venía de la
// sección "Necesita atención" del Panel (utils/panel.js), que agrupaba por
// proyecto y mostraba un renglón por grupo ("2 compras pendientes de pago").
// Acá se abre item por item, que es lo que sirve cuando ya estás parado
// adentro del proyecto y querés saber cuál es cuál.

// Una fase "en curso" que hace este tiempo que no se toca se marca como
// estancada. Ajustable de una sola línea si a Agus le queda corto o largo.
//
// Doble moneda: cada item lleva `monto` en la
// moneda en que se cargó (`moneda`) y `montoOtra` en la otra, congelada. Lo
// que se debe a proveedores va en pesos primero (caveat 6.2: una compra
// impaga es una obligación en pesos); la cobranza, en dólares (el contrato y
// los cobros son en USD).
export const DIAS_FASE_ESTANCADA = 30;

const MS_POR_DIA = 1000 * 60 * 60 * 24;

// Qué cuenta como pendiente. Los dos primeros se exportan para que el Panel
// (utils/panel.js) y el libro de obra muestren los mismos contadores sin
// volver a escribir el criterio; los de comprobante sólo se usan acá abajo.
export const esCompraImpaga = (compra) => compra.estado_pago === "pendiente";
export const esCompraSinEntregar = (compra) => compra.estado_envio === "pedido";
const esCompraSinComprobante = (compra) => (compra.comprobantes ?? []).length === 0;
const esCobroSinComprobante = (cobro) => (cobro.comprobantes ?? []).length === 0;

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
  return otros > 0
    ? `${nombre} y ${otros} ${otros === 1 ? "producto más" : "productos más"}`
    : nombre;
}

function nombreProveedor(compra, proveedores) {
  return proveedores.find((p) => p.id === compra.proveedor_id)?.nombre ?? "Proveedor eliminado";
}

/** Normaliza una Compra al shape que consumen las tarjetas de seguimiento. */
function describirCompra(compra, productos, proveedores, hoy) {
  return {
    id: compra.id,
    proveedor: nombreProveedor(compra, proveedores),
    productos: describirProductos(compra, productos),
    descripcion: compra.descripcion,
    moneda: "ars",
    monto: precioTotalCompra(compra, "ars"),
    montoOtra: precioTotalCompra(compra, "usd"),
    fecha: compra.fecha,
    condicionPago: compra.condicion_pago,
    tipoFactura: compra.tipo_factura,
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
      moneda: "ars",
      monto: montoGasto(g, "ars"),
      montoOtra: montoGasto(g, "usd"),
      fecha: g.fecha,
      dias: diasDesde(g.fecha, hoy),
    }))
    .sort((a, b) => b.monto - a.monto);

  const cobrosSinComprobante = cobros
    .filter(esCobroSinComprobante)
    .map((c) => ({
      id: c.id,
      descripcion: c.descripcion,
      moneda: "usd",
      monto: Number(c.monto_usd) || 0,
      montoOtra: Number(c.monto_ars) || 0,
      fecha: c.fecha,
      dias: diasDesde(c.fecha, hoy),
    }))
    .sort((a, b) => b.monto - a.monto);

  // fecha_en_curso_desde (no fecha_actualizacion): ese campo se pisa con
  // cualquier edición de la fase, no solo al entrar en curso -- ver
  // comentario en el modelo Fase (backend).
  const fasesEstancadas = fases
    .filter((f) => f.estado === "en_curso" && f.fecha_en_curso_desde)
    .map((f) => ({ id: f.id, nombre: f.nombre, dias: diasDesde(f.fecha_en_curso_desde, hoy) }))
    .filter((f) => f.dias >= DIAS_FASE_ESTANCADA)
    .sort((a, b) => b.dias - a.dias);

  // Cuánto se le debe a cada proveedor dentro de este proyecto.
  const deuda = new Map();
  comprasImpagas.forEach((compra) => {
    const actual = deuda.get(compra.proveedor) ?? {
      proveedor: compra.proveedor,
      moneda: "ars",
      monto: 0,
      montoOtra: 0,
      compras: 0,
    };
    actual.monto += compra.monto;
    actual.montoOtra += compra.montoOtra;
    actual.compras += 1;
    deuda.set(compra.proveedor, actual);
  });
  const deudaPorProveedor = [...deuda.values()].sort((a, b) => b.monto - a.monto);

  const sumar = (items) => items.reduce((acc, i) => acc + i.monto, 0);
  const sumarOtra = (items) => items.reduce((acc, i) => acc + i.montoOtra, 0);

  // Cuánto falta cobrar de lo que se acordó con el cliente, en DÓLARES: el
  // contrato y los cobros son en USD. Mismo criterio que el Análisis General:
  // cobrado es la suma de los cobros NETA de notas de crédito/débito
  // (monto_neto_usd, lo calcula el backend) y el pendiente nunca es negativo
  // (si se cobró de más, queda en 0) ni cuenta centavos de redondeo
  // (saldoPorCobrar).
  const precioAcordado = Number(proyecto?.precio_acordado_usd ?? 0);
  const cobrado = cobros.reduce((acc, c) => acc + montoCobroNeto(c, "usd"), 0);
  const ultimoCobro = cobros.reduce(
    (masReciente, cobro) => (!masReciente || cobro.fecha > masReciente.fecha ? cobro : masReciente),
    null
  );

  const cobranza = {
    precioAcordado,
    cobrado,
    pendiente: saldoPorCobrar(precioAcordado, cobrado),
    pctCobrado: precioAcordado > 0 ? (cobrado / precioAcordado) * 100 : 0,
    cantidadCobros: cobros.length,
    ultimoCobro: ultimoCobro
      ? {
          fecha: ultimoCobro.fecha,
          monto: montoCobroNeto(ultimoCobro, "usd"),
          dias: diasDesde(ultimoCobro.fecha, hoy),
        }
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
    // Cada total en la moneda de sus items (ver arriba) + `*Otra` en la otra.
    totales: {
      deudaTotal: sumar(comprasImpagas),
      deudaTotalOtra: sumarOtra(comprasImpagas),
      montoSinComprobante: sumar(gastosSinComprobante),
      montoSinComprobanteOtra: sumarOtra(gastosSinComprobante),
      montoComprasSinComprobante: sumar(comprasSinComprobante),
      montoComprasSinComprobanteOtra: sumarOtra(comprasSinComprobante),
      montoCobrosSinComprobante: sumar(cobrosSinComprobante),
      montoCobrosSinComprobanteOtra: sumarOtra(cobrosSinComprobante),
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

// --- Bandeja (variante 4f) ---------------------------------------------------
//
// Una sola lista de lo que hay que resolver en el proyecto, por urgencia, con
// la acción que lo resuelve. Los grupos no son tipos de movimiento sino qué
// tan urgente es: una compra impaga hace 120 días va arriba de todo aunque
// sea "una compra", igual que un pedido sin entregar.
//
// No hay "vence esta semana": el modelo no tiene fechas de vencimiento (ni
// de compras ni de cobros), así que la urgencia sale de la antigüedad.
export const GRUPOS_BANDEJA = [
  { clave: "vencido", label: "Vencido" },
  { clave: "pendiente", label: "Pendiente" },
  { clave: "revisar", label: "Para revisar" },
];

/**
 * Arma los grupos de la bandeja a partir de `calcularSeguimiento`. Cada item:
 * `{ key, tipo, id, accion, titulo, subtitulo, estado, monto, dias }`, con
 * `tipo` en compra | gasto | cobro | fase | cobranza, `accion` en pagar |
 * entregar | adjuntar | cobrar | verFase, `estado` la clave del badge
 * (impaga | sinEntregar | sinComprobante | estancada | porCobrar) y `monto`
 * un item de `formatMontoDeItem` o null. Los grupos vacíos no se devuelven.
 */
export function armarBandeja(seguimiento, { diasVencida }) {
  const {
    cobranza,
    comprasImpagas,
    comprasSinEntregar,
    comprasSinComprobante,
    gastosSinComprobante,
    cobrosSinComprobante,
    fasesEstancadas,
  } = seguimiento;
  const porDias = (a, b) => b.dias - a.dias;

  const impagas = comprasImpagas.map((c) => ({
    key: `pagar-${c.id}`,
    tipo: "compra",
    id: c.id,
    accion: "pagar",
    titulo: c.descripcion,
    subtitulo: `${c.proveedor} · compra`,
    estado: "impaga",
    monto: c,
    dias: c.dias,
  }));

  const vencido = impagas.filter((i) => i.dias >= diasVencida).sort(porDias);

  const pendiente = [
    ...impagas.filter((i) => i.dias < diasVencida),
    ...comprasSinEntregar.map((c) => ({
      key: `entregar-${c.id}`,
      tipo: "compra",
      id: c.id,
      accion: "entregar",
      titulo: c.descripcion,
      subtitulo: `${c.proveedor} · pedido hace ${c.dias === 1 ? "1 día" : `${c.dias} días`}`,
      estado: "sinEntregar",
      monto: c,
      dias: c.dias,
    })),
  ].sort(porDias);

  // Lo que falta cobrar del contrato no tiene antigüedad: va al final de lo
  // pendiente, con su acción para cargar el cobro.
  if (cobranza.pendiente > 0) {
    pendiente.push({
      key: "cobranza",
      tipo: "cobranza",
      id: null,
      accion: "cobrar",
      titulo: "Saldo del contrato",
      subtitulo: `Cobrado ${Math.round(cobranza.pctCobrado)}% de lo acordado`,
      estado: "porCobrar",
      monto: { monto: cobranza.pendiente, montoOtra: null, moneda: "usd" },
      dias: 0,
    });
  }

  const sinComprobante = (tipo, items, subtitulo) =>
    items.map((m) => ({
      key: `adjuntar-${tipo}-${m.id}`,
      tipo,
      id: m.id,
      accion: "adjuntar",
      titulo: m.descripcion,
      subtitulo: subtitulo(m),
      estado: "sinComprobante",
      monto: m,
      dias: m.dias,
    }));

  const revisar = [
    ...sinComprobante("compra", comprasSinComprobante, (c) => `${c.proveedor} · compra`),
    ...sinComprobante("gasto", gastosSinComprobante, () => "Gasto"),
    ...sinComprobante("cobro", cobrosSinComprobante, () => "Cobro"),
    ...fasesEstancadas.map((f) => ({
      key: `fase-${f.id}`,
      tipo: "fase",
      id: f.id,
      accion: "verFase",
      titulo: f.nombre,
      subtitulo: "Fase en curso sin cambios",
      estado: "estancada",
      monto: null,
      dias: f.dias,
    })),
  ].sort(porDias);

  const items = { vencido, pendiente, revisar };
  return GRUPOS_BANDEJA.map((g) => ({ ...g, items: items[g.clave] })).filter(
    (g) => g.items.length > 0
  );
}
