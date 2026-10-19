// Los medios de pago ya no son una lista fija: se administran en Ajustes y
// vienen de la API (useMediosPago). Los movimientos guardan el `codigo`
// (efectivo, cheque...) y acá se traduce al `nombre` que se muestra. Va aparte
// de la condición de pago (cuándo: Contado, 30/60 días...). Opcional, uno por
// movimiento. Las versiones con hook están en hooks/useMediosPago.js.
import { Banknote, CreditCard, FileText, Landmark, Wallet } from "lucide-react";

// Ícono por código para los 4 de fábrica; los que cree Agus usan el genérico.
const ICONOS_POR_CODIGO = {
  efectivo: Banknote,
  transferencia: Landmark,
  cheque: FileText,
  tarjeta: CreditCard,
};
const ICONO_GENERICO = Wallet;

/** Nombre del medio; si no está en la lista (todavía no llegó, o es un código
 * viejo), el código crudo para que al menos se vea algo. `null` sin medio. */
export function getMedioPagoLabel(codigo, medios = []) {
  if (!codigo) return null;
  return medios.find((m) => m.codigo === codigo)?.nombre ?? codigo;
}

/** Opciones para ControlOpcion: sólo los activos. Si el valor actual no está
 * (editando un movimiento viejo con un medio desactivado, o antes de que
 * llegue la query), se agrega para que se vea elegido. */
export function opcionesMedioPago(medios = [], valorActual = "") {
  const opciones = medios
    .filter((m) => m.activo || m.codigo === valorActual)
    .map((m) => ({
      valor: m.codigo,
      label: m.nombre,
      icono: ICONOS_POR_CODIGO[m.codigo] ?? ICONO_GENERICO,
    }));
  if (valorActual && !opciones.some((o) => o.valor === valorActual)) {
    opciones.push({ valor: valorActual, label: valorActual, icono: ICONO_GENERICO });
  }
  return opciones;
}
