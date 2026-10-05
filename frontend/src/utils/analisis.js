import { ESTADO_LABELS } from "../constants/estados";
import { getTipoFacturaLabel } from "../constants/tipoFactura";
import { getTipoProducto } from "../constants/tipoProducto";
import { notasDeCompras, notasDeCobros, totalNotasCredito, totalNotasDebito } from "./notas";

const SIN_CATEGORIA = "Sin categoría";
const SIN_FASE = "Sin fase";

function porcentaje(parte, total) {
  if (!total) return 0;
  return (parte / total) * 100;
}

function sumar(items, obtenerMonto) {
  return items.reduce((acc, item) => acc + (obtenerMonto(item) || 0), 0);
}

function aLista(mapa) {
  return Object.entries(mapa).map(([nombre, monto]) => ({ nombre, monto }));
}

function impuestosDeCompra(compra) {
  return sumar(compra.impuestos_aplicados ?? [], (i) => i.monto);
}

/**
 * Un Gasto puede tener varias categorías (relación N a N). El monto se reparte
 * en partes iguales entre ellas para que la suma del gráfico dé exactamente el
 * total de gastos del proyecto y no se cuente el mismo gasto dos veces.
 */
function gastosPorCategoria(gastos) {
  const acumulado = {};
  gastos.forEach((gasto) => {
    const categorias = gasto.categorias?.length ? gasto.categorias : [{ nombre: SIN_CATEGORIA }];
    const porCategoria = gasto.monto / categorias.length;
    categorias.forEach((cat) => {
      acumulado[cat.nombre] = (acumulado[cat.nombre] ?? 0) + porCategoria;
    });
  });
  return aLista(acumulado).sort((a, b) => b.monto - a.monto);
}

function impuestosPorTipo(compras) {
  const acumulado = {};
  compras.forEach((compra) => {
    (compra.impuestos_aplicados ?? []).forEach((aplicado) => {
      const nombre = aplicado.impuesto?.nombre ?? "Impuesto";
      acumulado[nombre] = (acumulado[nombre] ?? 0) + aplicado.monto;
    });
  });
  return aLista(acumulado).sort((a, b) => b.monto - a.monto);
}

/**
 * Jerarquía para el treemap: tipo de producto (equipo/materiales/mano de obra)
 * como nivel superior y cada producto comprado adentro. Se calcula sobre el
 * detalle de las compras (cantidad x precio unitario), que es el único lugar
 * donde el gasto está abierto por producto.
 */
function comprasPorTipoYProducto(compras, productos) {
  const porTipo = {};
  compras.forEach((compra) => {
    (compra.detalle ?? []).forEach((linea) => {
      const producto = productos.find((p) => p.id === linea.producto_id);
      const tipo = producto?.tipo ?? "otros";
      const nombreProducto = producto
        ? `${producto.marca} ${producto.modelo}`
        : "Producto eliminado";
      const monto = linea.cantidad * linea.precio_unitario;

      porTipo[tipo] = porTipo[tipo] ?? {};
      porTipo[tipo][nombreProducto] = (porTipo[tipo][nombreProducto] ?? 0) + monto;
    });
  });

  return Object.entries(porTipo)
    .map(([tipo, productosDelTipo]) => {
      const info = getTipoProducto(tipo);
      const children = aLista(productosDelTipo)
        .sort((a, b) => b.monto - a.monto)
        // el color se propaga a cada hoja: el treemap dibuja los hijos y no
        // tiene forma directa de leer el color del padre
        .map((p, i) => ({ name: p.nombre, monto: p.monto, color: info.color, indice: i }));
      return {
        name: info.label,
        color: info.color,
        monto: sumar(children, (c) => c.monto),
        children,
      };
    })
    .sort((a, b) => b.monto - a.monto);
}

/** Pagos = salidas de dinero (gastos + compras), agrupadas por tipo de factura. */
function pagosPorTipoFactura(gastos, compras) {
  const acumulado = {};
  const registrar = (tipo, monto) => {
    acumulado[tipo] = acumulado[tipo] ?? { cantidad: 0, monto: 0 };
    acumulado[tipo].cantidad += 1;
    acumulado[tipo].monto += monto;
  };

  gastos.forEach((gasto) => registrar(gasto.tipo_factura, gasto.monto));
  compras.forEach((compra) => registrar(compra.tipo_factura, compra.precio_total));

  return Object.entries(acumulado)
    .map(([tipo, datos]) => ({ tipo, label: getTipoFacturaLabel(tipo), ...datos }))
    .sort((a, b) => b.monto - a.monto);
}

