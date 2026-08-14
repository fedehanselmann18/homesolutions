import { calcularAnalisis } from "./analisis";
import {
  esCompraImpaga,
  esCompraSinEntregar,
  diasDesde,
  DIAS_FASE_ESTANCADA,
  calcularSeguimiento,
} from "./seguimiento";
import { notasDeCompras, notasDeCobros } from "./notas";

// Cuántos movimientos y cuántos meses se muestran en los bloques de abajo.
const MOVIMIENTOS_RECIENTES = 8;
const MESES_EVOLUCION = 6;
// "Para resolver hoy" (dirección 1c, injertada en el Panel de 1a): cuántos
// ítems como máximo, de todos los proyectos en curso juntos.
const MAX_PARA_RESOLVER = 6;

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

function armarActividad(resumenes) {
  const movimientos = [];

  resumenes.forEach(({ proyecto, gastosDelProyecto, cobrosDelProyecto, comprasDelProyecto }) => {
    const comun = { proyectoId: proyecto.id, proyectoNombre: proyecto.nombre };
    cobrosDelProyecto.forEach((c) =>
      // monto_neto (no el bruto): ya descuenta/suma las notas de crédito/débito del cobro.
      movimientos.push({
        ...comun,
        id: c.id,
        tipo: "cobro",
        descripcion: c.descripcion,
        monto: c.monto_neto ?? c.monto,
        fecha: c.fecha,
      })
    );
    gastosDelProyecto.forEach((g) =>
      movimientos.push({
        ...comun,
        id: g.id,
        tipo: "gasto",
        descripcion: g.descripcion,
        monto: g.monto,
        fecha: g.fecha,
      })
    );
    comprasDelProyecto.forEach((c) =>
      movimientos.push({
        ...comun,
        id: c.id,
        tipo: "compra",
        descripcion: c.descripcion,
        monto: c.precio_total,
        fecha: c.fecha,
      })
    );
    // Las notas de crédito/débito son movimientos de plata por sí mismas
    // (antes no aparecían acá aunque ya afectaban precio_total/monto_neto) --
    // tipo queda como "nota_credito"/"nota_debito" (ver Dashboard.jsx TIPOS_MOVIMIENTO).
    notasDeCompras(comprasDelProyecto).forEach((n) =>
      movimientos.push({
        ...comun,
        id: n.id,
        tipo: n.tipo,
        descripcion: n.descripcion,
        monto: n.monto,
        fecha: n.fecha,
      })
    );
    notasDeCobros(cobrosDelProyecto).forEach((n) =>
      movimientos.push({
        ...comun,
        id: n.id,
        tipo: n.tipo,
        descripcion: n.descripcion,
        monto: n.monto,
        fecha: n.fecha,
      })
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
    // monto_neto: si no viene (no debería pasar, el backend siempre lo manda),
    // cae al bruto en vez de romper el gráfico.
    if (mes) mes.cobrado += c.monto_neto ?? c.monto;
  });
  gastos.forEach((g) => {
    const mes = porMes.get(claveMes(g.fecha));
    if (mes) mes.gastado += g.monto;
  });
  compras.forEach((c) => {
    const mes = porMes.get(claveMes(c.fecha));
    // precio_total ya incluye impuestos + notas de crédito/débito.
    if (mes) mes.gastado += c.precio_total;
  });

  return meses;
}

// Aplana comprasImpagas/comprasSinEntregar/fasesEstancadas de UN
// calcularSeguimiento (que ya vienen ordenados por antigüedad) a la forma
// común que usa "Para resolver hoy" -- mismos 3 criterios que kpis.requiereAccion,
// pero acá con la descripción de cada ítem en vez de sólo el conteo.
function itemsParaResolver(seguimiento, proyecto) {
  const comun = { proyectoId: proyecto.id, proyectoNombre: proyecto.nombre };
  return [
    ...seguimiento.comprasImpagas.map((c) => ({
      ...comun,
      id: `compra-impaga-${c.id}`,
      tipo: "compra_impaga",
      titulo: c.productos,
      detalle: c.proveedor,
      monto: c.monto,
      dias: c.dias,
    })),
    ...seguimiento.comprasSinEntregar.map((c) => ({
      ...comun,
      id: `compra-sin-entregar-${c.id}`,
      tipo: "compra_sin_entregar",
      titulo: c.productos,
      detalle: c.proveedor,
      monto: c.monto,
      dias: c.dias,
    })),
    ...seguimiento.fasesEstancadas.map((f) => ({
      ...comun,
      id: `fase-estancada-${f.id}`,
      tipo: "fase_estancada",
      titulo: f.nombre,
      detalle: "Sin movimiento",
      monto: null,
      dias: f.dias,
    })),
  ];
}

/**
 * Resumen de TODOS los proyectos para el Panel.
 *
 * Cada proyecto se pasa por `calcularAnalisis` (el mismo cálculo que usa la
 * pestaña Análisis General) para que los números del Panel y los del detalle
 * de un proyecto no puedan divergir nunca. Los pendientes de "Para resolver
 * hoy" pasan por `calcularSeguimiento`, el mismo cálculo que usa la pestaña
 * Seguimiento de cada proyecto, por la misma razón.
 */
export function calcularPanel({
  proyectos = [],
  fases = [],
  gastos = [],
  cobros = [],
  compras = [],
  productos = [],
  proveedores = [],
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

  // monto_neto / precio_total: ambos ya incluyen el efecto de las notas de
  // crédito/débito (ver Cobro.monto_neto y Compra.precio_total en el backend).
  const cobradoMes = sumar(delMes(cobros), (c) => c.monto_neto ?? c.monto);
  const gastosMes = sumar(delMes(gastos), (g) => g.monto);
  const comprasTotalMes = sumar(delMes(compras), (c) => c.precio_total);

  // Lo que falta cobrar de los proyectos vivos: nunca negativo, si un proyecto
  // cobró de más no compensa lo que falta cobrar en otro.
  const pendienteDeCobrar = enCurso.reduce(
    (acc, r) => acc + Math.max(0, r.analisis.totales.precioAcordado - r.analisis.totales.cobrado),
    0
  );

  // Fila de tabla para UN proyecto, sea cual sea su estado -- se usa tanto
  // para "proyectosActivos" (compat, sólo en_curso) como para
  // "proyectosResumen" (los 3 estados, para los filtros En curso/A
  // iniciar/Terminados de la dirección 1a).
  function construirFilaProyecto({ proyecto, analisis, fasesDelProyecto, comprasDelProyecto }) {
    const cerradas = fasesDelProyecto.filter((f) => ESTADOS_FASE_CERRADA.includes(f.estado)).length;
    const impagas = comprasDelProyecto.filter(esCompraImpaga);
    // Mismo criterio que "fasesEstancadas" en calcularSeguimiento: una fase
    // en_curso que hace DIAS_FASE_ESTANCADA días o más que no se toca.
    const estancadas = fasesDelProyecto.filter(
      (f) => f.estado === "en_curso" && diasDesde(f.fecha_actualizacion, hoy) >= DIAS_FASE_ESTANCADA
    ).length;
    return {
      id: proyecto.id,
      estado: proyecto.estado,
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
      fasesEstancadas: estancadas,
      // Estado por fase, en el mismo orden que devuelve la API (igual que
      // Fases.jsx) -- lo usa la barra de segmentos de la tabla de
      // "Proyectos en curso" (dirección 1a) para pintar cada fase.
      fasesResumen: fasesDelProyecto.map((f) => ({ id: f.id, estado: f.estado })),
    };
  }

  // Todos los proyectos, cualquier estado -- alimenta los filtros En
  // curso/A iniciar/Terminados de la tabla del Panel.
  const proyectosResumen = resumenes
    .map(construirFilaProyecto)
    .sort((a, b) => b.pctPresupuesto - a.pctPresupuesto);

  // Compat: sólo en_curso, mismo criterio que siempre tuvo esta clave.
  const proyectosActivos = proyectosResumen.filter((p) => p.estado === "en_curso");

  // "Requiere acción": todo lo que un proyecto en curso tiene pendiente de
  // resolver, sumado en los 3 proyectos -- mismos 3 criterios que
  // calcularSeguimiento.pendientes (comprasImpagas/comprasSinEntregar/
  // fasesEstancadas), sin deduplicar entre sí: una compra que está impaga Y
  // sin entregar son 2 acciones distintas (pagarla, reclamar el envío), no 1.
  // Los 3 subtotales se exponen aparte para el detalle del KPI en Dashboard.jsx.
  const comprasImpagasEnCurso = sumar(proyectosActivos, (p) => p.comprasImpagas);
  const comprasSinEntregarEnCurso = sumar(proyectosActivos, (p) => p.comprasSinEntregar);
  const fasesEstancadasEnCurso = sumar(proyectosActivos, (p) => p.fasesEstancadas);
  const requiereAccion = comprasImpagasEnCurso + comprasSinEntregarEnCurso + fasesEstancadasEnCurso;

  // "Para resolver hoy" (dirección 1c, injertada arriba del Panel de 1a):
  // los MAX_PARA_RESOLVER ítems más urgentes (más días) de todos los
  // proyectos en curso, resueltos con el mismo calcularSeguimiento que usa
  // la pestaña Seguimiento de cada proyecto -- no hay lógica nueva acá,
  // sólo se junta y se ordena entre proyectos.
  const paraResolverHoy = enCurso
    .flatMap(({ proyecto, fasesDelProyecto, gastosDelProyecto, cobrosDelProyecto, comprasDelProyecto }) =>
      itemsParaResolver(
        calcularSeguimiento({
          proyecto,
          fases: fasesDelProyecto,
          gastos: gastosDelProyecto,
          cobros: cobrosDelProyecto,
          compras: comprasDelProyecto,
          productos,
          proveedores,
          hoy,
        }),
        proyecto
      )
    )
    .sort((a, b) => b.dias - a.dias)
    .slice(0, MAX_PARA_RESOLVER);

  return {
    kpis: {
      enCurso: enCurso.length,
      terminados: resumenes.filter((r) => r.proyecto.estado === "terminado").length,
      aIniciar: resumenes.filter((r) => r.proyecto.estado === "a_iniciar").length,
      disponibleTotal: sumar(enCurso, (r) => r.analisis.totales.disponible),
      cobradoMes,
      pendienteDeCobrar,
      gananciaNetaMes: cobradoMes - gastosMes - comprasTotalMes,
      contratadoEnCurso: sumar(enCurso, (r) => r.analisis.totales.precioAcordado),
      // Notas de crédito/débito de los proyectos en curso (todo lo cargado
      // hasta ahora, mismo alcance que disponibleTotal) -- ver "Notas de
      // crédito / débito" en Dashboard.jsx.
      notasCreditoCompras: sumar(enCurso, (r) => r.analisis.totales.notasCreditoCompras),
      notasDebitoCompras: sumar(enCurso, (r) => r.analisis.totales.notasDebitoCompras),
      notasCreditoCobros: sumar(enCurso, (r) => r.analisis.totales.notasCreditoCobros),
      notasDebitoCobros: sumar(enCurso, (r) => r.analisis.totales.notasDebitoCobros),
      requiereAccion,
      comprasImpagasEnCurso,
      comprasSinEntregarEnCurso,
      fasesEstancadasEnCurso,
    },
    proyectosActivos,
    proyectosResumen,
    paraResolverHoy,
    actividad: armarActividad(resumenes),
    evolucion: armarEvolucion(gastos, cobros, compras, hoy),
  };
}
