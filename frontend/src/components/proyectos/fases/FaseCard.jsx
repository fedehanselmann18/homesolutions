import { useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import "./FaseCard.css";
import useAuth from "../../../context/useAuth";
import { getEstadoLabel } from "../../../constants/estados";

export function FaseCard({ fase, proyectoId, onEditar, onEliminar }) {
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";
  const navigate = useNavigate();
  const estadoInfo = getEstadoLabel(fase.estado);
  const terminada = fase.estado === "terminada" || fase.estado === "auditada";
  const enCurso = fase.estado === "en_curso";

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
      <div className="fase-card-indicador">
        {terminada ? (
          <CheckCircle2 size={16} strokeWidth={2.25} style={{ color: estadoInfo.color }} />
        ) : (
          <span
            className="fase-card-punto"
            style={
              enCurso
                ? { backgroundColor: estadoInfo.color, borderColor: estadoInfo.color }
                : { borderColor: estadoInfo.color }
            }
          />
        )}
      </div>

      <div className="fase-card-contenido">
        <h3 className={`fase-card-nombre ${terminada ? "fase-card-nombre--terminada" : ""}`}>
          {fase.nombre}
        </h3>
        {fase.descripcion && <p className="fase-card-descripcion">{fase.descripcion}</p>}
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
