import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { crearFase, actualizarFase, eliminarFase } from "../../services/faseService";
import { useFasesPorProyecto } from "../../hooks/queries";
import ModalFase from "../modals/ModalFase";
import ModalConfirmar from "../modals/ModalConfirmar";
import FaseCard from "./fases/FaseCard";
import "./Fases.css";
import useAuth from "../../context/useAuth";
import { useToast } from "../../context/useToast";
import { ESTADO_LABELS } from "../../constants/estados";
import { obtenerDetalleBackend } from "../../utils/errorHandling";

// Orden fijo: en curso primero, después por empezar, y terminadas (incluye
// "auditada", que en la práctica es una fase ya terminada) al final.
const SECCIONES = [
  { key: "en_curso", titulo: "En curso", estados: ["en_curso"] },
  { key: "por_empezar", titulo: "Por empezar", estados: ["por_empezar"] },
  { key: "terminadas", titulo: "Terminadas", estados: ["terminada", "auditada"] },
];

export function Fases({ proyectoId }) {
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: fases = [] } = useFasesPorProyecto(proyectoId);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [faseEditando, setFaseEditando] = useState(null);
  const [faseAEliminar, setFaseAEliminar] = useState(null);

  // Invalidar por el prefijo "fases" alcanza tanto esta key ("por
  // proyecto") como la global de Dashboard y la "detalle" de FaseDetalle
  // -- ver lib/queryKeys.js.
  const invalidarFases = () => queryClient.invalidateQueries({ queryKey: ["fases"] });

  const handleNuevaFase = () => {
    setFaseEditando(null);
    setModalAbierto(true);
  };

  const handleEditarFase = (fase) => {
    setFaseEditando(fase);
    setModalAbierto(true);
  };

  const handleGuardarFase = async (datosForm) => {
    try {
      if (faseEditando) {
        await actualizarFase(faseEditando.id, datosForm);
      } else {
        await crearFase({ ...datosForm, proyecto_id: proyectoId });
      }
      setModalAbierto(false);
      setFaseEditando(null);
      invalidarFases();
    } catch (error) {
      console.error("Error guardando fase:", error);
      toast.error(obtenerDetalleBackend(error) ?? "No se pudo guardar la fase.");
    }
  };

  const handleSolicitarEliminarFase = (faseId) => {
    setFaseAEliminar(fases.find((f) => f.id === faseId) ?? { id: faseId });
  };

  const handleConfirmarEliminarFase = async () => {
    const faseId = faseAEliminar.id;
    setFaseAEliminar(null);
    try {
      await eliminarFase(faseId);
      invalidarFases();
    } catch (error) {
      console.error("Error eliminando fase:", error);
      toast.error(obtenerDetalleBackend(error) ?? "No se pudo eliminar la fase.");
    }
  };

  return (
    <div>
      <div className="fases-header">
        <h2>Fases del Proyecto</h2>
        {canManage && <button onClick={handleNuevaFase}>Nueva fase</button>}
      </div>

      {fases.length === 0 ? (
        <p>No hay fases disponibles para este proyecto.</p>
      ) : (
        SECCIONES.map(({ key, titulo, estados }) => {
          const fasesDeLaSeccion = fases.filter((f) => estados.includes(f.estado));
          if (fasesDeLaSeccion.length === 0) return null;
          const color = ESTADO_LABELS[estados[0]]?.color ?? "#6b7280";

          return (
            <section key={key} className="fases-seccion" aria-label={titulo}>
              <h3 className="fases-seccion-titulo">
                <span className="fases-seccion-punto" style={{ backgroundColor: color }} />
                {titulo}
                <span className="fases-seccion-contador">{fasesDeLaSeccion.length}</span>
              </h3>
              <div className="fases-grid">
                {fasesDeLaSeccion.map((fase) => (
                  <FaseCard
                    key={fase.id}
                    fase={fase}
                    proyectoId={proyectoId}
                    onEditar={handleEditarFase}
                    onEliminar={handleSolicitarEliminarFase}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      {modalAbierto && (
        <ModalFase
          fase={faseEditando}
          onGuardar={handleGuardarFase}
          onCerrar={() => setModalAbierto(false)}
        />
      )}

      {faseAEliminar && (
        <ModalConfirmar
          titulo="Eliminar fase"
          mensaje="Esta acción no se puede deshacer."
          nombreRecurso={faseAEliminar.nombre}
          onConfirmar={handleConfirmarEliminarFase}
          onCancelar={() => setFaseAEliminar(null)}
        />
      )}
    </div>
  );
}

export default Fases;
