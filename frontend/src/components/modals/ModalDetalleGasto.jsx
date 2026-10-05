import { formatFecha } from "../../utils/formato";
import { leyendaOtraMoneda } from "../../utils/moneda";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { DetalleShell, BarraComposicion, SeccionDetalle, ChipsComprobantes } from "./PiezasDetalle";

/**
 * Vista de solo lectura de un Gasto, con el lenguaje visual de la dirección 3a
 * del rediseño (ver claudedesign/). Un gasto no se descompone en neto e
 * impuestos como una compra: es un único importe, así que la barra queda de
 * un solo tramo y no hay bloque de desglose.
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
}) {
  const contexto = [getTipoFacturaLabel(gasto.tipo_factura), faseNombre ?? "Gasto general"]
    .filter(Boolean)
    .join(" · ");

  return (
    <DetalleShell
      tipo={TIPOS_MOVIMIENTO.gasto.singular}
      icono={TIPOS_MOVIMIENTO.gasto.icono}
      contexto={contexto}
      fecha={formatFecha(gasto.fecha)}
      titulo={gasto.descripcion}
      subtitulo={usuarioNombre ? `Cargado por ${usuarioNombre}` : null}
      total={gasto.monto_ars}
      totalSecundario={leyendaOtraMoneda(gasto.monto_usd, "usd", gasto)}
      totalColor={TIPOS_MOVIMIENTO.gasto.color}
      onCerrar={onCerrar}
      onEditar={onEditar}
    >
      <BarraComposicion
        segmentos={[
          { label: "Monto", monto: gasto.monto_ars, color: TIPOS_MOVIMIENTO.gasto.color },
        ]}
      />

      {gasto.categorias?.length > 0 && (
        <SeccionDetalle titulo="Categorías">
          <div className="detalle__chips">
            {gasto.categorias.map((cat) => (
              <span key={cat.id} className="detalle__chip" style={{ cursor: "default" }}>
                {cat.nombre}
              </span>
            ))}
          </div>
        </SeccionDetalle>
      )}

      <SeccionDetalle titulo="Comprobantes">
        <ChipsComprobantes
          comprobantes={gasto.comprobantes ?? []}
          onVer={onVerComprobante}
          onAgregar={onAgregarComprobante}
          onEliminar={onEliminarComprobante}
        />
      </SeccionDetalle>
    </DetalleShell>
  );
}

export default ModalDetalleGasto;
