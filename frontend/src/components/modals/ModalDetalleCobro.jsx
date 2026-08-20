import { formatMoneda, formatFecha } from "../../utils/formato";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { SeccionNotas } from "../shared/SeccionNotas";
import { DetalleShell, BarraComposicion, SeccionDetalle, ChipsComprobantes } from "./PiezasDetalle";

/**
 * Vista de solo lectura de un Cobro, con el lenguaje visual de la dirección 3a
 * del rediseño (ver claudedesign/). El bruto y las notas de crédito/débito que
 * lo llevan al neto quedan a la vista, no sólo el número final.
 */
export function ModalDetalleCobro({
  cobro,
  usuarioNombre,
  onCerrar,
  onVerComprobante,
  onVerNota,
  onAgregarComprobante,
  onEliminarComprobante,
  onAgregarNota,
  onEliminarNota,
  onEditar,
  canManage = false,
}) {
  const notas = cobro.notas ?? [];
  const notasCredito = totalNotasCredito(notas);
  const notasDebito = totalNotasDebito(notas);
  // monto_neto lo calcula el backend (Cobro.monto_neto); si no vino en la
  // respuesta, se calcula acá con el mismo criterio.
  const montoNeto = cobro.monto_neto ?? Number(cobro.monto) - notasCredito + notasDebito;
  const hayNotas = notasCredito > 0 || notasDebito > 0;

  return (
    <DetalleShell
      tipo={TIPOS_MOVIMIENTO.cobro.singular}
      icono={TIPOS_MOVIMIENTO.cobro.icono}
      contexto={getTipoFacturaLabel(cobro.tipo_factura)}
      fecha={formatFecha(cobro.fecha)}
      titulo={cobro.descripcion}
      subtitulo={usuarioNombre ? `Cargado por ${usuarioNombre}` : null}
      totalLabel="Neto"
      total={montoNeto}
      totalColor={TIPOS_MOVIMIENTO.cobro.color}
      onCerrar={onCerrar}
      onEditar={canManage ? onEditar : undefined}
    >
      <BarraComposicion
        segmentos={[
          { label: "Bruto", monto: cobro.monto, color: TIPOS_MOVIMIENTO.cobro.color },
          {
            label: "Nota de crédito",
            monto: notasCredito,
            color: TIPOS_MOVIMIENTO.nota_credito.color,
            signo: -1,
          },
          {
            label: "Nota de débito",
            monto: notasDebito,
            color: TIPOS_MOVIMIENTO.nota_debito.color,
            signo: 1,
          },
        ]}
      />

      {hayNotas && (
        <SeccionDetalle titulo="Desglose">
          <div className="detalle__desglose">
            <div className="detalle__desglose-fila">
              <span>Bruto</span>
              <span>{formatMoneda(cobro.monto)}</span>
            </div>
            {notasCredito > 0 && (
              <div className="detalle__desglose-fila detalle__desglose-fila--credito">
                <span>Notas de crédito</span>
                <span>-{formatMoneda(notasCredito)}</span>
              </div>
            )}
            {notasDebito > 0 && (
              <div className="detalle__desglose-fila detalle__desglose-fila--debito">
                <span>Notas de débito</span>
                <span>+{formatMoneda(notasDebito)}</span>
              </div>
            )}
            <div className="detalle__desglose-fila detalle__desglose-fila--total">
              <span>Neto</span>
              <span>{formatMoneda(montoNeto)}</span>
            </div>
          </div>
        </SeccionDetalle>
      )}

      <SeccionDetalle titulo="Comprobantes">
        <ChipsComprobantes
          comprobantes={cobro.comprobantes ?? []}
          onVer={onVerComprobante}
          onAgregar={onAgregarComprobante}
          onEliminar={onEliminarComprobante}
        />
      </SeccionDetalle>

      <SeccionNotas
        notas={notas}
        contexto="cobro"
        onVer={onVerNota}
        onAgregar={onAgregarNota}
        onEliminar={onEliminarNota}
        canManage={canManage}
      />
    </DetalleShell>
  );
}

export default ModalDetalleCobro;
