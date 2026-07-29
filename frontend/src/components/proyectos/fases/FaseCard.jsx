import { useNavigate } from "react-router-dom";
import "./FaseCard.css";
import useAuth from "../../../context/useAuth";
import { getEstadoLabel } from "../../../constants/estados";

export function FaseCard({ fase, proyectoId, onEditar, onEliminar }) {
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";
    const navigate = useNavigate();
    const estadoInfo = getEstadoLabel(fase.estado);

    const handleClickCard = () => {
        navigate(`/proyectos/${proyectoId}/fases/${fase.id}`);
    };

    const handleEditar = (e) => {
        e.stopPropagation();
        onEditar(fase);
    };

    const handleEliminar = (e) => {
        e.stopPropagation();
        onEliminar(fase.id);
    };

    return (
        <div className="fase-card" onClick={handleClickCard}>
            <div className="fase-card-contenido">
                <div className="fase-card-header">
                    <h3 className="fase-card-nombre">{fase.nombre}</h3>
                    <span
                        className="fase-card-badge"
                        style={{
                            backgroundColor: `${estadoInfo.color}1c`,
                            color: estadoInfo.color,
                            borderColor: `${estadoInfo.color}55`,
                        }}
                    >
                        <span className="fase-card-badge-icono">{estadoInfo.icono}</span>
                        {estadoInfo.label}
                    </span>
                </div>

                {fase.descripcion && (
                    <p className="fase-card-descripcion">{fase.descripcion}</p>
                )}
            </div>

            {canManage && (
                <div className="fase-card-acciones">
                    <button
                        type="button"
                        className="fase-card-btn fase-card-btn--editar"
                        onClick={handleEditar}
                    >
                        Editar
                    </button>
                    <button
                        type="button"
                        className="fase-card-btn fase-card-btn--eliminar"
                        onClick={handleEliminar}
                    >
                        Eliminar
                    </button>
                </div>
            )}
        </div>
    );
}

export default FaseCard;