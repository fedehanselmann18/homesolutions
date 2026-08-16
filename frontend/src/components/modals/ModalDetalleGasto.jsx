import { Receipt } from "lucide-react";

import { formatFecha } from "../../utils/formato";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { NARANJA } from "../../constants/colores";
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
}) {
  const contexto = [getTipoFacturaLabel(gasto.tipo_factura), faseNombre ?? "Gasto general"]
    .filter(Boolean)
    .join(" · ");

  return (
    <DetalleShell
      tipo="Gasto"
      icono={Receipt}
      contexto={contexto}
      fecha={formatFecha(gasto.fecha)}
      titulo={gasto.descripcion}
      subtitulo={usuarioNombre ? `Cargado por ${usuarioNombre}` : null}
      total={gasto.monto}
      totalColor={NARANJA}
      onCerrar={onCerrar}
    >
      <BarraComposicion segmentos={[{ label: "Monto", monto: gasto.monto, color: NARANJA }]} />

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
