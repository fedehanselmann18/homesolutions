import { calcularAnalisis } from "./analisis";
import { esCompraImpaga, esCompraSinEntregar, diasDesde, DIAS_FASE_ESTANCADA } from "./seguimiento";
import { describirFaseActual, ESTADOS_FASE_CERRADA } from "./fases";
import { DIAS_DEUDA_VENCIDA } from "../constants/estadoCompra";
import { notasDeCompras, notasDeCobros } from "./notas";
import {
  MONEDA_ANALISIS_DEFAULT,
  montoCobroNeto,
  montoGasto,
  montoNota,
  precioAcordado as precioAcordadoEn,
  precioTotalCompra,
} from "./moneda";

// Cuántos movimientos y cuántos meses se muestran en los bloques de abajo.
const MOVIMIENTOS_RECIENTES = 8;
const MESES_EVOLUCION = 6;

// Cuántos pendientes muestra "Para resolver" antes del "ver todo".
const PENDIENTES_VISIBLES = 6;

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

function armarActividad(resumenes, moneda) {
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
        monto: montoCobroNeto(c, moneda),
        fecha: c.fecha,
      })
    );
    gastosDelProyecto.forEach((g) =>
      movimientos.push({
        ...comun,
        id: g.id,
        tipo: "gasto",
        descripcion: g.descripcion,
        monto: montoGasto(g, moneda),
        fecha: g.fecha,
      })
    );
    comprasDelProyecto.forEach((c) =>
      movimientos.push({
        ...comun,
        id: c.id,
        tipo: "compra",
        descripcion: c.descripcion,
        monto: precioTotalCompra(c, moneda),
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
        monto: montoNota(n, moneda),
        fecha: n.fecha,
      })
    );
    notasDeCobros(cobrosDelProyecto).forEach((n) =>
      movimientos.push({
        ...comun,
        id: n.id,
        tipo: n.tipo,
        descripcion: n.descripcion,
        monto: montoNota(n, moneda),
        fecha: n.fecha,
      })
    );
  });

  return movimientos.sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MOVIMIENTOS_RECIENTES);
}

const sinComprobante = (movimiento) => (movimiento.comprobantes ?? []).length === 0;

/**
 * "Para resolver" del Panel (variante 4i): lo pendiente de los proyectos en
 * curso en una sola lista, ordenada por urgencia -- primero lo que ya es un
 * problema (deuda de DIAS_DEUDA_VENCIDA días o más), después lo que pide
 * atención, y dentro de cada nivel lo más viejo arriba. Mismos criterios que
 * la pestaña Seguimiento de cada proyecto, que es adonde lleva cada ítem.
 *
 * Cada ítem: { key, tipo, titulo, proyectoId, proyectoNombre, proveedor,
 * dias, nivel, monto, moneda } con tipo "pago" | "envio" | "comprobante" |
 * "fase" y nivel "problema" | "atencion". Los montos van en la moneda en que
 * se cargó el movimiento: pesos las compras y gastos, dólares los cobros.
 */
function armarParaResolver(enCurso, nombreProveedor, hoy) {
  const items = [];
  enCurso.forEach(
    ({ proyecto, comprasDelProyecto, gastosDelProyecto, cobrosDelProyecto, fasesDelProyecto }) => {
      const comun = { proyectoId: proyecto.id, proyectoNombre: proyecto.nombre };
      comprasDelProyecto.forEach((c) => {
        const base = {
          ...comun,
          titulo: c.descripcion,
          proveedor: nombreProveedor(c.proveedor_id),
          dias: diasDesde(c.fecha, hoy),
          monto: precioTotalCompra(c, "ars"),
          moneda: "ars",
        };
        if (esCompraImpaga(c)) {
          items.push({
            ...base,
            key: `pago-${c.id}`,
            tipo: "pago",
            nivel: base.dias >= DIAS_DEUDA_VENCIDA ? "problema" : "atencion",
          });
        }
        if (esCompraSinEntregar(c)) {
          items.push({ ...base, key: `envio-${c.id}`, tipo: "envio", nivel: "atencion" });
        }
        if (sinComprobante(c)) {
          items.push({ ...base, key: `comp-c-${c.id}`, tipo: "comprobante", nivel: "atencion" });
        }
      });
      gastosDelProyecto.filter(sinComprobante).forEach((g) =>
        items.push({
          ...comun,
          key: `comp-g-${g.id}`,
          tipo: "comprobante",
          nivel: "atencion",
          titulo: g.descripcion,
          dias: diasDesde(g.fecha, hoy),
          monto: montoGasto(g, "ars"),
          moneda: "ars",
        })
      );
      cobrosDelProyecto.filter(sinComprobante).forEach((c) =>
        items.push({
          ...comun,
          key: `comp-k-${c.id}`,
          tipo: "comprobante",
          nivel: "atencion",
          titulo: c.descripcion,
          dias: diasDesde(c.fecha, hoy),
          monto: montoCobroNeto(c, "usd"),
          moneda: "usd",
        })
      );
      fasesDelProyecto
        .filter((f) => f.estado === "en_curso" && f.fecha_en_curso_desde)
        .map((f) => ({ fase: f, dias: diasDesde(f.fecha_en_curso_desde, hoy) }))
        .filter(({ dias }) => dias >= DIAS_FASE_ESTANCADA)
        .forEach(({ fase, dias }) =>
          items.push({
            ...comun,
            key: `fase-${fase.id}`,
            tipo: "fase",
            nivel: "atencion",
            titulo: fase.nombre,
            dias,
            monto: null,
          })
        );
    }
  );

  const peso = { problema: 1, atencion: 0 };
  return items.sort((a, b) => peso[b.nivel] - peso[a.nivel] || b.dias - a.dias);
}

