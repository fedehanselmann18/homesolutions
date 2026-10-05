import { formatFecha, formatMonedaDual } from "../../utils/formato";
import { leyendaOtraMoneda } from "../../utils/moneda";
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
  // El cobro se carga en dólares: USD principal, y los pesos congelados (cada
  // nota con su propia cotización) entre paréntesis. Los netos los calcula
  // el backend (Cobro.monto_neto_usd/_ars).
  const notasCredito = totalNotasCredito(notas, "usd");
  const notasDebito = totalNotasDebito(notas, "usd");
  const notasCreditoArs = totalNotasCredito(notas, "ars");
  const notasDebitoArs = totalNotasDebito(notas, "ars");
  const montoNeto = cobro.monto_neto_usd;
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
      totalMoneda="usd"
      totalSecundario={leyendaOtraMoneda(cobro.monto_neto_ars, "ars", cobro)}
      totalColor={TIPOS_MOVIMIENTO.cobro.color}
      onCerrar={onCerrar}
      onEditar={canManage ? onEditar : undefined}
    >
      <BarraComposicion
        moneda="usd"
        segmentos={[
          { label: "Bruto", monto: cobro.monto_usd, color: TIPOS_MOVIMIENTO.cobro.color },
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
              <span>{formatMonedaDual(cobro.monto_ars, cobro.monto_usd)}</span>
            </div>
            {notasCredito > 0 && (
              <div className="detalle__desglose-fila detalle__desglose-fila--credito">
                <span>Notas de crédito</span>
                <span>-{formatMonedaDual(notasCreditoArs, notasCredito)}</span>
              </div>
            )}
            {notasDebito > 0 && (
              <div className="detalle__desglose-fila detalle__desglose-fila--debito">
                <span>Notas de débito</span>
                <span>+{formatMonedaDual(notasDebitoArs, notasDebito)}</span>
              </div>
            )}
            <div className="detalle__desglose-fila detalle__desglose-fila--total">
              <span>Neto</span>
              <span>{formatMonedaDual(cobro.monto_neto_ars, montoNeto)}</span>
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
