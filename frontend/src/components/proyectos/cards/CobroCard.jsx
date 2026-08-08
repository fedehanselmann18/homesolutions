import useAuth from "../../../context/useAuth";
import { formatMoneda, formatFecha } from "../../../utils/formato";
import { getTipoFacturaLabel } from "../../../constants/tipoFactura";
import { totalNotasCredito, totalNotasDebito } from "../../../utils/notas";
import { SeccionComprobantes } from "../../shared/SeccionComprobantes";
import { SeccionNotas } from "../../shared/SeccionNotas";
import "./CobroCard.css";

export function CobroCard({
    cobro,
    usuarioNombre,
    onEditar,
    onEliminar,
    onVerComprobante,
    onAgregarComprobante,
    onEliminarComprobante,
    onAgregarNota,
    onVerNota,
    onEliminarNota,
    onAbrirDetalle,
}) {
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";

    const handleEditar = () => onEditar(cobro);
    const handleEliminar = () => onEliminar(cobro.id);

    const notas = cobro.notas ?? [];
    const notasCredito = totalNotasCredito(notas);
    const notasDebito = totalNotasDebito(notas);
    // monto_neto lo calcula el backend (Cobro.monto_neto); si por lo que sea
    // no vino en la respuesta, se calcula acá con el mismo criterio.
    const montoNeto = cobro.monto_neto ?? (Number(cobro.monto) - notasCredito + notasDebito);

    return (
        <div
            className="cobro-card"
            onClick={onAbrirDetalle ? () => onAbrirDetalle(cobro) : undefined}
            style={onAbrirDetalle ? { cursor: "pointer" } : undefined}
        >
            <div className="cobro-card-contenido">
                <div className="cobro-card-header">
                    <h3 className="cobro-card-descripcion">{cobro.descripcion}</h3>
                    <span className="cobro-card-monto">{formatMoneda(montoNeto)}</span>
                </div>

                <div className="cobro-card-meta">
                    <span>{formatFecha(cobro.fecha)}</span>
                    <span className="cobro-card-separador">•</span>
                    <span>{getTipoFacturaLabel(cobro.tipo_factura)}</span>
                </div>

                {(notasCredito > 0 || notasDebito > 0) && (
                    <div className="cobro-card-resumen">
                        <div className="cobro-card-resumen-fila">
                            <span>Bruto</span>
                            <span>{formatMoneda(cobro.monto)}</span>
                        </div>
                        {notasCredito > 0 && (
                            <div className="cobro-card-resumen-fila cobro-card-resumen-fila--nota-credito">
                                <span>Notas de crédito</span>
                                <span>-{formatMoneda(notasCredito)}</span>
                            </div>
                        )}
                        {notasDebito > 0 && (
                            <div className="cobro-card-resumen-fila cobro-card-resumen-fila--nota-debito">
                                <span>Notas de débito</span>
                                <span>+{formatMoneda(notasDebito)}</span>
                            </div>
                        )}
                        <div className="cobro-card-resumen-fila cobro-card-resumen-fila--total">
                            <span>Neto</span>
                            <span>{formatMoneda(montoNeto)}</span>
                        </div>
                    </div>
                )}

                <div className="cobro-card-expandido">
                    {usuarioNombre && (
                        <p className="cobro-card-detalle-info">Cargado por {usuarioNombre}</p>
                    )}

                    <div onClick={(e) => e.stopPropagation()}>
                        <SeccionComprobantes
                            comprobantes={cobro.comprobantes ?? []}
                            onVer={onVerComprobante ? (c) => onVerComprobante(cobro.id, c.id) : undefined}
                            onAgregar={onAgregarComprobante ? (files) => onAgregarComprobante(cobro.id, files) : undefined}
                            onEliminar={onEliminarComprobante ? (id) => onEliminarComprobante(cobro.id, id) : undefined}
                            canManage={canManage}
                        />
                    </div>

                    <div onClick={(e) => e.stopPropagation()}>
                        <SeccionNotas
                            notas={notas}
                            contexto="cobro"
                            onVer={onVerNota ? (n) => onVerNota(cobro.id, n.id) : undefined}
                            onAgregar={onAgregarNota ? () => onAgregarNota(cobro) : undefined}
                            onEliminar={onEliminarNota ? (id) => onEliminarNota(cobro.id, id) : undefined}
                            canManage={canManage}
                        />
                    </div>
                </div>
            </div>

            {canManage && (
                <div className="cobro-card-acciones" onClick={(e) => e.stopPropagation()}>
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