function armarEvolucion(gastos, cobros, compras, hoy, moneda) {
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
    // Neto de notas (lo calcula el backend), en la moneda del panel.
    if (mes) mes.cobrado += montoCobroNeto(c, moneda);
  });
  gastos.forEach((g) => {
    const mes = porMes.get(claveMes(g.fecha));
    if (mes) mes.gastado += montoGasto(g, moneda);
  });
  compras.forEach((c) => {
    const mes = porMes.get(claveMes(c.fecha));
    // precio_total_* ya incluye impuestos + notas de crédito/débito.
    if (mes) mes.gastado += precioTotalCompra(c, moneda);
  });

  return meses;
}

/**
 * Resumen de TODOS los proyectos para el Panel.
 *
 * Cada proyecto se pasa por `calcularAnalisis` (el mismo cálculo que usa la
 * pestaña Análisis General) para que los números del Panel y los del detalle
 * de un proyecto no puedan divergir nunca.
 *
 * `moneda` y `cotizacionActual`: mismos que en calcularAnalisis (ver
 * docs/PLAN_TIPO_CAMBIO.md). Cada fila de proyecto lleva su moneda para que
 * la tabla la formatee sin otra prop.
 */
export function calcularPanel({
  proyectos = [],
  fases = [],
  gastos = [],
  cobros = [],
  compras = [],
  hoy = new Date(),
  moneda = MONEDA_ANALISIS_DEFAULT,
  cotizacionActual = null,
  // Opcional: sólo para nombrar al proveedor en "Para resolver".
  proveedores = [],
}) {
  const nombresProveedor = new Map(proveedores.map((p) => [p.id, p.nombre]));
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
        moneda,
        cotizacionActual,
      }),
    };
  });

  const enCurso = resumenes.filter((r) => r.proyecto.estado === "en_curso");
  const mesActual = claveMesDeDate(hoy);
  const delMes = (items) => items.filter((i) => claveMes(i.fecha) === mesActual);

  // monto_neto_* / precio_total_*: ambos ya incluyen el efecto de las notas
  // de crédito/débito (ver Cobro y Compra en el backend).
  const cobradoMes = sumar(delMes(cobros), (c) => montoCobroNeto(c, moneda));
  const gastosMes = sumar(delMes(gastos), (g) => montoGasto(g, moneda));
  const comprasTotalMes = sumar(delMes(compras), (c) => precioTotalCompra(c, moneda));

  // Lo que falta cobrar de los proyectos vivos: nunca negativo, si un proyecto
  // cobró de más no compensa lo que falta cobrar en otro. Se cuenta en
  // DÓLARES (el contrato es en USD y lo cobrado también): restarle pesos
  // nominales de hace meses a un precio en pesos de hoy daría cualquier cosa.
  // En pesos se muestra ese mismo saldo con la cotización actual, o null si
  // no hay ninguna cargada.
  const pendienteUsd = enCurso.reduce(
    (acc, r) =>
      acc +
      Math.max(
        0,
        precioAcordadoEn(r.proyecto, "usd") -
          sumar(r.cobrosDelProyecto, (c) => montoCobroNeto(c, "usd"))
      ),
    0
  );
  const pendienteDeCobrar =
    moneda === "usd"
      ? pendienteUsd
      : cotizacionActual
        ? pendienteUsd * Number(cotizacionActual.valor)
        : null;
  const contratadoEnCurso = enCurso.some((r) => r.analisis.totales.precioAcordado == null)
    ? null
    : sumar(enCurso, (r) => r.analisis.totales.precioAcordado);

  // Fila de tabla para UN proyecto, sea cual sea su estado -- se usa tanto
  // para "proyectosActivos" (compat, sólo en_curso) como para
  // "proyectosResumen" (los 3 estados, para los filtros En curso/A
  // iniciar/Terminados de la dirección 1a).
  function construirFilaProyecto({ proyecto, analisis, fasesDelProyecto, comprasDelProyecto }) {
    const cerradas = fasesDelProyecto.filter((f) => ESTADOS_FASE_CERRADA.includes(f.estado)).length;
    const impagas = comprasDelProyecto.filter(esCompraImpaga);
    // Mismo criterio que "fasesEstancadas" en calcularSeguimiento: una fase
    // en_curso que hace DIAS_FASE_ESTANCADA días o más que entró en curso.
    // fecha_en_curso_desde (no fecha_actualizacion): ver comentario en el
    // modelo Fase (backend) -- ese campo se pisa con cualquier edición.
    const estancadas = fasesDelProyecto.filter(
      (f) =>
        f.estado === "en_curso" &&
        f.fecha_en_curso_desde &&
        diasDesde(f.fecha_en_curso_desde, hoy) >= DIAS_FASE_ESTANCADA
    ).length;
    return {
      id: proyecto.id,
      moneda,
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
      faseActual: describirFaseActual(fasesDelProyecto),
      pctFases: fasesDelProyecto.length ? (cerradas / fasesDelProyecto.length) * 100 : 0,
      // Pendientes de compra del proyecto: mismo criterio que la pestaña
      // Seguimiento, que es donde se ve el detalle de cada una.
      comprasImpagas: impagas.length,
      // Impagas hace DIAS_DEUDA_VENCIDA días o más: lo que pasa el contador
      // de alertas de la card de proyecto de "atención" a "problema".
      comprasVencidas: impagas.filter((c) => diasDesde(c.fecha, hoy) >= DIAS_DEUDA_VENCIDA).length,
      montoImpago: sumar(impagas, (c) => precioTotalCompra(c, moneda)),
      comprasSinEntregar: comprasDelProyecto.filter(esCompraSinEntregar).length,
      fasesEstancadas: estancadas,
      // Estado por fase, en el orden de la obra -- lo usa la barra de
      // segmentos de la card de proyecto (variante 4L) para pintar cada fase.
      fasesResumen: [...fasesDelProyecto]
        .sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))
        .map((f) => ({ id: f.id, estado: f.estado })),
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

  // Deuda con proveedores: TODAS las compras impagas, del proyecto que sean
  // (una deuda no deja de serlo porque la obra terminó). En pesos, que es la
  // moneda en que se le paga a un proveedor.
  const impagas = compras.filter(esCompraImpaga);
  const deudaProveedores = {
    monto: sumar(impagas, (c) => precioTotalCompra(c, "ars")),
    compras: impagas.length,
    vencidas: impagas.filter((c) => diasDesde(c.fecha, hoy) >= DIAS_DEUDA_VENCIDA).length,
  };

  const paraResolver = armarParaResolver(enCurso, (id) => nombresProveedor.get(id) ?? null, hoy);

  return {
    kpis: {
      enCurso: enCurso.length,
      terminados: resumenes.filter((r) => r.proyecto.estado === "terminado").length,
      aIniciar: resumenes.filter((r) => r.proyecto.estado === "a_iniciar").length,
      disponibleTotal: sumar(enCurso, (r) => r.analisis.totales.disponible),
      cobradoMes,
      pendienteDeCobrar,
      gananciaNetaMes: cobradoMes - gastosMes - comprasTotalMes,
      contratadoEnCurso,
      requiereAccion,
      comprasImpagasEnCurso,
      comprasSinEntregarEnCurso,
      fasesEstancadasEnCurso,
      deudaProveedores,
    },
    paraResolver: paraResolver.slice(0, PENDIENTES_VISIBLES),
    totalParaResolver: paraResolver.length,
    proyectosActivos,
    proyectosResumen,
    moneda,
    actividad: armarActividad(resumenes, moneda),
    evolucion: armarEvolucion(gastos, cobros, compras, hoy, moneda),
  };
}
