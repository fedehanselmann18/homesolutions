// Cash flow: la plata que entró y salió de verdad, y lo que vence.
//
// Reglas (decididas con Fede, 09/10/2026):
// - Entró: cobros (y sus notas) en su fecha. Un cobro no tiene plazos.
// - Salió: SÓLO plazos pagados, en su fecha de pago. Un plazo sin pagar
//   nunca cuenta como salida, aunque la compra esté cargada.
// - A pagar: plazos pendientes por su vencimiento. Los que vencieron antes
//   de hoy son "vencido" (en la vista por mes, caen en el mes actual: se
//   asume que se pagan ya).
// - Falta cobrar: precio acordado − cobrado, en dólares (es lo del contrato)
//   y sin fecha (los cobros no tienen plazos).
// - Pesos o dólares: cada plazo se pasa a dólares con la cotización
//   congelada de su compra o gasto (no tiene USD propio); cobros y notas
//   traen las dos cifras.
//
// Puro: recibe los datos que ya baja la app y `hoy` ("YYYY-MM-DD").
import { saldoPorCobrar, montoCobroNeto } from "./moneda";
import { diasEntre, plazosDe, sumarDias, etiquetaPlazo } from "./plazos";

const num = (v) => Number(v) || 0;

/** Un monto en pesos de un plazo, en la moneda pedida. */
const enMoneda = (montoArs, movimiento, moneda) =>
  moneda === "ars" ? num(montoArs) : num(montoArs) / num(movimiento.cotizacion_dolar || 1);

const totalArsCompra = (compra) => num(compra.precio_total_ars);
const totalArsGasto = (gasto) => num(gasto.monto_ars);

const mesDe = (iso) => iso.slice(0, 7); // "2026-03"

