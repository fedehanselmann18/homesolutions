import { leyendaOtraMoneda } from "../../utils/moneda";
import { useEtiquetaTipoFactura } from "../../hooks/useTiposFactura";
import { OLIVA, ATENCION } from "../../constants/colores";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { getEstadoPagoConVencimiento } from "../../constants/estadoCompra";
import { useEtiquetaMedioPago } from "../../hooks/useMediosPago";
import { diasVencida } from "../../utils/plazos";
import { BadgeEstado } from "../shared/BadgeEstado";
import { SeccionPlazos } from "../shared/SeccionPlazos";
import {
  DetalleShell,
  CabeceraMovimiento,
  BandaFaltante,
  SeccionDetalle,
  GrillaDetalles,
  ArchivosDetalle,
} from "./PiezasDetalle";

/**
 * Vista de lectura de un Gasto (Movimientos v2). Un gasto no se descompone en
 * neto e impuestos como una compra: es un único importe, así que no lleva
 * bloque de totales.
 */
export function ModalDetalleGasto({
  gasto,
  faseNombre,
  usuarioNombre,
  onCerrar,
  onVerComprobante,
  onAgregarComprobante,
  onEliminarComprobante,
  onEditar,
  onEliminar,
}) {
  const etiquetaFactura = useEtiquetaTipoFactura();
  const etiquetaMedioPago = useEtiquetaMedioPago();
  const comprobantes = gasto.comprobantes ?? [];
  const vencida = diasVencida(gasto, new Date());

  return (
    <DetalleShell
      tipo={TIPOS_MOVIMIENTO.gasto.singular}
      icono={TIPOS_MOVIMIENTO.gasto.icono}
      fecha={gasto.fecha}
      titulo={gasto.descripcion}
      onCerrar={onCerrar}
      onEditar={onEditar}
      onEliminar={onEliminar}
    >
      <CabeceraMovimiento
        titulo={gasto.descripcion}
        monto={gasto.monto_ars}
        secundario={leyendaOtraMoneda(gasto.monto_usd, "usd", gasto)}
        // Pagado sólo si se pagaron todos los plazos (un gasto a 30 días no).
        badges={
          <BadgeEstado
            estado={getEstadoPagoConVencimiento(gasto.estado_pago ?? "pagado", vencida)}
          />
        }
      />

      {comprobantes.length === 0 && <BandaFaltante onAgregar={onAgregarComprobante} />}

      <SeccionDetalle titulo="Detalles">
        <GrillaDetalles
          campos={[
            { label: "Fase", valor: faseNombre ?? "Gasto general" },
            gasto.categorias?.length > 0 && {
              label: "Categorías",
              valor: gasto.categorias.map((c) => c.nombre).join(", "),
            },
            {
              label: "Comprobante",
              valor: etiquetaFactura(gasto.tipo_factura),
              punto: comprobantes.length > 0 ? OLIVA : ATENCION,
            },
            gasto.medio_pago && {
              label: "Medio de pago",
              valor: etiquetaMedioPago(gasto.medio_pago),
            },
            usuarioNombre && { label: "Cargado por", valor: usuarioNombre },
          ]}
        />
      </SeccionDetalle>

      <SeccionPlazos movimiento={gasto} />

      <ArchivosDetalle
        comprobantes={comprobantes}
        onVer={onVerComprobante}
        onAgregar={onAgregarComprobante}
        onEliminar={onEliminarComprobante}
      />
    </DetalleShell>
  );
}

export default ModalDetalleGasto;
