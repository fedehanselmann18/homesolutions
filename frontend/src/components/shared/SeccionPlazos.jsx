import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CircleCheck, Undo2 } from "lucide-react";

import useAuth from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { queryKeys } from "../../lib/queryKeys";
import { marcarPlazoPago } from "../../services/plazoPagoService";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { formatFecha, formatMonedaDual, hoyISO, pluralizar } from "../../utils/formato";
import { describirDias, diasEntre } from "../../utils/plazos";
import { useEtiquetaMedioPago } from "../../hooks/useMediosPago";
import { SeccionDetalle } from "../modals/PiezasDetalle";

import "./SeccionPlazos.css";

/**
 * Los plazos de pago de una compra o un gasto en su ficha: cuándo vence cada
 * uno, cuánto es y si se pagó. Un admin marca cada plazo pagado por
 * separado (con la fecha de hoy) o lo desmarca; el estado de la compra se
 * recalcula solo en el backend, y lo que falta se reparte si cambió el total.
 *
 * `movimiento`: la compra o el gasto, con `plazos`, `condicion_pago`,
 * `medio_pago` y `cotizacion_dolar` (el USD de cada plazo usa la congelada).
 */
export function SeccionPlazos({ movimiento }) {
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "admin";
  const toast = useToast();
  const queryClient = useQueryClient();
  const [ocupado, setOcupado] = useState(null);
  const etiquetaMedioPago = useEtiquetaMedioPago();

  const plazos = movimiento.plazos ?? [];
  if (plazos.length === 0) return null;
  const hoy = hoyISO();
  const usd = (ars) => Number(ars) / Number(movimiento.cotizacion_dolar || 1);
  const medio = etiquetaMedioPago(movimiento.medio_pago);
  const condicion = movimiento.condicion_pago;

  const marcar = async (plazo, pagado) => {
    setOcupado(plazo.id);
    try {
      await marcarPlazoPago(plazo.id, { pagado });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.compras.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.gastos.all }),
      ]);
      toast.success(pagado ? "Plazo marcado como pagado." : "Plazo marcado como a pagar.");
    } catch (err) {
      toast.error(obtenerMensajeError(err));
    } finally {
      setOcupado(null);
    }
  };

  const titulo = [
    condicion?.nombre ?? "Pago",
    condicion && plazos.length > 1 && `· ${describirDias(condicion.dias).toLowerCase()}`,
    medio && `· ${medio}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <SeccionDetalle titulo={titulo}>
      <ul className="plazos">
        {plazos.map((plazo) => {
          const vencido = !plazo.pagado && plazo.fecha_vencimiento < hoy;
          const estado = plazo.pagado
            ? `Pagado el ${formatFecha(plazo.fecha_pago)}`
            : vencido
              ? `Vencido hace ${pluralizar(diasEntre(plazo.fecha_vencimiento, hoy), "día")}`
              : "A pagar";
          return (
            <li
              key={plazo.id}
              className={`plazos__fila${plazo.pagado ? " plazos__fila--pagado" : ""}${
                vencido ? " plazos__fila--vencido" : ""
              }`}
            >
              <span className="plazos__cuando">
                <span className="plazos__fecha">
                  {plazos.length > 1 && `${plazo.numero}/${plazos.length} · `}
                  {plazo.dias > 0 ? "Vence" : "Día"} {formatFecha(plazo.fecha_vencimiento)}
                </span>
                <span className="plazos__estado">{estado}</span>
              </span>
              <span className="plazos__monto cifra">
                {formatMonedaDual(plazo.monto, usd(plazo.monto), { principal: "ars" })}
              </span>
              {esAdmin &&
                (plazo.pagado ? (
                  <button
                    type="button"
                    className="btn-icono btn-icono--sm"
                    title="Marcar como a pagar"
                    aria-label={`Marcar el plazo ${plazo.numero} como a pagar`}
                    disabled={ocupado === plazo.id}
                    onClick={() => marcar(plazo, false)}
                  >
                    <Undo2 aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn--sm btn-secondary"
                    aria-label={`Marcar el plazo ${plazo.numero} como pagado`}
                    disabled={ocupado === plazo.id}
                    onClick={() => marcar(plazo, true)}
                  >
                    <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
                    Pagado
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </SeccionDetalle>
  );
}

export default SeccionPlazos;
