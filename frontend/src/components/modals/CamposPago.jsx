import { useCondicionesPago } from "../../hooks/queries";
import { MEDIOS_PAGO } from "../../constants/medioPago";
import { formatFecha, formatMoneda } from "../../utils/formato";
import { condicionPorDefecto, previsualizarPlazos } from "../../utils/plazos";
import { ControlOpcion } from "../shared/ControlOpcion";

/** "2 pagos de $ 500.000: 31/03 y 30/04" / "Un pago de $ 90.000 el 01/03". */
function textoPlazos(plazos) {
  if (!plazos.length) return null;
  const fechas = plazos.map((p) => (p.fecha_vencimiento ? formatFecha(p.fecha_vencimiento) : "—"));
  if (plazos.length === 1) return `Un pago de ${formatMoneda(plazos[0].monto)} el ${fechas[0]}.`;
  // El último absorbe el redondeo: si difiere en centavos, igual son "iguales".
  const iguales = plazos.every((p) => Math.abs(p.monto - plazos[0].monto) < 0.02);
  const cuantos = iguales
    ? `${plazos.length} pagos de ${formatMoneda(plazos[0].monto)}`
    : `${plazos.length} pagos`;
  return `${cuantos}: ${fechas.slice(0, -1).join(", ")} y ${fechas.at(-1)}.`;
}

/**
 * Condición de pago (cuándo: Contado, 30/60 días… de Ajustes) y medio de
 * pago (cómo, opcional) de una compra o un gasto. Debajo de la condición se
 * ve cómo quedan los plazos con el total y la fecha de ahora.
 *
 * `bloqueada`: ya hay plazos pagados, así que la condición no se puede
 * cambiar (el backend lo rechaza); se muestra y se explica por qué.
 */
export function CamposPago({
  condicionId,
  onCambiarCondicion,
  medio,
  onCambiarMedio,
  fecha,
  total,
  bloqueada = false,
  disabled = false,
}) {
  const { data: condiciones = [] } = useCondicionesPago();
  const elegida =
    condiciones.find((c) => c.id === condicionId) ??
    (condicionId ? null : condicionPorDefecto(condiciones));
  const opciones = condiciones.map((c) => ({ valor: c.id, label: c.nombre }));
  // Si la del movimiento no está en la lista (todavía no llegó), igual se ve elegida.
  if (condicionId && !opciones.some((o) => o.valor === condicionId)) {
    opciones.push({ valor: condicionId, label: "Condición actual" });
  }

  const pista = bloqueada
    ? "Ya hay plazos pagados: la condición no se puede cambiar. Si cambió el monto, lo que falta se reparte solo."
    : elegida && textoPlazos(previsualizarPlazos(elegida.dias, fecha, total));

  return (
    <>
      <ControlOpcion
        etiqueta="Condición de pago"
        opciones={opciones}
        valor={elegida?.id ?? condicionId}
        onCambiar={onCambiarCondicion}
        disabled={disabled || bloqueada}
        hint={pista}
      />
      <ControlOpcion
        etiqueta="Medio de pago"
        opcional
        opciones={MEDIOS_PAGO}
        valor={medio}
        onCambiar={(valor) => onCambiarMedio(valor === medio ? "" : valor)}
        disabled={disabled}
      />
    </>
  );
}

export default CamposPago;
