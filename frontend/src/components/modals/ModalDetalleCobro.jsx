import { formatMoneda, formatFecha } from "../../utils/formato";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { SeccionComprobantes } from "../shared/SeccionComprobantes";
import { SeccionNotas } from "../shared/SeccionNotas";
import "./ModalCompra.css";
import "../proyectos/cards/CobroCard.css";

/**
 * Vista de solo lectura de un Cobro puntual (desde Seguimiento). Mismo
 * contenido que CobroCard en su estado expandido, sin acciones de edición.
 */
export function ModalDetalleCobro({ cobro, usuarioNombre, onCerrar, onVerComprobante, onVerNota }) {
  const notas = cobro.notas ?? [];
  const notasCredito = totalNotasCredito(notas);
  const notasDebito = totalNotasDebito(notas);
  // monto_neto lo calcula el backend; si no vino en la respuesta, se
  // calcula acá con el mismo criterio que CobroCard.
  const montoNeto = cobro.monto_neto ?? Number(cobro.monto) - notasCredito + notasDebito;

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <div className="cobro-card-header">
          <h2>{cobro.descripcion}</h2>
          <span className="cobro-card-monto">{formatMoneda(montoNeto)}</span>
        </div>

        <div className="cobro-card-contenido">
          <div className="cobro-card-meta">
            <span>{formatFecha(cobro.fecha)}</span>
            <span className="cobro-card-separador">•</span>
            <span>{getTipoFacturaLabel(cobro.tipo_factura)}</span>
          </div>

          {(notasCredito > 0 || notasDebito > 0) && (
            <div className="cobro-card-resumen">
              <div className="cobro-card-resumen-fila">
                <span>Bruto</span>
                <span>{formatMoneda(cobro.monto)}</span>
              </div>
              {notasCredito > 0 && (
                <div className="cobro-card-resumen-fila cobro-card-resumen-fila--nota-credito">
                  <span>Notas de crédito</span>
                  <span>-{formatMoneda(notasCredito)}</span>
                </div>
              )}
              {notasDebito > 0 && (
                <div className="cobro-card-resumen-fila cobro-card-resumen-fila--nota-debito">
                  <span>Notas de débito</span>
                  <span>+{formatMoneda(notasDebito)}</span>
                </div>
              )}
              <div className="cobro-card-resumen-fila cobro-card-resumen-fila--total">
                <span>Neto</span>
                <span>{formatMoneda(montoNeto)}</span>
              </div>
            </div>
          )}

          {usuarioNombre && <p className="cobro-card-detalle-info">Cargado por {usuarioNombre}</p>}

          <SeccionComprobantes
            comprobantes={cobro.comprobantes ?? []}
            onVer={onVerComprobante ? (c) => onVerComprobante(cobro.id, c.id) : undefined}
          />

          <SeccionNotas
            notas={notas}
            contexto="cobro"
            onVer={onVerNota ? (n) => onVerNota(cobro.id, n.id) : undefined}
          />
        </div>

        <div className="modal-acciones">
          <button type="button" onClick={onCerrar} className="modal-btn-cancelar">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default ModalDetalleCobro;
