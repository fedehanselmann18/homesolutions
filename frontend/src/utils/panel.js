import { calcularAnalisis } from "./analisis";
import { esCompraImpaga, esCompraSinEntregar } from "./seguimiento";

// Cuántos movimientos y cuántos meses se muestran en los bloques de abajo.
const MOVIMIENTOS_RECIENTES = 8;
const MESES_EVOLUCION = 6;

// Una fase "auditada" ya está cerrada: cuenta como terminada para el avance,
// mismo criterio que usa la pestaña de Fases del proyecto.
const ESTADOS_FASE_CERRADA = ["terminada", "auditada"];

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

/** "2026-07-27" -> "2026-07". Se compara como texto para no pelear con timezones. */
function claveMes(fecha) {
  return String(fecha).slice(0, 7);
}

function claveMesDeDate(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`;
}

function impuestosDeCompra(compra) {
  return sumar(compra.impuestos_aplicados ?? [], (i) => i.monto);
}

function armarActividad(resumenes) {
  const movimientos = [];

  resumenes.forEach(({ proyecto, gastosDelProyecto, cobrosDelProyecto, comprasDelProyecto }) => {
    const comun = { proyectoId: proyecto.id, proyectoNombre: proyecto.nombre };
    cobrosDelProyecto.forEach((c) =>
      movimientos.push({ ...comun, id: c.id, tipo: "cobro", descripcion: c.descripcion, monto: c.monto, fecha: c.fecha })
    );
    gastosDelProyecto.forEach((g) =>
      movimientos.push({ ...comun, id: g.id, tipo: "gasto", descripcion: g.descripcion, monto: g.monto, fecha: g.fecha })
    );
    comprasDelProyecto.forEach((c) =>
      movimientos.push({ ...comun, id: c.id, tipo: "compra", descripcion: c.descripcion, monto: c.precio_total, fecha: c.fecha })
    );
  });

  return movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MOVIMIENTOS_RECIENTES);
}

function armarEvolucion(gastos, cobros, compras, hoy) {
  const meses = [];
  for (let i = MESES_EVOLUCION - 1; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({
      mes: claveMesDeDate(fecha),
      label: fecha.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
      etiquetaCompleta: fecha.toLocaleDateString("es-AR", { month: "long", year: "numeric" }),
      cobrado: 0,
      gastado: 0,
    });
  }

  const porMes = new Map(meses.map((m) => [m.mes, m]));
  cobros.forEach((c) => {
    const mes = porMes.get(claveMes(c.fecha));
    if (mes) mes.cobrado += c.monto;
  });
  gastos.forEach((g) => {
    const mes = porMes.get(claveMes(g.fecha));
    if (mes) mes.gastado += g.monto;
  });
  compras.forEach((c) => {
    const mes = porMes.get(claveMes(c.fecha));
    if (mes) mes.gastado += c.precio_total;
  });

  return meses;
}

/**
 * Resumen de TODOS los proyectos para el Panel.
 *
 * Cada proyecto se pasa por `calcularAnalisis` (el mismo cálculo que usa la
 * pestaña Análisis General) para que los números del Panel y los del detalle
 * de un proyecto no puedan divergir nunca.
 */
export function calcularPanel({
  proyectos = [],
  fases = [],
  gastos = [],
  cobros = [],
  compras = [],
  hoy = new Date(),
}) {
  const proyectoDeFase = new Map(fases.map((f) => [f.id, f.proyecto_id]));

  const fasesPorProyecto = agrupar(fases, (f) => f.proyecto_id);
  const gastosPorProyecto = agrupar(gastos, (g) => g.proyecto_id);
  const cobrosPorProyecto = agrupar(cobros, (c) => c.proyecto_id);
  const comprasPorProyecto = agrupar(compras, (c) => proyectoDeFase.get(c.fase_id));

  const resumenes = proyectos.map((proyecto) => {
    const fasesDelProyecto = fasesPorProyecto.get(proyecto.id) ?? [];
    const gastosDelProyecto = gastosPorProyecto.get(proyecto.id) ?? [];
    const cobrosDelProyecto = cobrosPorProyecto.get(proyecto.id) ?? [];
    const comprasDelProyecto = comprasPorProyecto.get(proyecto.id) ?? [];

    return {
      proyecto,
      fasesDelProyecto,
      gastosDelProyecto,
      cobrosDelProyecto,
      comprasDelProyecto,
      analisis: calcularAnalisis({
        proyecto,
        fases: fasesDelProyecto,
        gastos: gastosDelProyecto,
        cobros: cobrosDelProyecto,
        compras: comprasDelProyecto,
      }),
    };
  });

  const enCurso = resumenes.filter((r) => r.proyecto.estado === "en_curso");
  const mesActual = claveMesDeDate(hoy);
  const delMes = (items) => items.filter((i) => claveMes(i.fecha) === mesActual);

  const cobradoMes = sumar(delMes(cobros), (c) => c.monto);
  const gastosMes = sumar(delMes(gastos), (g) => g.monto);
  const comprasDelMes = delMes(compras);
  const comprasNetoMes = sumar(comprasDelMes, (c) => c.precio_neto);
  const impuestosMes = sumar(comprasDelMes, impuestosDeCompra);

  // Lo que falta cobrar de los proyectos vivos: nunca negativo, si un proyecto
  // cobró de más no compensa lo que falta cobrar en otro.
  const pendienteDeCobrar = enCurso.reduce(
    (acc, r) => acc + Math.max(0, r.analisis.totales.precioAcordado - r.analisis.totales.cobrado),
    0
  );

  return {
    kpis: {
      enCurso: enCurso.length,
      terminados: resumenes.filter((r) => r.proyecto.estado === "terminado").length,
      aIniciar: resumenes.filter((r) => r.proyecto.estado === "a_iniciar").length,
      disponibleTotal: sumar(enCurso, (r) => r.analisis.totales.disponible),
      cobradoMes,
      pendienteDeCobrar,
      gananciaNetaMes: cobradoMes - gastosMes - comprasNetoMes - impuestosMes,
      contratadoEnCurso: sumar(enCurso, (r) => r.analisis.totales.precioAcordado),
    },
    proyectosActivos: enCurso
      .map(({ proyecto, analisis, fasesDelProyecto, comprasDelProyecto }) => {
        const cerradas = fasesDelProyecto.filter((f) => ESTADOS_FASE_CERRADA.includes(f.estado)).length;
        const impagas = comprasDelProyecto.filter(esCompraImpaga);
        return {
          id: proyecto.id,
          nombre: proyecto.nombre,
          direccion: proyecto.direccion,
          precioAcordado: analisis.totales.precioAcordado,
          egresos: analisis.totales.egresos,
          disponible: analisis.totales.disponible,
          pctPresupuesto: analisis.totales.pctGastado,
          pctCobrado: analisis.totales.pctCobrado,
          fasesCerradas: cerradas,
          fasesTotales: fasesDelProyecto.length,
          pctFases: fasesDelProyecto.length ? (cerradas / fasesDelProyecto.length) * 100 : 0,
          // Pendientes de compra del proyecto: mismo criterio que la pestaña
          // Seguimiento, que es donde se ve el detalle de cada una.
          comprasImpagas: impagas.length,
          montoImpago: sumar(impagas, (c) => c.precio_total),
          comprasSinEntregar: comprasDelProyecto.filter(esCompraSinEntregar).length,
        };
      })
      .sort((a, b) => b.pctPresupuesto - a.pctPresupuesto),
    actividad: armarActividad(resumenes),
    evolucion: armarEvolucion(gastos, cobros, compras, hoy),
  };
}
