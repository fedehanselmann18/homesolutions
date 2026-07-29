import useAuth from "../../../context/useAuth";
import { formatMoneda, formatFecha } from "../../../utils/formato";
import { getTipoFacturaLabel } from "../../../constants/tipoFactura";
import { getTipoProducto } from "../../../constants/tipoProducto";
import { getEstadoPago, getEstadoEnvio, getCondicionPagoLabel } from "../../../constants/estadoCompra";
import { SeccionComprobantes } from "../../shared/SeccionComprobantes";
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
    onTogglePago,
    onToggleEnvio,
}) {
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";

    const estadoPago = getEstadoPago(compra.estado_pago);
    const estadoEnvio = getEstadoEnvio(compra.estado_envio);
    const IconoPago = estadoPago.icono;
    const IconoEnvio = estadoEnvio.icono;

    const handleEditar = () => onEditar(compra);
    const handleEliminar = () => onEliminar(compra.id);
    const handleTogglePago = () => onTogglePago(compra);
    const handleToggleEnvio = () => onToggleEnvio(compra);

    return (
        <div className="compra-card">
            <div className="compra-card-contenido">
                <div className="compra-card-header">
                    <h3 className="compra-card-descripcion">{compra.descripcion}</h3>
                    <span className="compra-card-monto">{formatMoneda(compra.precio_total)}</span>
                </div>

                <div className="compra-card-badges">
                    <span
                        className="compra-card-badge"
                        style={{ backgroundColor: `${estadoPago.color}1c`, color: estadoPago.color, borderColor: `${estadoPago.color}55` }}
                    >
                        {IconoPago && <IconoPago size={12} strokeWidth={2.25} />}
                        {estadoPago.label}
                    </span>
                    <span
                        className="compra-card-badge"
                        style={{ backgroundColor: `${estadoEnvio.color}1c`, color: estadoEnvio.color, borderColor: `${estadoEnvio.color}55` }}
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

                <div className="compra-card-expandido">
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
                        <div className="compra-card-resumen-fila">
                            <span>Impuestos</span>
                            <span>{formatMoneda(compra.precio_total - compra.precio_neto)}</span>
                        </div>
                        <div className="compra-card-resumen-fila compra-card-resumen-fila--total">
                            <span>Total</span>
                            <span>{formatMoneda(compra.precio_total)}</span>
                        </div>
                    </div>

                    {usuarioNombre && (
                        <p className="compra-card-detalle-info">Cargado por {usuarioNombre}</p>
                    )}

                    <SeccionComprobantes
                        comprobantes={compra.comprobantes ?? []}
                        onVer={onVerComprobante ? (c) => onVerComprobante(compra.id, c.id) : undefined}
                        onAgregar={onAgregarComprobante ? (files) => onAgregarComprobante(compra.id, files) : undefined}
                        onEliminar={onEliminarComprobante ? (id) => onEliminarComprobante(compra.id, id) : undefined}
                        canManage={canManage}
                    />
                </div>
            </div>

            {canManage && (
                <div className="compra-card-acciones">
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
    );
}

export default CompraCard;
