import { calcularAnalisis, gastosPorCategoria, topProveedores } from "./analisis";
import { armarEvolucion } from "./panel";
import { hoyISO } from "./formato";
import { MONEDA_ANALISIS_DEFAULT, precioAcordado as precioAcordadoEn } from "./moneda";
import {
  CATEGORIA_COMPRAS,
  PCT_EJECUTADO_ATENCION,
  PERIODOS_METRICAS,
  PERIODO_METRICAS_DEFAULT,
  PESO_NIVEL_OBRA,
  TOP_PROVEEDORES_METRICAS,
} from "../constants/metricas";

// Métricas del negocio: ingresos, egresos, resultado y rentabilidad de las
// obras en un período. Como el Panel, cada obra pasa por `calcularAnalisis`
// (el mismo cálculo de la pestaña Análisis General) y los KPIs son la suma de
// las obras: así los números no pueden divergir de las otras pantallas.
//
// Los porcentajes (rentabilidad, % ejecutado) salen SIEMPRE de los dólares
// congelados, también en la vista en pesos: comparar pesos de marzo con pesos
// de octubre mezcla inflación con ganancia.

function sumar(items, obtenerMonto) {
  return items.reduce((acc, item) => acc + (obtenerMonto(item) || 0), 0);
}

function agrupar(items, obtenerClave) {
  const mapa = new Map();
  items.forEach((item) => {
    const clave = obtenerClave(item);
    if (!mapa.has(clave)) mapa.set(clave, []);
    mapa.get(clave).push(item);
  });
  return mapa;
}

function porcentaje(parte, total) {
  if (!total) return 0;
  return (parte / total) * 100;
}

/** null si no hubo ingresos: sin ingresos no hay rentabilidad que medir. */
function rentabilidad(resultadoUsd, ingresosUsd) {
  return ingresosUsd > 0 ? (resultadoUsd / ingresosUsd) * 100 : null;
}

/** "2026-07-27" -> Date local del 1° de ese mes (sin pasar por UTC). */
function primeroDelMes(fecha) {
  const [anio, mes] = String(fecha).split("-").map(Number);
  return new Date(anio, mes - 1, 1);
}

function mesesEntre(desde, hasta) {
  return (hasta.getFullYear() - desde.getFullYear()) * 12 + hasta.getMonth() - desde.getMonth() + 1;
}

/**
 * Fecha desde la que cuenta el período ("AAAA-MM-DD", local) o null para
 * "todo". Los períodos son meses calendario completos contando el actual.
 */
export function inicioPeriodo(periodo, hoy = new Date()) {
  if (periodo === "todo") return null;
  if (periodo === "anio") return hoyISO(new Date(hoy.getFullYear(), 0, 1));
  const definicion =
    PERIODOS_METRICAS.find((p) => p.value === periodo) ??
    PERIODOS_METRICAS.find((p) => p.value === PERIODO_METRICAS_DEFAULT);
  return hoyISO(new Date(hoy.getFullYear(), hoy.getMonth() - (definicion.meses - 1), 1));
}

/**
 * Badge de la obra, mirando la obra ENTERA contra su contrato (no el
 * período): un filtro de "mes actual" no puede pintar de rojo una obra
 * porque este mes hubo gastos y el anticipo se cobró en julio.
 */
export function nivelObra({ resultadoUsd, pctEjecutado }) {
  if (resultadoUsd < 0) return "problema";
  if (pctEjecutado == null) return "sin_dato";
  if (pctEjecutado > PCT_EJECUTADO_ATENCION) return "atencion";
  return "resuelto";
}

/**
 * Todo lo que muestra la página Métricas.
 *
 * - `periodo`: un value de PERIODOS_METRICAS. Filtra cada movimiento por SU
 *   fecha (una nota viaja con la fecha de su compra o cobro, como en el Panel).
 * - `obras`: ids de proyecto a incluir; vacío o null = todas.
 * - `moneda`: "usd" | "ars" para los montos. Los % siempre en USD.
 * - `cotizacionActual`: sólo para el precio acordado en pesos.
 *
 * Devuelve { kpis, evolucionMensual, rentabilidadPorObra,
 * egresosPorCategoria, topProveedores, filasObras, rango, moneda }.
 */
