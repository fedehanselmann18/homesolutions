import { Clock, CircleCheckBig, Truck, PackageCheck } from "lucide-react";

const ESTADO_PAGO = {
  pendiente: { color: "#d97706", label: "Pendiente", icono: Clock },
  pagado: { color: "#16a34a", label: "Pagado", icono: CircleCheckBig },
};

const ESTADO_ENVIO = {
  pedido: { color: "#64748b", label: "Pedido", icono: Truck },
  entregado: { color: "#16a34a", label: "Entregado", icono: PackageCheck },
};

const CONDICION_PAGO = {
  contado: "Contado",
  cuenta_corriente: "Cuenta corriente",
  cheque: "Cheque",
  transferencia: "Transferencia",
};

export function getEstadoPago(estado) {
  return ESTADO_PAGO[estado] ?? { color: "#6b7280", label: estado, icono: null };
}

export function getEstadoEnvio(estado) {
  return ESTADO_ENVIO[estado] ?? { color: "#6b7280", label: estado, icono: null };
}

export function getCondicionPagoLabel(condicion) {
  return CONDICION_PAGO[condicion] ?? condicion;
}
