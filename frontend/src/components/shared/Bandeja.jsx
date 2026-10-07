import { Clock, HandCoins, Layers, Paperclip } from "lucide-react";

import { BadgeEstado } from "./BadgeEstado";
import { EstadoVacio } from "./EstadoVacio";
import { formatMontoDeItem } from "../../utils/moneda";
import {
  DIAS_DEUDA_VENCIDA,
  getEstadoEnvio,
  getEstadoPago,
  getEstadoPagoConAntiguedad,
} from "../../constants/estadoCompra";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import {
  ATENCION,
  ATENCION_TINT,
  ATENCION_TEXTO,
  TINTA_MUTED,
  RELLENO,
} from "../../constants/colores";
import "./Bandeja.css";

// El badge de cada item, con la forma de estadoCompra.js para que lo pinte
// BadgeEstado: el de pago y el de envío son los mismos del libro de obra; los
// otros tres son propios de esta lista.
const PAR_ATENCION = { color: ATENCION, bg: ATENCION_TINT, fg: ATENCION_TEXTO };
function estadoDeItem(item) {
  switch (item.estado) {
    case "impaga":
      // Desde DIAS_DEUDA_VENCIDA el par rojo de estadoCompra; antes, el
      // ámbar de "a pagar" pero con los días, que es lo que ordena la lista.
      return item.dias >= DIAS_DEUDA_VENCIDA
        ? getEstadoPagoConAntiguedad("pendiente", item.dias)
        : {
            ...getEstadoPago("pendiente"),
            label: item.dias > 1 ? `${item.dias} días sin pagar` : "A pagar",
          };
    case "sinEntregar":
      return getEstadoEnvio("pedido");
    case "sinComprobante":
      return { ...PAR_ATENCION, label: "Sin comprobante", icono: Paperclip };
    case "estancada":
      return { ...PAR_ATENCION, label: `${item.dias} días sin cambios`, icono: Clock };
    default:
      return {
        color: TINTA_MUTED,
        bg: RELLENO,
        fg: TINTA_MUTED,
        label: "Por cobrar",
        icono: HandCoins,
      };
  }
}

const ICONO_TIPO = {
  compra: TIPOS_MOVIMIENTO.compra.icono,
  gasto: TIPOS_MOVIMIENTO.gasto.icono,
  cobro: TIPOS_MOVIMIENTO.cobro.icono,
  cobranza: TIPOS_MOVIMIENTO.cobro.icono,
  fase: Layers,
};

const TEXTO_ACCION = {
  pagar: "Registrar pago",
  entregar: "Marcar entregado",
  adjuntar: "Adjuntar",
  cobrar: "Registrar cobro",
  verFase: "Ver fase",
};

/**
 * La lista por urgencia de la variante 4f (Vencido / Pendiente / Para
 * revisar), cada item con la acción que lo resuelve ahí mismo. Los grupos
 * los arma `armarBandeja` (utils/seguimiento.js); la comparten el
 * Seguimiento del proyecto y el de una fase.
 *
 * `onAbrir(item)` abre el detalle del movimiento; un item sin detalle (el
 * saldo del contrato) no lo recibe. `onEjecutar(item)` corre su acción;
 * `ocupado` es la key del item que la está corriendo.
 */
export function Bandeja({ grupos, canManage, ocupado, onAbrir, onEjecutar, mensajeVacio }) {
  if (grupos.length === 0) return <EstadoVacio mensaje={mensajeVacio} />;

  return (
    <div className="bandeja">
      {grupos.map((grupo) => (
        <section key={grupo.clave} className="bandeja__grupo" aria-label={grupo.label}>
          <h3 className={`bandeja__titulo bandeja__titulo--${grupo.clave}`}>
            <span className="bandeja__punto" aria-hidden="true" />
            {grupo.label}
            <span className="bandeja__cantidad">{grupo.items.length}</span>
          </h3>
          <ul className="bandeja__lista">
            {grupo.items.map((item) => {
              const Icono = ICONO_TIPO[item.tipo];
              const abre = item.tipo !== "cobranza";
              return (
                <li
                  key={item.key}
                  className={`bandeja__item${abre ? " bandeja__item--abre" : ""}`}
                  onClick={abre ? () => onAbrir(item) : undefined}
                >
                  <span className="bandeja__icono" aria-hidden="true">
                    <Icono size={15} strokeWidth={1.75} />
                  </span>
                  <span className="bandeja__texto">
                    {abre ? (
                      <button
                        type="button"
                        className="bandeja__titulo-item"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAbrir(item);
                        }}
                      >
                        {item.titulo}
                      </button>
                    ) : (
                      <span className="bandeja__titulo-item">{item.titulo}</span>
                    )}
                    <span className="bandeja__subtitulo">{item.subtitulo}</span>
                  </span>
                  <span className="bandeja__estado">
                    <BadgeEstado estado={estadoDeItem(item)} chico />
                  </span>
                  <span className="bandeja__monto">
                    {item.monto ? formatMontoDeItem(item.monto) : ""}
                  </span>
                  <span className="bandeja__accion">
                    {canManage && (
                      <button
                        type="button"
                        className="btn btn--sm btn-secondary"
                        disabled={ocupado === item.key}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEjecutar(item);
                        }}
                      >
                        {TEXTO_ACCION[item.accion]}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default Bandeja;