function sumarMeses(mes, cantidad) {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + cantidad;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Lunes de la semana de `iso`. */
function lunesDe(iso) {
  const [a, m, d] = iso.split("-").map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay(); // 0 = domingo
  return sumarDias(iso, -((diaSemana + 6) % 7));
}

/** Todo lo que movió plata de verdad: [{ fecha, monto (con signo) }]. */
function movimientosReales({ compras, gastos, cobros, moneda }) {
  const reales = [];
  const pagos = (movimiento, total) =>
    plazosDe(movimiento, total)
      .filter((p) => p.pagado && p.fecha_pago)
      .forEach((p) =>
        reales.push({ fecha: p.fecha_pago, monto: -enMoneda(p.monto, movimiento, moneda) })
      );
  compras.forEach((c) => pagos(c, totalArsCompra(c)));
  gastos.forEach((g) => pagos(g, totalArsGasto(g)));
  cobros.forEach((cobro) => {
    reales.push({ fecha: cobro.fecha, monto: num(cobro[`monto_${moneda}`]) });
    (cobro.notas ?? []).forEach((nota) => {
      const signo = nota.tipo === "nota_debito" ? 1 : -1;
      reales.push({ fecha: nota.fecha, monto: signo * num(nota[`monto_${moneda}`]) });
    });
  });
  return reales;
}

/** Plazos sin pagar, con lo necesario para listarlos. */
function plazosPendientes({ compras, gastos, moneda, hoy, nombreProveedor, nombreProyecto }) {
  const pendientes = [];
  const agregar = (movimiento, tipo, total, quien, proyecto) => {
    const plazos = plazosDe(movimiento, total);
    plazos
      .filter((p) => !p.pagado)
      .forEach((p) =>
        pendientes.push({
          id: p.id ?? `${tipo}-${movimiento.id}`,
          tipo,
          movimientoId: movimiento.id,
          fecha: p.fecha_vencimiento,
          monto: enMoneda(p.monto, movimiento, moneda),
          vencido: p.fecha_vencimiento < hoy,
          diasVencido: p.fecha_vencimiento < hoy ? diasEntre(p.fecha_vencimiento, hoy) : 0,
          quien,
          descripcion: movimiento.descripcion,
          proyecto,
          condicion: movimiento.condicion_pago?.nombre ?? null,
          etiqueta: etiquetaPlazo(p, plazos.length),
        })
      );
  };
  compras.forEach((c) =>
    agregar(c, "compra", totalArsCompra(c), nombreProveedor(c.proveedor_id), nombreProyecto(c))
  );
  gastos.forEach((g) => agregar(g, "gasto", totalArsGasto(g), null, nombreProyecto(g)));
  return pendientes.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/** Lo que falta cobrar de cada obra (USD, contra el precio acordado). */
function faltaCobrarUsd(proyectos, cobros) {
  return proyectos.reduce((acc, proyecto) => {
    const cobrado = cobros
      .filter((c) => c.proyecto_id === proyecto.id)
      .reduce((s, c) => s + montoCobroNeto(c, "usd"), 0);
    return acc + saldoPorCobrar(proyecto.precio_acordado_usd, cobrado);
  }, 0);
}

/**
 * Mes a mes: lo que entró, salió y vence, con el saldo acumulado. Los meses
 * pasados son reales; los que vienen, proyectados (sólo vencimientos).
 */
function porMes({ reales, pendientes, hoy, mesesAtras }) {
  const actual = mesDe(hoy);
  const desde = sumarMeses(actual, -(mesesAtras - 1));
  const ultimoVencimiento = pendientes.length ? mesDe(pendientes.at(-1).fecha) : actual;
  const hasta = [ultimoVencimiento, actual].sort().at(-1);
  const tope = sumarMeses(actual, 12);
  const fin = hasta > tope ? tope : hasta;

  let saldo = reales.filter((r) => mesDe(r.fecha) < desde).reduce((s, r) => s + r.monto, 0);
  const meses = [];
  for (let mes = desde; mes <= fin; mes = sumarMeses(mes, 1)) {
    const delMes = reales.filter((r) => mesDe(r.fecha) === mes);
    const entro = delMes.filter((r) => r.monto > 0).reduce((s, r) => s + r.monto, 0);
    const salio = delMes.filter((r) => r.monto < 0).reduce((s, r) => s - r.monto, 0);
    // Lo vencido se asume que se paga ahora: va al mes actual.
    const aPagar = pendientes
      .filter((p) => (p.vencido ? actual : mesDe(p.fecha)) === mes)
      .reduce((s, p) => s + p.monto, 0);
    saldo += entro - salio - aPagar;
    meses.push({
      mes,
      entro,
      salio,
      aPagar,
      saldo,
      actual: mes === actual,
      proyectado: mes > actual,
    });
  }
  return meses;
}

/** Las próximas `semanas` semanas (de lunes a domingo) con lo que vence. */
function porSemana({ pendientes, hoy, semanas }) {
  const primerLunes = lunesDe(hoy);
  return Array.from({ length: semanas }, (_, i) => {
    const desde = sumarDias(primerLunes, i * 7);
    const hasta = sumarDias(desde, 6);
    const venceEnLaSemana = pendientes.filter(
      (p) => !p.vencido && p.fecha >= desde && p.fecha <= hasta
    );
    return {
      desde,
      hasta,
      aPagar: venceEnLaSemana.reduce((s, p) => s + p.monto, 0),
      cantidad: venceEnLaSemana.length,
    };
  });
}

export function calcularCashFlow({
  compras = [],
  gastos = [],
  cobros = [],
  proyectos = [],
  proveedores = [],
  fases = [],
  moneda = "ars",
  hoy,
  mesesAtras = 6,
  semanas = 8,
}) {
  const proveedorPorId = new Map(proveedores.map((p) => [p.id, p.nombre]));
  const proyectoPorId = new Map(proyectos.map((p) => [p.id, p.nombre]));
  const proyectoDeFase = new Map(fases.map((f) => [f.id, f.proyecto_id]));
  const nombreProveedor = (id) => proveedorPorId.get(id) ?? null;
  const nombreProyecto = (mov) =>
    proyectoPorId.get(mov.proyecto_id ?? proyectoDeFase.get(mov.fase_id)) ?? null;

  const reales = movimientosReales({ compras, gastos, cobros, moneda });
  const pendientes = plazosPendientes({
    compras,
    gastos,
    moneda,
    hoy,
    nombreProveedor,
    nombreProyecto,
  });
  const en30 = sumarDias(hoy, 30);

  return {
    kpis: {
      saldoHoy: reales.filter((r) => r.fecha <= hoy).reduce((s, r) => s + r.monto, 0),
      vencido: pendientes.filter((p) => p.vencido).reduce((s, p) => s + p.monto, 0),
      cantidadVencidos: pendientes.filter((p) => p.vencido).length,
      aPagar30: pendientes
        .filter((p) => !p.vencido && p.fecha <= en30)
        .reduce((s, p) => s + p.monto, 0),
      faltaCobrarUsd: faltaCobrarUsd(proyectos, cobros),
    },
    porMes: porMes({ reales, pendientes, hoy, mesesAtras }),
    porSemana: porSemana({ pendientes, hoy, semanas }),
    vencimientos: pendientes,
  };
}