export function calcularMetricas({
  proyectos = [],
  fases = [],
  gastos = [],
  cobros = [],
  compras = [],
  proveedores = [],
  periodo = PERIODO_METRICAS_DEFAULT,
  obras = null,
  moneda = MONEDA_ANALISIS_DEFAULT,
  cotizacionActual = null,
  hoy = new Date(),
}) {
  const idsObras = obras?.length ? new Set(obras.map(String)) : null;
  const seleccionados = proyectos.filter((p) => !idsObras || idsObras.has(String(p.id)));

  const proyectoDeFase = new Map(fases.map((f) => [f.id, f.proyecto_id]));
  const fasesPorProyecto = agrupar(fases, (f) => f.proyecto_id);
  const gastosPorProyecto = agrupar(gastos, (g) => g.proyecto_id);
  const cobrosPorProyecto = agrupar(cobros, (c) => c.proyecto_id);
  const comprasPorProyecto = agrupar(compras, (c) => proyectoDeFase.get(c.fase_id));

  const desde = inicioPeriodo(periodo, hoy);
  const enPeriodo = (items) => (desde ? items.filter((m) => String(m.fecha) >= desde) : items);

  const resumenes = seleccionados.map((proyecto) => {
    const fasesDelProyecto = fasesPorProyecto.get(proyecto.id) ?? [];
    const todo = {
      gastos: gastosPorProyecto.get(proyecto.id) ?? [],
      cobros: cobrosPorProyecto.get(proyecto.id) ?? [],
      compras: comprasPorProyecto.get(proyecto.id) ?? [],
    };
    const delPeriodo = {
      gastos: enPeriodo(todo.gastos),
      cobros: enPeriodo(todo.cobros),
      compras: enPeriodo(todo.compras),
    };
    const analizar = (movimientos, monedaAnalisis) =>
      calcularAnalisis({
        proyecto,
        fases: fasesDelProyecto,
        ...movimientos,
        moneda: monedaAnalisis,
        cotizacionActual,
      });

    const periodoMoneda = analizar(delPeriodo, moneda);
    const periodoUsd = moneda === "usd" ? periodoMoneda : analizar(delPeriodo, "usd");
    const obraUsd = analizar(todo, "usd");

    return { proyecto, delPeriodo, periodoMoneda, periodoUsd, obraUsd };
  });

  // Sólo las obras con algún movimiento en el período: una obra sin nada no
  // tiene ingresos ni egresos que mostrar.
  const conMovimientos = resumenes.filter(
    ({ delPeriodo }) =>
      delPeriodo.gastos.length + delPeriodo.cobros.length + delPeriodo.compras.length > 0
  );

  const filas = conMovimientos.map(({ proyecto, periodoMoneda, periodoUsd, obraUsd }) => {
    const precioAcordadoUsd = precioAcordadoEn(proyecto, "usd");
    const pctEjecutado = precioAcordadoUsd > 0 ? obraUsd.totales.pctGastado : null;
    return {
      id: proyecto.id,
      nombre: proyecto.nombre,
      estado: proyecto.estado,
      moneda,
      precioAcordado: periodoMoneda.totales.precioAcordado,
      ingresos: periodoMoneda.totales.cobrado,
      egresos: periodoMoneda.totales.egresos,
      compras: periodoMoneda.totales.compras,
      resultado: periodoMoneda.totales.disponible,
      ingresosUsd: periodoUsd.totales.cobrado,
      resultadoUsd: periodoUsd.totales.disponible,
      rentabilidad: rentabilidad(periodoUsd.totales.disponible, periodoUsd.totales.cobrado),
      pctEjecutado,
      nivel: nivelObra({ resultadoUsd: obraUsd.totales.disponible, pctEjecutado }),
    };
  });

  const ingresos = sumar(filas, (f) => f.ingresos);
  const egresos = sumar(filas, (f) => f.egresos);
  const totalCompras = sumar(filas, (f) => f.compras);

  // Movimientos de las obras incluidas, para los bloques que agrupan por algo
  // que no es la obra (mes, categoría, proveedor).
  const movimientos = {
    gastos: resumenes.flatMap((r) => r.delPeriodo.gastos),
    cobros: resumenes.flatMap((r) => r.delPeriodo.cobros),
    compras: resumenes.flatMap((r) => r.delPeriodo.compras),
  };

  // El gráfico arranca en el mes de `desde` (o del primer movimiento, en
  // "todo") y llega hasta hoy, o hasta el último movimiento si hay alguno con
  // fecha adelantada: así las barras suman lo mismo que los KPIs.
  const fechas = [...movimientos.gastos, ...movimientos.cobros, ...movimientos.compras]
    .map((m) => String(m.fecha))
    .sort();
  const ultima = fechas.length ? primeroDelMes(fechas[fechas.length - 1]) : null;
  const fin = ultima && ultima > hoy ? ultima : hoy;
  const inicio = primeroDelMes(desde ?? fechas[0] ?? hoyISO(hoy));
  const evolucionMensual = armarEvolucion(
    movimientos.gastos,
    movimientos.cobros,
    movimientos.compras,
    fin,
    moneda,
    Math.max(1, mesesEntre(inicio, fin))
  ).map(({ mes, label, etiquetaCompleta, cobrado, gastado }) => ({
    mes,
    label,
    etiquetaCompleta,
    ingresos: cobrado,
    egresos: gastado,
  }));

  const egresosPorCategoria = [
    ...gastosPorCategoria(movimientos.gastos, moneda),
    ...(totalCompras ? [{ nombre: CATEGORIA_COMPRAS, monto: totalCompras }] : []),
  ]
    .sort((a, b) => b.monto - a.monto)
    .map((c) => ({ ...c, pct: porcentaje(c.monto, egresos) }));

  const proveedoresTop = topProveedores(
    movimientos.compras,
    proveedores,
    moneda,
    TOP_PROVEEDORES_METRICAS
  ).map((p) => ({ ...p, pct: porcentaje(p.monto, totalCompras) }));

  const rentabilidadPorObra = filas
    .filter((f) => f.rentabilidad != null)
    .map(({ id, nombre, rentabilidad: pct, resultado }) => ({
      id,
      nombre,
      rentabilidad: pct,
      resultado,
    }))
    .sort((a, b) => b.rentabilidad - a.rentabilidad);

  const filasObras = [...filas].sort(
    (a, b) => PESO_NIVEL_OBRA[b.nivel] - PESO_NIVEL_OBRA[a.nivel] || b.egresos - a.egresos
  );

  return {
    moneda,
    rango: { desde, hasta: hoyISO(hoy) },
    kpis: {
      ingresos,
      egresos,
      resultado: sumar(filas, (f) => f.resultado),
      rentabilidad: rentabilidad(
        sumar(filas, (f) => f.resultadoUsd),
        sumar(filas, (f) => f.ingresosUsd)
      ),
    },
    evolucionMensual,
    rentabilidadPorObra,
    egresosPorCategoria,
    topProveedores: proveedoresTop,
    filasObras,
  };
}
