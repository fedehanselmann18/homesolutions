import { ShoppingCart } from "lucide-react";

import { formatMoneda, formatFecha } from "../../utils/formato";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { getEstadoPago, getEstadoEnvio, getCondicionPagoLabel } from "../../constants/estadoCompra";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { AZUL, ROJO, NARANJA } from "../../constants/colores";
import { SeccionNotas } from "../shared/SeccionNotas";
import {
  DetalleShell,
  BarraComposicion,
  SeccionDetalle,
  ChipsComprobantes,
  TileEstado,
} from "./PiezasDetalle";

const OLIVA_CLARO = "#a8b36a";

/**
 * Vista de solo lectura de una Compra, con el lenguaje visual de la dirección
 * 3a del rediseño (ver claudedesign/). El desglose del total (neto,
 * impuestos uno por uno, notas de crédito y de débito) se muestra completo:
 * la barra da la proporción y la lista de abajo los importes exactos.
 */
export function ModalDetalleCompra({
  compra,
  faseNombre,
  proveedorNombre,
  usuarioNombre,
  productos = [],
  onCerrar,
  onVerComprobante,
  onVerNota,
  onAgregarComprobante,
  onEliminarComprobante,
  onAgregarNota,
  onEliminarNota,
  onTogglePago,
  onToggleEnvio,
  canManage = false,
}) {
  const estadoPago = getEstadoPago(compra.estado_pago);
  const estadoEnvio = getEstadoEnvio(compra.estado_envio);
  const pagado = compra.estado_pago === "pagado";
  const entregado = compra.estado_envio === "entregado";

  // Qué producto (y cuánto) devuelve cada nota: sin esto una nota de crédito
  // es sólo un monto suelto y no se sabe sobre qué línea de la compra cae.
  const resolverProducto = (detalleCompraId) => {
    const linea = compra.detalle?.find((d) => d.id === detalleCompraId);
    if (!linea) return null;
    const producto = productos.find((p) => p.id === linea.producto_id);
    return producto ? `${producto.marca} ${producto.modelo}` : null;
  };

  const impuestos = compra.impuestos_aplicados ?? [];
  // Los impuestos se suman de su propia lista y no de "total - neto", porque
  // precio_total ya viene con las notas aplicadas y esa resta los pisaría.
  const totalImpuestos = impuestos.reduce((acc, i) => acc + (Number(i.monto) || 0), 0);

  const notas = compra.notas ?? [];
  const notasCredito = totalNotasCredito(notas);
  const notasDebito = totalNotasDebito(notas);

  const contexto = [proveedorNombre, faseNombre, getTipoFacturaLabel(compra.tipo_factura)]
    .filter(Boolean)
    .join(" · ");

  const subtitulo = [
    getCondicionPagoLabel(compra.condicion_pago),
    compra.detalle?.length
      ? `${compra.detalle.length} ${compra.detalle.length === 1 ? "producto" : "productos"}`
      : null,
    usuarioNombre ? `Cargado por ${usuarioNombre}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <DetalleShell
      tipo="Compra"
      icono={ShoppingCart}
      contexto={contexto}
      fecha={formatFecha(compra.fecha)}
      titulo={compra.descripcion}
      subtitulo={subtitulo}
      total={compra.precio_total}
      onCerrar={onCerrar}
    >
      <BarraComposicion
        segmentos={[
          { label: "Neto", monto: compra.precio_neto, color: AZUL },
          { label: "Impuestos", monto: totalImpuestos, color: OLIVA_CLARO },
          { label: "Nota de crédito", monto: notasCredito, color: ROJO, signo: -1 },
          { label: "Nota de débito", monto: notasDebito, color: NARANJA, signo: 1 },
        ]}
      />

      <SeccionDetalle titulo="Desglose">
        <div className="detalle__desglose">
          <div className="detalle__desglose-fila">
            <span>Neto</span>
            <span>{formatMoneda(compra.precio_neto)}</span>
          </div>
          {impuestos.length > 0 ? (
            impuestos.map((i) => (
              <div className="detalle__desglose-fila" key={i.id}>
                <span>{i.impuesto?.nombre ?? "Impuesto"}</span>
                <span>{formatMoneda(i.monto)}</span>
              </div>
            ))
          ) : (
            <div className="detalle__desglose-fila">
              <span>Impuestos</span>
              <span>{formatMoneda(0)}</span>
            </div>
          )}
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
            <span>Total</span>
            <span>{formatMoneda(compra.precio_total)}</span>
          </div>
        </div>
      </SeccionDetalle>

      <div className="detalle__estados">
        <TileEstado
          label="Pago"
          estado={estadoPago}
          activo={pagado}
          onToggle={canManage && onTogglePago ? onTogglePago : undefined}
          titulo={pagado ? "Marcar sin pagar" : "Marcar pagado"}
        />
        <TileEstado
          label="Envío"
          estado={estadoEnvio}
          activo={entregado}
          onToggle={canManage && onToggleEnvio ? onToggleEnvio : undefined}
          titulo={entregado ? "Marcar sin entregar" : "Marcar entregado"}
        />
      </div>

      {compra.detalle?.length > 0 && (
        <SeccionDetalle titulo="Productos">
          {compra.detalle.map((d) => {
            const producto = productos.find((p) => p.id === d.producto_id);
            const subtotal = (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0);
            return (
              <div key={d.id} className="detalle__producto">
                <span className="detalle__producto-nombre">
                  {producto ? `${producto.marca} ${producto.modelo}` : "Producto eliminado"}
                </span>
                <span className="detalle__producto-cantidad">x{d.cantidad}</span>
                <span className="detalle__producto-subtotal">{formatMoneda(subtotal)}</span>
              </div>
            );
          })}
        </SeccionDetalle>
      )}

      {compra.categorias?.length > 0 && (
        <SeccionDetalle titulo="Categorías">
          <div className="detalle__chips">
            {compra.categorias.map((cat) => (
              <span key={cat.id} className="detalle__chip" style={{ cursor: "default" }}>
                {cat.nombre}
              </span>
            ))}
          </div>
        </SeccionDetalle>
      )}

      <SeccionDetalle titulo="Comprobantes">
        <ChipsComprobantes
          comprobantes={compra.comprobantes ?? []}
          onVer={onVerComprobante}
          onAgregar={onAgregarComprobante}
          onEliminar={onEliminarComprobante}
        />
      </SeccionDetalle>

      <SeccionNotas
        notas={notas}
        contexto="compra"
        resolverProducto={resolverProducto}
        onVer={onVerNota}
        onAgregar={onAgregarNota}
        onEliminar={onEliminarNota}
        canManage={canManage}
      />
    </DetalleShell>
  );
}

export default ModalDetalleCompra;
