// Cómo se paga una compra o un gasto (lista fija, decisión de Fede
// 09/10/2026). Va aparte de la condición de pago (cuándo: Contado, 30/60
// días...), que se arma en Ajustes. Opcional, uno por movimiento.
import { Banknote, CreditCard, FileText, Landmark } from "lucide-react";

export const MEDIOS_PAGO = [
  { valor: "efectivo", label: "Efectivo", icono: Banknote },
  { valor: "transferencia", label: "Transferencia", icono: Landmark },
  { valor: "cheque", label: "Cheque", icono: FileText },
  { valor: "tarjeta", label: "Tarjeta", icono: CreditCard },
];

export function getMedioPagoLabel(valor) {
  if (!valor) return null;
  return MEDIOS_PAGO.find((m) => m.valor === valor)?.label ?? valor;
}
