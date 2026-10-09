import { formatMonedaDual } from "../../utils/formato";
import { leyendaOtraMoneda } from "../../utils/moneda";
import { useEtiquetaTipoFactura } from "../../hooks/useTiposFactura";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { OLIVA, ATENCION } from "../../constants/colores";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { SeccionNotas } from "../shared/SeccionNotas";
import {
  DetalleShell,
  CabeceraMovimiento,
  BandaFaltante,
  SeccionDetalle,
  GrillaDetalles,
  TotalesDetalle,
  ArchivosDetalle,
} from "./PiezasDetalle";

/**
 * Vista de lectura de un Cobro (Movimientos v2). El cobro se carga en
 * dólares: USD principal y los pesos congelados como equivalente. Si tiene
 * notas, el bruto y las notas que lo llevan al neto quedan a la vista, no
 * sólo el número final.
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
  onEliminar,
  canManage = false,
}) {
  const etiquetaFactura = useEtiquetaTipoFactura();
  const notas = cobro.notas ?? [];
  const comprobantes = cobro.comprobantes ?? [];
  // Los netos los calcula el backend (Cobro.monto_neto_usd/_ars); cada nota
  // trae su propia cotización.
  const notasCredito = totalNotasCredito(notas, "usd");
  const notasDebito = totalNotasDebito(notas, "usd");
  const hayNotas = notasCredito > 0 || notasDebito > 0;

  return (
    <DetalleShell
      tipo={TIPOS_MOVIMIENTO.cobro.singular}
      icono={TIPOS_MOVIMIENTO.cobro.icono}
      fecha={cobro.fecha}
      titulo={cobro.descripcion}
      onCerrar={onCerrar}
      onEditar={canManage ? onEditar : undefined}
      onEliminar={canManage ? onEliminar : undefined}
    >
      <CabeceraMovimiento
        titulo={cobro.descripcion}
        monto={cobro.monto_neto_usd}
        moneda="usd"
        secundario={leyendaOtraMoneda(cobro.monto_neto_ars, "ars", cobro)}
        badges={<span className="badge badge--marca">Cobrado</span>}
      />

      {comprobantes.length === 0 && (
        <BandaFaltante texto="Falta adjuntar el recibo" onAgregar={onAgregarComprobante} />
      )}

      <SeccionDetalle titulo="Detalles">
        <GrillaDetalles
          campos={[
            {
              label: "Comprobante",
              valor: etiquetaFactura(cobro.tipo_factura),
              punto: comprobantes.length > 0 ? OLIVA : ATENCION,
            },
            usuarioNombre && { label: "Cargado por", valor: usuarioNombre },
          ]}
        />
      </SeccionDetalle>

      {hayNotas && (
        <SeccionDetalle titulo="Bruto y notas">
          <TotalesDetalle
            filas={[
              { label: "Bruto", valor: formatMonedaDual(cobro.monto_ars, cobro.monto_usd) },
              notasCredito > 0 && {
                label: "Notas de crédito",
                valor: `-${formatMonedaDual(totalNotasCredito(notas, "ars"), notasCredito)}`,
                variante: "resta",
              },
              notasDebito > 0 && {
                label: "Notas de débito",
                valor: `+${formatMonedaDual(totalNotasDebito(notas, "ars"), notasDebito)}`,
                variante: "suma",
              },
              {
                label: "Neto",
                valor: formatMonedaDual(cobro.monto_neto_ars, cobro.monto_neto_usd),
                variante: "total",
              },
            ].filter(Boolean)}
          />
        </SeccionDetalle>
      )}

      <ArchivosDetalle
        comprobantes={comprobantes}
        onVer={onVerComprobante}
        onAgregar={onAgregarComprobante}
        onEliminar={onEliminarComprobante}
      />

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