function avancePorEstadoDeFase(fases) {
  return Object.keys(ESTADO_LABELS)
    .map((estado) => ({
      estado,
      label: ESTADO_LABELS[estado].label,
      color: ESTADO_LABELS[estado].color,
      cantidad: fases.filter((f) => f.estado === estado).length,
    }))
    .filter((seccion) => seccion.cantidad > 0);
}

function egresosPorFase(fases, gastos, compras) {
  const filas = fases.map((fase) => ({
    faseId: fase.id,
    nombre: fase.nombre,
    gastos: sumar(
      gastos.filter((g) => g.fase_id === fase.id),
      (g) => g.monto
    ),
    compras: sumar(
      compras.filter((c) => c.fase_id === fase.id),
      (c) => c.precio_total
    ),
  }));

  const gastosSinFase = gastos.filter((g) => !g.fase_id);
  if (gastosSinFase.length > 0) {
    filas.push({
      faseId: null,
      nombre: SIN_FASE,
      gastos: sumar(gastosSinFase, (g) => g.monto),
      compras: 0,
    });
  }

  return filas
    .map((fila) => ({ ...fila, total: fila.gastos + fila.compras }))
    .filter((fila) => fila.total > 0)
    .sort((a, b) => b.total - a.total);
}

/**
 * Dona "cobrado vs. gastado por fase": el total es lo cobrado, repartido en
 * disponible + lo comprado en cada fase + los gastos (los gastos van en una
 * sola porción, no por fase, porque a diferencia de las compras no siempre
 * están atados a una fase -- ver SIN_FASE en egresosPorFase). Si el proyecto
 * está en rojo (se gastó más de lo cobrado) no hay "disponible" que mostrar
 * -- ahí la base pasa a ser el total gastado, para no dibujar una porción
 * negativa.
 */
function cobradoPorFase(fases, compras, totalGastos, totalCobrado, totalEgresos) {
  const disponible = totalCobrado - totalEgresos;
  const hayDisponible = disponible > 0;
  const base = hayDisponible ? totalCobrado : totalEgresos;

  const filas = hayDisponible ? [{ nombre: "Disponible", monto: disponible }] : [];

  fases
    .map((fase) => ({
      nombre: `Comprado en ${fase.nombre}`,
      monto: sumar(
        compras.filter((c) => c.fase_id === fase.id),
        (c) => c.precio_total
      ),
    }))
    .filter((fila) => fila.monto > 0)
    .sort((a, b) => b.monto - a.monto)
    .forEach((fila) => filas.push(fila));

  if (totalGastos > 0) {
    filas.push({ nombre: "Gastos", monto: totalGastos });
  }

  return filas.map((f) => ({ ...f, pct: porcentaje(f.monto, base) }));
}

function topProveedores(compras, proveedores, limite = 5) {
  const acumulado = {};
  compras.forEach((compra) => {
    const nombre =
      proveedores.find((p) => p.id === compra.proveedor_id)?.nombre ?? "Proveedor eliminado";
    acumulado[nombre] = (acumulado[nombre] ?? 0) + compra.precio_total;
  });
  return aLista(acumulado)
    .sort((a, b) => b.monto - a.monto)
    .slice(0, limite);
}

/**
 * Convierte los pasos de la cascada en barras flotantes [desde, hasta]: los
 * pasos "subtotal"/"total" arrancan en cero y los demás siguen desde donde
 * terminó el paso anterior.
 */
function armarCascada(pasos) {
  let acumulado = 0;
  return pasos.map((paso) => {
    const arrancaEnCero = paso.tipo === "subtotal" || paso.tipo === "total";
    const desde = arrancaEnCero ? 0 : acumulado;
    const hasta = arrancaEnCero ? paso.valor : acumulado + paso.valor;
    acumulado = hasta;
    return { ...paso, rango: [desde, hasta] };
  });
}

