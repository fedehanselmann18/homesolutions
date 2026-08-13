import { formatMoneda, formatFecha } from "../../utils/formato";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { getTipoProducto } from "../../constants/tipoProducto";
import { getEstadoPago, getEstadoEnvio, getCondicionPagoLabel } from "../../constants/estadoCompra";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { SeccionComprobantes } from "../shared/SeccionComprobantes";
import { SeccionNotas } from "../shared/SeccionNotas";
import "./ModalCompra.css";
import "../proyectos/cards/CompraCard.css";

/**
 * Vista de solo lectura de una Compra puntual (desde Seguimiento). Mismo
 * contenido que CompraCard en su estado expandido, pero sin la sección de
 * acciones (editar/eliminar/marcar pagado/entregado/agregar comprobante o nota).
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
}) {
  const estadoPago = getEstadoPago(compra.estado_pago);
  const estadoEnvio = getEstadoEnvio(compra.estado_envio);
  const IconoPago = estadoPago.icono;
  const IconoEnvio = estadoEnvio.icono;

  const totalImpuestos = (compra.impuestos_aplicados ?? []).reduce(
    (acc, i) => acc + (Number(i.monto) || 0),
    0
  );
  const notas = compra.notas ?? [];
  const notasCredito = totalNotasCredito(notas);
  const notasDebito = totalNotasDebito(notas);

  const resolverProducto = (detalleCompraId) => {
    const linea = compra.detalle?.find((d) => d.id === detalleCompraId);
    if (!linea) return null;
    const producto = productos.find((p) => p.id === linea.producto_id);
    return producto ? `${producto.marca} ${producto.modelo}` : null;
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenido modal-contenido--ancho" onClick={(e) => e.stopPropagation()}>
        <div className="compra-card-header">
          <h2>{compra.descripcion}</h2>
          <span className="compra-card-monto">{formatMoneda(compra.precio_total)}</span>
        </div>

        <div className="compra-card-contenido">
          <div className="compra-card-badges">
            <span
              className="compra-card-badge"
              style={{
                backgroundColor: `${estadoPago.color}1c`,
                color: estadoPago.color,
                borderColor: `${estadoPago.color}55`,
              }}
            >
              {IconoPago && <IconoPago size={12} strokeWidth={2.25} />}
              {estadoPago.label}
            </span>
            <span
              className="compra-card-badge"
              style={{
                backgroundColor: `${estadoEnvio.color}1c`,
                color: estadoEnvio.color,
                borderColor: `${estadoEnvio.color}55`,
              }}
            >
              {IconoEnvio && <IconoEnvio size={12} strokeWidth={2.25} />}
              {estadoEnvio.label}
            </span>
          </div>

          <div className="compra-card-meta">
            <span>{formatFecha(compra.fecha)}</span>
            <span className="compra-card-separador">•</span>
            <span>{getTipoFacturaLabel(compra.tipo_factura)}</span>
          </div>

          {compra.categorias?.length > 0 && (
            <div className="compra-card-chips">
              {compra.categorias.map((cat) => (
                <span key={cat.id} className="compra-card-chip">
                  {cat.nombre}
                </span>
              ))}
            </div>
          )}

          <div className="compra-card-meta compra-card-meta--secundaria">
            {proveedorNombre && <span>Proveedor: {proveedorNombre}</span>}
            {proveedorNombre && faseNombre && <span className="compra-card-separador">•</span>}
            {faseNombre && <span>Fase: {faseNombre}</span>}
          </div>

          {compra.detalle?.length > 0 && (
            <ul className="compra-card-productos">
              {compra.detalle.map((d) => {
                const producto = productos.find((p) => p.id === d.producto_id);
                const tipo = producto ? getTipoProducto(producto.tipo) : null;
                return (
                  <li key={d.id} className="compra-card-producto-item">
                    <span className="compra-card-producto-nombre">
                      {producto ? `${producto.marca} ${producto.modelo}` : "Producto eliminado"}
                    </span>
                    <span className="compra-card-producto-cantidad">x{d.cantidad}</span>
                    {tipo && (
                      <span
                        className="compra-card-producto-tipo"
                        style={{ color: tipo.color, backgroundColor: `${tipo.color}1c` }}
                      >
                        {tipo.icono && <tipo.icono size={12} strokeWidth={2.25} />} {tipo.label}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="compra-card-detalle-info">
            Condición de pago: {getCondicionPagoLabel(compra.condicion_pago)}
          </p>

          <div className="compra-card-resumen">
            <div className="compra-card-resumen-fila">
              <span>Neto</span>
              <span>{formatMoneda(compra.precio_neto)}</span>
            </div>
            {(compra.impuestos_aplicados ?? []).length > 0 ? (
              compra.impuestos_aplicados.map((i) => (
                <div className="compra-card-resumen-fila" key={i.id}>
                  <span>{i.impuesto?.nombre ?? "Impuesto"}</span>
                  <span>{formatMoneda(i.monto)}</span>
                </div>
              ))
            ) : (
              <div className="compra-card-resumen-fila">
                <span>Impuestos</span>
                <span>{formatMoneda(totalImpuestos)}</span>
              </div>
            )}
            {notasCredito > 0 && (
              <div className="compra-card-resumen-fila compra-card-resumen-fila--nota-credito">
                <span>Notas de crédito</span>
                <span>-{formatMoneda(notasCredito)}</span>
              </div>
            )}
            {notasDebito > 0 && (
              <div className="compra-card-resumen-fila compra-card-resumen-fila--nota-debito">
                <span>Notas de débito</span>
                <span>+{formatMoneda(notasDebito)}</span>
              </div>
            )}
            <div className="compra-card-resumen-fila compra-card-resumen-fila--total">
              <span>Total</span>
              <span>{formatMoneda(compra.precio_total)}</span>
            </div>
          </div>

          {usuarioNombre && <p className="compra-card-detalle-info">Cargado por {usuarioNombre}</p>}

          <SeccionComprobantes
            comprobantes={compra.comprobantes ?? []}
            onVer={onVerComprobante ? (c) => onVerComprobante(compra.id, c.id) : undefined}
          />

          <SeccionNotas
            notas={notas}
            contexto="compra"
            resolverProducto={resolverProducto}
            onVer={onVerNota ? (n) => onVerNota(compra.id, n.id) : undefined}
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

export default ModalDetalleCompra;
