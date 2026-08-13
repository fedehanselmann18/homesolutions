import { useState } from "react";
import useAuth from "../../../context/useAuth";
import { formatMoneda, formatFecha } from "../../../utils/formato";
import { getTipoFacturaLabel } from "../../../constants/tipoFactura";
import { getTipoProducto } from "../../../constants/tipoProducto";
import {
  getEstadoPago,
  getEstadoEnvio,
  getCondicionPagoLabel,
} from "../../../constants/estadoCompra";
import { totalNotasCredito, totalNotasDebito } from "../../../utils/notas";
import { SeccionComprobantes } from "../../shared/SeccionComprobantes";
import { SeccionNotas } from "../../shared/SeccionNotas";
import "./CompraCard.css";

export function CompraCard({
  compra,
  proveedorNombre,
  faseNombre,
  usuarioNombre,
  productos = [],
  onEditar,
  onEliminar,
  onVerComprobante,
  onAgregarComprobante,
  onEliminarComprobante,
  onAgregarNota,
  onVerNota,
  onEliminarNota,
  onTogglePago,
  onToggleEnvio,
  onAbrirDetalle,
}) {
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";

  const [productoAbiertoId, setProductoAbiertoId] = useState(null);

  const estadoPago = getEstadoPago(compra.estado_pago);
  const estadoEnvio = getEstadoEnvio(compra.estado_envio);
  const IconoPago = estadoPago.icono;
  const IconoEnvio = estadoEnvio.icono;

  // Impuestos se calculan de la lista propia -- no de
  // "precio_total - precio_neto", porque precio_total ya viene con las
  // notas de crédito/débito aplicadas y esa resta pisaría el impuesto.
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

  const handleEditar = () => onEditar(compra);
  const handleEliminar = () => onEliminar(compra.id);
  const handleTogglePago = () => onTogglePago(compra);
  const handleToggleEnvio = () => onToggleEnvio(compra);

  const toggleProducto = (detalleId) => (e) => {
    e.stopPropagation();
    setProductoAbiertoId((actual) => (actual === detalleId ? null : detalleId));
  };

  return (
    <div
      className="compra-card"
      id={`compra-${compra.id}`}
      onClick={onAbrirDetalle ? () => onAbrirDetalle(compra) : undefined}
      style={onAbrirDetalle ? { cursor: "pointer" } : undefined}
    >
      <div className="compra-card-grid">
        <div className="compra-card-col-izq">
          <h3 className="compra-card-descripcion">{compra.descripcion}</h3>

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

          {compra.categorias?.length > 0 && (
            <div className="compra-card-chips">
              {compra.categorias.map((cat) => (
                <span key={cat.id} className="compra-card-chip">
                  {cat.nombre}
                </span>
              ))}
            </div>
          )}

          <div className="compra-card-meta">
            <span>{formatFecha(compra.fecha)}</span>
            <span className="compra-card-separador">•</span>
            <span>{getTipoFacturaLabel(compra.tipo_factura)}</span>
          </div>

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
                const abierto = productoAbiertoId === d.id;
                const subtotal = (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0);
                return (
                  <li
                    key={d.id}
                    className={`compra-card-producto-item${abierto ? " compra-card-producto-item--abierto" : ""}`}
                    onClick={toggleProducto(d.id)}
                  >
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

                    {abierto && producto && (
                      <div
                        className="compra-card-producto-popover"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="compra-card-producto-popover-nombre">
                          {producto.marca} {producto.modelo}
                        </p>
                        <div className="compra-card-producto-popover-fila">
                          <span>Tipo</span>
                          <span>{tipo ? tipo.label : "—"}</span>
                        </div>
                        <div className="compra-card-producto-popover-fila">
                          <span>Cantidad</span>
                          <span>{d.cantidad}</span>
                        </div>
                        <div className="compra-card-producto-popover-fila">
                          <span>Precio unitario</span>
                          <span>{formatMoneda(d.precio_unitario)}</span>
                        </div>
                        <div className="compra-card-producto-popover-fila compra-card-producto-popover-fila--total">
                          <span>Subtotal</span>
                          <span>{formatMoneda(subtotal)}</span>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <p className="compra-card-detalle-info">
            Condición de pago: {getCondicionPagoLabel(compra.condicion_pago)}
          </p>

          {usuarioNombre && <p className="compra-card-detalle-info">Cargado por {usuarioNombre}</p>}

          {canManage && (
            <div className="compra-card-acciones" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="compra-card-btn compra-card-btn--toggle"
                onClick={handleTogglePago}
              >
                {compra.estado_pago === "pagado" ? "Marcar sin pagar" : "Marcar pagado"}
              </button>
              <button
                type="button"
                className="compra-card-btn compra-card-btn--toggle"
                onClick={handleToggleEnvio}
              >
                {compra.estado_envio === "entregado" ? "Marcar sin entregar" : "Marcar entregado"}
              </button>
              <button
                type="button"
                className="compra-card-btn compra-card-btn--editar"
                onClick={handleEditar}
              >
                Editar
              </button>
              <button
                type="button"
                className="compra-card-btn compra-card-btn--eliminar"
                onClick={handleEliminar}
              >
                Eliminar
              </button>
            </div>
          )}
        </div>

        <div className="compra-card-col-der">
          <div className="compra-card-resumen">
            <div className="compra-card-resumen-fila">
              <span>Neto</span>
              <span>{formatMoneda(compra.precio_neto)}</span>
            </div>
            <div className="compra-card-resumen-fila">
              <span>Impuestos</span>
              <span>{formatMoneda(totalImpuestos)}</span>
            </div>
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

          <div className="compra-card-col-der-seccion" onClick={(e) => e.stopPropagation()}>
            <SeccionComprobantes
              comprobantes={compra.comprobantes ?? []}
              onVer={onVerComprobante ? (c) => onVerComprobante(compra.id, c.id) : undefined}
              onAgregar={
                onAgregarComprobante ? (files) => onAgregarComprobante(compra.id, files) : undefined
              }
              onEliminar={
                onEliminarComprobante ? (id) => onEliminarComprobante(compra.id, id) : undefined
              }
              canManage={canManage}
            />
          </div>

          <div className="compra-card-col-der-seccion" onClick={(e) => e.stopPropagation()}>
            <SeccionNotas
              notas={notas}
              contexto="compra"
              variant="compacta"
              resolverProducto={resolverProducto}
              onVer={onVerNota ? (n) => onVerNota(compra.id, n.id) : undefined}
              onAgregar={onAgregarNota ? () => onAgregarNota(compra) : undefined}
              onEliminar={onEliminarNota ? (id) => onEliminarNota(compra.id, id) : undefined}
              canManage={canManage}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default CompraCard;
