import { useNavigate } from "react-router-dom";
import { Pencil, Trash2, Phone, Mail, Package, FileMinus, FilePlus } from "lucide-react";
import useAuth from "../../context/useAuth";
import { formatMoneda } from "../../utils/formato";
import "./ProveedorCard.css";

const VERDE = "#16a34a";
const ROJO = "#dc2626";

export function ProveedorCard({
    proveedor,
    rubro,
    cantidadProductos,
    totalComprado,
    deuda,
    totalNotasCredito = 0,
    totalNotasDebito = 0,
    onEditar,
    onEliminar,
}) {
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";

    const handleEditar = (e) => {
        e.stopPropagation();
        onEditar(proveedor);
    };

    const handleEliminar = (e) => {
        e.stopPropagation();
        onEliminar(proveedor);
    };

    return (
        <article
            className="proveedor-card"
            onClick={() => navigate(`/proveedores/${proveedor.id}`)}
            role="button"
            tabIndex={0}
        >
            {canManage && (
                <div className="proveedor-card__acciones-flotantes">
                    <button onClick={handleEditar} title="Editar" aria-label="Editar proveedor">
                        <Pencil size={14} strokeWidth={2} />
                    </button>
                    <button
                        onClick={handleEliminar}
                        title="Eliminar"
                        aria-label="Eliminar proveedor"
                        className="proveedor-card__btn-eliminar"
                    >
                        <Trash2 size={14} strokeWidth={2} />
                    </button>
                </div>
            )}

            <h3 className="proveedor-card__nombre">{proveedor.nombre}</h3>
            <div className="proveedor-card__chips">
                {rubro && <span className="proveedor-card__rubro">{rubro}</span>}
                {totalNotasCredito > 0 && (
                    <span className="proveedor-card__badge-nc" title={`${formatMoneda(totalNotasCredito)} en notas de crédito`}>
                        <FileMinus size={12} strokeWidth={2.25} />
                        -{formatMoneda(totalNotasCredito)}
                    </span>
                )}
                {totalNotasDebito > 0 && (
                    <span className="proveedor-card__badge-nd" title={`${formatMoneda(totalNotasDebito)} en notas de débito`}>
                        <FilePlus size={12} strokeWidth={2.25} />
                        +{formatMoneda(totalNotasDebito)}
                    </span>
                )}
            </div>

            <div className="proveedor-card__contacto">
                {proveedor.telefono && (
                    <span>
                        <Phone size={13} strokeWidth={2} /> {proveedor.telefono}
                    </span>
                )}
                {proveedor.email && (
                    <span>
                        <Mail size={13} strokeWidth={2} /> {proveedor.email}
                    </span>
                )}
            </div>

            <div className="proveedor-card__productos">
                <Package size={13} strokeWidth={2} />
                {cantidadProductos} {cantidadProductos === 1 ? "producto" : "productos"}
            </div>

            <div className="proveedor-card__footer">
                <div className="proveedor-card__metrica">
                    <span className="proveedor-card__metrica-label">Comprado histórico</span>
                    <span className="proveedor-card__metrica-valor">{formatMoneda(totalComprado)}</span>
                </div>
                <div className="proveedor-card__metrica">
                    <span className="proveedor-card__metrica-label">Deuda pendiente</span>
                    <span
                        className="proveedor-card__metrica-valor"
                        style={{ color: deuda > 0 ? ROJO : VERDE }}
                    >
                        {formatMoneda(deuda)}
                    </span>
                </div>
            </div>
        </article>
    );
}

export default ProveedorCard;