export function calcularAnalisis({
  proyecto,
  fases = [],
  gastos = [],
  cobros = [],
  compras = [],
  productos = [],
  proveedores = [],
}) {
  // Cobrado NETO: monto_neto ya viene calculado por el backend (Cobro.monto_neto
  // = monto - notas de crédito + notas de débito, ver app/db/models.py). Usar
  // el bruto acá sería ignorar los ajustes de precio hechos al cliente.
  const totalCobrado = sumar(cobros, (c) => c.monto_neto ?? c.monto);
  const totalGastos = sumar(gastos, (g) => g.monto);
  const totalComprasNeto = sumar(compras, (c) => c.precio_neto);
  const totalImpuestos = sumar(compras, impuestosDeCompra);

  // Notas de crédito/débito de las compras de este proyecto (cuenta corriente
  // con los proveedores) -- devolución de producto, reposición, acuerdo
  // comercial, etc. Ver utils/notas.js.
  const notasCompra = notasDeCompras(compras);
  const notasCreditoCompras = totalNotasCredito(notasCompra);
  const notasDebitoCompras = totalNotasDebito(notasCompra);
  const ajusteNotasCompras = notasDebitoCompras - notasCreditoCompras; // + si suma a lo que se debe, - si resta

  // Mismo criterio del lado de los cobros (ajustes de precio al cliente).
  const notasCobro = notasDeCobros(cobros);
  const notasCreditoCobros = totalNotasCredito(notasCobro);
  const notasDebitoCobros = totalNotasDebito(notasCobro);

  // totalCompras tiene que coincidir con sum(compra.precio_total) -- antes
  // de este fix sumaba precio_neto + impuestos y SE OLVIDABA de las notas,
  // así que una devolución de producto no bajaba nada acá.
  const totalCompras = totalComprasNeto + totalImpuestos + ajusteNotasCompras;
  const totalEgresos = totalGastos + totalCompras;
  const disponible = totalCobrado - totalEgresos;
  const margenBruto = totalCobrado - totalGastos - totalComprasNeto - ajusteNotasCompras;

  const precioAcordado = proyecto?.precio_acordado_usd ?? 0;

  const categorias = gastosPorCategoria(gastos);
  const impuestos = impuestosPorTipo(compras);
  const filasEgresosPorFase = egresosPorFase(fases, gastos, compras);

  return {
    totales: {
      cobrado: totalCobrado,
      gastos: totalGastos,
      comprasNeto: totalComprasNeto,
      compras: totalCompras,
      impuestos: totalImpuestos,
      egresos: totalEgresos,
      disponible,
      margenBruto,
      precioAcordado,
      pctCobrado: porcentaje(totalCobrado, precioAcordado),
      pctGastado: porcentaje(totalEgresos, precioAcordado),
      notasCreditoCompras,
      notasDebitoCompras,
      notasCreditoCobros,
      notasDebitoCobros,
    },
    cascada: armarCascada([
      { nombre: "Cobrado", valor: totalCobrado, tipo: "entrada" },
      { nombre: "Gastos", valor: -totalGastos, tipo: "salida" },
      { nombre: "Compras", valor: -totalComprasNeto, tipo: "salida" },
      { nombre: "Notas (compras)", valor: -ajusteNotasCompras, tipo: "ajuste" },
      { nombre: "Margen bruto", valor: margenBruto, tipo: "subtotal" },
      { nombre: "Impuestos", valor: -totalImpuestos, tipo: "salida" },
      { nombre: "Ganancia neta", valor: disponible, tipo: "total" },
    ]),
    gastosPorCategoria: categorias.map((c) => ({ ...c, pct: porcentaje(c.monto, totalGastos) })),
    impuestosPorTipo: impuestos.map((i) => ({ ...i, pct: porcentaje(i.monto, totalImpuestos) })),
    comprasPorTipoYProducto: comprasPorTipoYProducto(compras, productos),
    pagosPorTipoFactura: pagosPorTipoFactura(gastos, compras),
    avanceFases: avancePorEstadoDeFase(fases),
    egresosPorFase: filasEgresosPorFase,
    cobradoPorFase: cobradoPorFase(fases, compras, totalGastos, totalCobrado, totalEgresos),
    gastosSinComprobante: {
      cantidad: gastos.filter((g) => !g.comprobantes?.length).length,
      monto: sumar(
        gastos.filter((g) => !g.comprobantes?.length),
        (g) => g.monto
      ),
    },
    topProveedores: topProveedores(compras, proveedores),
    notas: {
      compras: {
        credito: notasCreditoCompras,
        debito: notasDebitoCompras,
        cantidad: notasCompra.length,
      },
      cobros: {
        credito: notasCreditoCobros,
        debito: notasDebitoCobros,
        cantidad: notasCobro.length,
      },
    },
  };
}
