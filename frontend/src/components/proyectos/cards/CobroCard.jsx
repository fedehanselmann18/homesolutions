import useAuth from "../../../context/useAuth";
import { formatMoneda, formatFecha } from "../../../utils/formato";
import { getTipoFacturaLabel } from "../../../constants/tipoFactura";
import { SeccionComprobantes } from "../../shared/SeccionComprobantes";
import "./CobroCard.css";

export function CobroCard({
    cobro,
    usuarioNombre,
    onEditar,
    onEliminar,
    onVerComprobante,
    onAgregarComprobante,
    onEliminarComprobante,
}) {
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";

    const handleEditar = () => onEditar(cobro);
    const handleEliminar = () => onEliminar(cobro.id);

    return (
        <div className="cobro-card">
            <div className="cobro-card-contenido">
                <div className="cobro-card-header">
                    <h3 className="cobro-card-descripcion">{cobro.descripcion}</h3>
                    <span className="cobro-card-monto">{formatMoneda(cobro.monto)}</span>
                </div>

                <div className="cobro-card-meta">
                    <span>{formatFecha(cobro.fecha)}</span>
                    <span className="cobro-card-separador">•</span>
                    <span>{getTipoFacturaLabel(cobro.tipo_factura)}</span>
                </div>

                <div className="cobro-card-expandido">
                    {usuarioNombre && (
                        <p className="cobro-card-detalle-info">Cargado por {usuarioNombre}</p>
                    )}

                    <SeccionComprobantes
                        comprobantes={cobro.comprobantes ?? []}
                        onVer={onVerComprobante ? (c) => onVerComprobante(cobro.id, c.id) : undefined}
                        onAgregar={onAgregarComprobante ? (files) => onAgregarComprobante(cobro.id, files) : undefined}
                        onEliminar={onEliminarComprobante ? (id) => onEliminarComprobante(cobro.id, id) : undefined}
                        canManage={canManage}
                    />
                </div>
            </div>

            {canManage && (
                <div className="cobro-card-acciones">
                    <button
                        type="button"
                        className="cobro-card-btn cobro-card-btn--editar"
                        onClick={handleEditar}
                    >
                        Editar
                    </button>
                    <button
                        type="button"
                        className="cobro-card-btn cobro-card-btn--eliminar"
                        onClick={handleEliminar}
                    >
                        Eliminar
                    </button>
                </div>
            )}
        </div>
    );
}

export default CobroCard;
