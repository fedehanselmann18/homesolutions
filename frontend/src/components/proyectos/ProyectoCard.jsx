import { useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import "./ProyectoCard.css";
import useAuth from "../../context/useAuth";
import { formatearFechaLarga } from "../../utils/fechaUtils";
import { getEstado } from "../../constants/estados";

export function ProyectoCard({ proyecto, onEditar, onEliminar }) {
  const navigate = useNavigate();
  const { usuario } = useAuth();

  const estado = getEstado(proyecto.estado);
  const IconoEstado = estado.icono;
  const esTerminado = proyecto.estado === "terminado";
  const canManage = usuario.rol === "admin";

  const precioFormateado = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
  }).format(Number(proyecto.precio_acordado ?? 0));

  const fechaFormateada = formatearFechaLarga(proyecto.fecha_inicio);

  const handleEditar = (e) => {
    e.stopPropagation();
    onEditar(proyecto);
  };

  const handleEliminar = (e) => {
    e.stopPropagation();
    onEliminar(proyecto);
  };

  return (
    <article
      className={`proyecto-card ${esTerminado ? "proyecto-card--terminado" : ""}`}
      style={{ borderLeftColor: estado.color }}
      onClick={() => navigate(`/proyectos/${proyecto.id}`)}
      role="button"
      tabIndex={0}
    >
      {canManage && (
        <div className="proyecto-card__acciones-flotantes">
          <button onClick={handleEditar} title="Editar" aria-label="Editar proyecto">
            <Pencil size={14} strokeWidth={2} />
          </button>
          <button
            onClick={handleEliminar}
            title="Eliminar"
            aria-label="Eliminar proyecto"
            className="proyecto-card__btn-eliminar"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      )}

      <h3 className="proyecto-card__nombre">{proyecto.nombre}</h3>
      <p className="proyecto-card__direccion">{proyecto.direccion}</p>

      <div className="proyecto-card__datos">
        <span>Iniciado el {fechaFormateada}</span>
        <span>{precioFormateado}</span>
      </div>

      <div className="proyecto-card__footer">
        <div
          className="proyecto-card__estado"
          style={{
            backgroundColor: `color-mix(in srgb, ${estado.color} 15%, white)`,
            color: estado.color,
            borderColor: `color-mix(in srgb, ${estado.color} 40%, white)`,
          }}
        >
          {IconoEstado && (
            <IconoEstado size={12} strokeWidth={2.25} className="proyecto-card__estado-icono" />
          )}
          {estado.label}
        </div>
      </div>
    </article>
  );
}

export default ProyectoCard;
