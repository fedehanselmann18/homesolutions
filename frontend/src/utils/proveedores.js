// Cálculos derivados de Proveedor para el listado y el detalle. Se separa acá
// para que el listado (tarjetas) y el detalle usen siempre el mismo criterio.
import { esCompraImpaga, diasDesde } from "./seguimiento";
import { precioTotalCompra } from "./moneda";
import { diasVencida, pendienteCompra } from "./plazos";
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
 * pesos).
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
    // Lo que falta pagar (sin los plazos ya pagados), no el total de cada compra.
    deuda: sumar(comprasImpagas, (c) => pendienteCompra(c, "ars")),
    // Para la lista "primero a quién se le debe" (variante 4N): qué se debe,
    // hace cuánto la más vieja y cuándo fue la última compra.
    comprasImpagas,
    diasDeudaMasVieja: comprasImpagas.length
      ? Math.max(...comprasImpagas.map((c) => diasDesde(c.fecha, hoy)))
      : 0,
    // El plazo vencido más viejo (null si no hay nada vencido): pinta de rojo.
    diasVencidaMasVieja: comprasImpagas.reduce((max, c) => {
      const dias = diasVencida(c, hoy);
      return dias && (!max || dias > max) ? dias : max;
    }, null),
    ultimaCompra: comprasDelProveedor.reduce(
      (ultima, c) => (!ultima || c.fecha > ultima ? c.fecha : ultima),
      null
    ),
    notas,
    totalNotasCredito: sumarNotasCredito(notas),
    totalNotasDebito: sumarNotasDebito(notas),
  };
}

const sinSeparadores = (texto) => texto.replace(/[\s.()-]/g, "");

/**
 * Si el proveedor coincide con lo que se escribió en el buscador de la lista:
 * por nombre y también por los datos que muestra su ficha (CUIT, teléfono,
 * email, dirección). CUIT y teléfono se comparan además sin guiones, puntos ni
 * espacios: "30712345678" encuentra "30-71234567-8".
 */
export function coincideBusquedaProveedor(proveedor, busqueda) {
  const texto = busqueda.trim().toLowerCase();
  if (!texto) return true;

  const { nombre, cuit, telefono, email, direccion } = proveedor;
  const coincideTexto = [nombre, cuit, telefono, email, direccion].some((campo) =>
    (campo ?? "").toLowerCase().includes(texto)
  );
  if (coincideTexto) return true;

  const numero = sinSeparadores(texto);
  return (
    /^\d+$/.test(numero) &&
    [cuit, telefono].some((campo) => sinSeparadores(campo ?? "").includes(numero))
  );
}
