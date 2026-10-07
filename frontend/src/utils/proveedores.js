// Cálculos derivados de Proveedor para el listado y el detalle. Se separa acá
// para que el listado (tarjetas) y el detalle usen siempre el mismo criterio.
import { esCompraImpaga, diasDesde } from "./seguimiento";
import { precioTotalCompra } from "./moneda";
import {
  notasDeCompras,
  totalNotasCredito as sumarNotasCredito,
  totalNotasDebito as sumarNotasDebito,
} from "./notas";

const sumar = (items, obtenerMonto) =>
  items.reduce((acc, item) => acc + (obtenerMonto(item) || 0), 0);

/** Categoría más frecuente entre los productos del proveedor; si no tiene
 * categorías cargadas, cae al tipo (Equipo/Materiales/Mano de obra) más
 * frecuente. Null si el proveedor no tiene productos. */
export function rubroPrincipal(productosDelProveedor, getTipoProducto) {
  if (productosDelProveedor.length === 0) return null;

  const porCategoria = new Map();
  productosDelProveedor.forEach((p) => {
    (p.categorias ?? []).forEach((cat) => {
      porCategoria.set(cat.nombre, (porCategoria.get(cat.nombre) ?? 0) + 1);
    });
  });

  if (porCategoria.size > 0) {
    return [...porCategoria.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }

  const porTipo = new Map();
  productosDelProveedor.forEach((p) => {
    porTipo.set(p.tipo, (porTipo.get(p.tipo) ?? 0) + 1);
  });
  const tipoMasFrecuente = [...porTipo.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return getTipoProducto(tipoMasFrecuente).label;
}

/**
 * Resumen por proveedor para el listado: cantidad de productos, total
 * histórico comprado (todas las compras, todos los proyectos) y deuda
 * pendiente (mismo criterio que "compras pendientes de pago" de Seguimiento).
 *
 * Todo en PESOS: con un proveedor se compra y se debe en pesos (catálogo en
 * pesos, decisión #4 de docs/PLAN_TIPO_CAMBIO.md, y caveat 6.2 para la deuda).
 */
export function calcularResumenProveedor(
  proveedor,
  { productos = [], compras = [], hoy = new Date() } = {}
) {
  const productosDelProveedor = productos.filter((p) => p.proveedor_id === proveedor.id);
  const comprasDelProveedor = compras.filter((c) => c.proveedor_id === proveedor.id);
  const comprasImpagas = comprasDelProveedor.filter(esCompraImpaga);
  // Notas de crédito/débito de todas las compras de este proveedor, cada una
  // con la referencia a la compra de la que vino (ver utils/notas.js).
  const notas = notasDeCompras(comprasDelProveedor);

  return {
    productosDelProveedor,
    comprasDelProveedor,
    cantidadProductos: productosDelProveedor.length,
    totalComprado: sumar(comprasDelProveedor, (c) => precioTotalCompra(c, "ars")),
    deuda: sumar(comprasImpagas, (c) => precioTotalCompra(c, "ars")),
    // Para la lista "primero a quién se le debe" (variante 4N): qué se debe,
    // hace cuánto la más vieja y cuándo fue la última compra.
    comprasImpagas,
    diasDeudaMasVieja: comprasImpagas.length
      ? Math.max(...comprasImpagas.map((c) => diasDesde(c.fecha, hoy)))
      : 0,
    ultimaCompra: comprasDelProveedor.reduce(
      (ultima, c) => (!ultima || c.fecha > ultima ? c.fecha : ultima),
      null
    ),
    notas,
    totalNotasCredito: sumarNotasCredito(notas),
    totalNotasDebito: sumarNotasDebito(notas),
  };
}
