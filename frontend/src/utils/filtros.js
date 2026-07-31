// Filtros compartidos para las listas de Compras / Cobros / Gastos que se
// repiten en Acciones (proyecto), FaseDetalle y ProveedorDetalle. Todo el
// filtrado es client-side sobre datos ya traídos (no pega al backend de
// nuevo), así que estas son funciones puras que reciben el array completo y
// devuelven el subconjunto que matchea.

export const FILTRO_NOTAS = [
  { value: "todas", label: "Todas" },
  { value: "con_credito", label: "Con nota de crédito" },
  { value: "con_debito", label: "Con nota de débito" },
  { value: "sin_notas", label: "Sin notas" },
];

export const FILTRO_ESTADO_PAGO = [
  { value: "todos", label: "Cualquier estado de pago" },
  { value: "pagado", label: "Pagado" },
  { value: "pendiente", label: "Pendiente" },
];

export const FILTRO_ESTADO_ENVIO = [
  { value: "todos", label: "Cualquier estado de envío" },
  { value: "entregado", label: "Entregado" },
  { value: "pedido", label: "Pedido" },
];

export const FILTRO_COMPROBANTE = [
  { value: "todos", label: "Con o sin comprobante" },
  { value: "con", label: "Con comprobante" },
  { value: "sin", label: "Sin comprobante" },
];

export const FILTROS_VACIOS = {
  desde: "",
  hasta: "",
  tipoFactura: "",
  notas: "todas",
  estadoPago: "todos",
  estadoEnvio: "todos",
  comprobante: "todos",
};

function coincideFecha(fecha, desde, hasta) {
  if (desde && fecha < desde) return false;
  if (hasta && fecha > hasta) return false;
  return true;
}

function coincideNotas(notas, filtroNotas) {
  if (!filtroNotas || filtroNotas === "todas") return true;
  const tieneCredito = (notas ?? []).some((n) => n.tipo === "nota_credito");
  const tieneDebito = (notas ?? []).some((n) => n.tipo === "nota_debito");
  if (filtroNotas === "con_credito") return tieneCredito;
  if (filtroNotas === "con_debito") return tieneDebito;
  if (filtroNotas === "sin_notas") return !tieneCredito && !tieneDebito;
  return true;
}

function coincideComprobante(comprobantes, filtroComprobante) {
  if (!filtroComprobante || filtroComprobante === "todos") return true;
  const tiene = (comprobantes ?? []).length > 0;
  return filtroComprobante === "con" ? tiene : !tiene;
}

export function filtrarCompras(compras, filtros = FILTROS_VACIOS) {
  return compras.filter((c) => {
    if (!coincideFecha(c.fecha, filtros.desde, filtros.hasta)) return false;
    if (filtros.tipoFactura && c.tipo_factura !== filtros.tipoFactura) return false;
    if (!coincideNotas(c.notas, filtros.notas)) return false;
    if (filtros.estadoPago && filtros.estadoPago !== "todos" && c.estado_pago !== filtros.estadoPago) return false;
    if (filtros.estadoEnvio && filtros.estadoEnvio !== "todos" && c.estado_envio !== filtros.estadoEnvio) return false;
    return true;
  });
}

export function filtrarCobros(cobros, filtros = FILTROS_VACIOS) {
  return cobros.filter((c) => {
    if (!coincideFecha(c.fecha, filtros.desde, filtros.hasta)) return false;
    if (filtros.tipoFactura && c.tipo_factura !== filtros.tipoFactura) return false;
    if (!coincideNotas(c.notas, filtros.notas)) return false;
    if (!coincideComprobante(c.comprobantes, filtros.comprobante)) return false;
    return true;
  });
}

export function filtrarGastos(gastos, filtros = FILTROS_VACIOS) {
  return gastos.filter((g) => {
    if (!coincideFecha(g.fecha, filtros.desde, filtros.hasta)) return false;
    if (filtros.tipoFactura && g.tipo_factura !== filtros.tipoFactura) return false;
    if (!coincideComprobante(g.comprobantes, filtros.comprobante)) return false;
    return true;
  });
}

export function hayFiltrosActivos(filtros) {
  if (!filtros) return false;
  return Boolean(
    filtros.desde ||
      filtros.hasta ||
      filtros.tipoFactura ||
      (filtros.notas && filtros.notas !== "todas") ||
      (filtros.estadoPago && filtros.estadoPago !== "todos") ||
      (filtros.estadoEnvio && filtros.estadoEnvio !== "todos") ||
      (filtros.comprobante && filtros.comprobante !== "todos")
  );
}
