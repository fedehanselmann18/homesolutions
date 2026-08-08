import { formatMoneda, formatFecha } from "../../utils/formato";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { SeccionComprobantes } from "../shared/SeccionComprobantes";
import "./ModalCompra.css";
import "../proyectos/cards/GastoCard.css";

/**
 * Vista de solo lectura de un Gasto puntual (desde Seguimiento). Mismo
 * contenido que GastoCard en su estado expandido, sin acciones de edición.
 */
export function ModalDetalleGasto({ gasto, faseNombre, usuarioNombre, onCerrar, onVerComprobante }) {
    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
                <div className="gasto-card-header">
                    <h2>{gasto.descripcion}</h2>
                    <span className="gasto-card-monto">{formatMoneda(gasto.monto)}</span>
                </div>

                <div className="gasto-card-contenido">
                    <div className="gasto-card-meta">
                        <span>{formatFecha(gasto.fecha)}</span>
                        <span className="gasto-card-separador">•</span>
                        <span>{getTipoFacturaLabel(gasto.tipo_factura)}</span>
                        <span className="gasto-card-separador">•</span>
                        <span>{faseNombre ?? "Gasto general"}</span>
                    </div>

                    {gasto.categorias?.length > 0 && (
                        <div className="gasto-card-chips">
                            {gasto.categorias.map((cat) => (
                                <span key={cat.id} className="gasto-card-chip">
                                    {cat.nombre}
                                </span>
                            ))}
                        </div>
                    )}

                    {usuarioNombre && (
                        <p className="gasto-card-detalle-info">Cargado por {usuarioNombre}</p>
                    )}

                    <SeccionComprobantes
                        comprobantes={gasto.comprobantes ?? []}
                        onVer={onVerComprobante ? (c) => onVerComprobante(gasto.id, c.id) : undefined}
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

export default ModalDetalleGasto;
