import { leyendaOtraMoneda } from "../../utils/moneda";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { OLIVA, ATENCION } from "../../constants/colores";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
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
  const comprobantes = gasto.comprobantes ?? [];

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
        badges={<span className="badge badge--marca">Pagado</span>}
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
              valor: getTipoFacturaLabel(gasto.tipo_factura),
              punto: comprobantes.length > 0 ? OLIVA : ATENCION,
            },
            usuarioNombre && { label: "Cargado por", valor: usuarioNombre },
          ]}
        />
      </SeccionDetalle>

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
