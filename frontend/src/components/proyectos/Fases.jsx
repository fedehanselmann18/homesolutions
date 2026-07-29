import { useState, useEffect } from "react";
import {
    getFasesPorProyecto,
    crearFase,
    actualizarFase,
    eliminarFase,
} from "../../services/faseService";
import ModalFase from "../modals/ModalFase";
import FaseCard from "./fases/FaseCard";
import "./Fases.css";
import useAuth from "../../context/useAuth";
import { ESTADO_LABELS } from "../../constants/estados";

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
    const [fases, setFases] = useState([]);
    const [modalAbierto, setModalAbierto] = useState(false);
    const [faseEditando, setFaseEditando] = useState(null);

    useEffect(() => {
        fetchProyectoFases();
    }, [proyectoId]);

    const fetchProyectoFases = async () => {
        try {
            const data = await getFasesPorProyecto(proyectoId);
            setFases(data);
        } catch (error) {
            console.error("Error fetching fases:", error);
        }
    };

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
            fetchProyectoFases();
        } catch (error) {
            console.error("Error guardando fase:", error);
        }
    };

    const handleEliminarFase = async (faseId) => {
        try {
            await eliminarFase(faseId);
            fetchProyectoFases();
        } catch (error) {
            console.error("Error eliminando fase:", error);
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
                    const color = ESTADO_LABELS[estados[0]]?.color ?? "#94A3B8";

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
                                        onEliminar={handleEliminarFase}
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
        </div>
    );
}

export default Fases;