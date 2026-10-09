// Impuestos de una compra o nota de devolución (ver models.Impuesto).
//
// Un impuesto con `alicuota` (IVA 21, IVA 10,5) se calcula solo sobre la
// base (el neto): la fila queda "automática" y sigue al neto si cambia. Si
// Agus tipea otro monto (para igualar el redondeo de la factura), la fila
// deja de ser automática y queda fija. Sin alícuota (percepciones), el monto
// se tipea como siempre.
//
// Las filas del form son { _id, impuesto_id, monto, auto }. El monto que
// vale es el de `montoFila`: el calculado si es automática, el tipeado si no.

let contadorFila = 0;
export const nuevaFilaImpuesto = (datos = {}) => ({
  _id: `imp-${++contadorFila}`,
  impuesto_id: "",
  monto: "",
  auto: false,
  ...datos,
});

/** base × alícuota / 100, redondeado a centavos (mitad para arriba, como el backend). */
export function calcularImpuesto(base, alicuota) {
  const valor = ((Number(base) || 0) * Number(alicuota)) / 100;
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}

const buscar = (disponibles, impuestoId) => disponibles.find((i) => i.id === impuestoId);

/** La alícuota del impuesto de la fila, o null si se carga a mano. */
export function alicuotaDeFila(fila, disponibles) {
  const alicuota = buscar(disponibles, fila.impuesto_id)?.alicuota;
  return alicuota ? Number(alicuota) : null;
}

/** El monto que vale para totales y para guardar. */
export function montoFila(fila, base, disponibles) {
  const alicuota = alicuotaDeFila(fila, disponibles);
  if (fila.auto && alicuota) return calcularImpuesto(base, alicuota);
  return Number(fila.monto) || 0;
}

export function totalImpuestos(filas, base, disponibles) {
  return filas.reduce((acc, fila) => acc + montoFila(fila, base, disponibles), 0);
}

/** Elegir un impuesto en una fila: si tiene alícuota, pasa a automática. */
export function elegirImpuesto(fila, impuestoId, disponibles) {
  const conAlicuota = Boolean(buscar(disponibles, impuestoId)?.alicuota);
  return {
    ...fila,
    impuesto_id: impuestoId,
    auto: conAlicuota,
    monto: conAlicuota ? "" : fila.monto,
  };
}

/** Tipear el monto a mano: la fila queda fija. */
export function tipearMonto(fila, monto) {
  return { ...fila, monto, auto: false };
}

/** Volver al calculado (después de haberlo sobrescrito). */
export function volverAlCalculado(fila) {
  return { ...fila, monto: "", auto: true };
}

/**
 * Filas al abrir una compra o nota ya cargada. Una fila es automática sólo
 * si su monto guardado coincide con el cálculo: así un monto viejo o
 * sobrescrito no se pisa solo al cambiar el neto.
 */
export function filasDesdeAplicados(aplicados = [], base, disponibles) {
  return aplicados.map((aplicado) => {
    const alicuota = buscar(disponibles, aplicado.impuesto_id)?.alicuota;
    const coincide =
      alicuota && Math.abs(calcularImpuesto(base, alicuota) - Number(aplicado.monto)) < 0.005;
    return nuevaFilaImpuesto({
      impuesto_id: aplicado.impuesto_id,
      monto: aplicado.monto,
      auto: Boolean(coincide),
    });
  });
}

/** Lo que se manda al backend: [{ impuesto_id, monto }]. */
export function impuestosParaGuardar(filas, base, disponibles) {
  return filas
    .filter((f) => f.impuesto_id)
    .map((f) => ({ impuesto_id: f.impuesto_id, monto: montoFila(f, base, disponibles) }));
}

/**
 * Una alícuota de IVA por factura: devuelve el grupo repetido ("IVA") si dos
 * filas son del mismo grupo, o null. Los impuestos sin grupo no cuentan.
 */
export function grupoRepetido(filas, disponibles) {
  const vistos = new Set();
  for (const fila of filas) {
    const grupo = buscar(disponibles, fila.impuesto_id)?.grupo;
    if (!grupo) continue;
    const clave = grupo.toLocaleLowerCase("es");
    if (vistos.has(clave)) return grupo;
    vistos.add(clave);
  }
  return null;
}

/** "IVA 21 · 21 %" para el select; sin alícuota, el nombre solo. */
export function etiquetaImpuesto(impuesto) {
  if (!impuesto?.alicuota) return impuesto?.nombre ?? "";
  return `${impuesto.nombre} · ${formatoAlicuota(impuesto.alicuota)}`;
}

/** 10.5 -> "10,5 %", 21 -> "21 %". */
export function formatoAlicuota(alicuota) {
  return `${Number(alicuota).toLocaleString("es-AR", { maximumFractionDigits: 2 })} %`;
}
