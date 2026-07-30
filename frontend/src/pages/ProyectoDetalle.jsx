import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getProyectoPorId } from "../services/proyectoService";
import ProyectoDetalleHeader from "../components/proyectos/ProyectoDetalleHeader";
import Fases from "../components/proyectos/Fases";
import Acciones from "../components/proyectos/Acciones";
import AnalisisGeneral from "../components/proyectos/AnalisisGeneral";
import Seguimiento from "../components/proyectos/Seguimiento";
import { Cargando } from "../components/shared/Cargando";
import "./ProyectoDetalle.css";

function ProyectoDetalle() {
    const { id } = useParams()
    const [proyecto, setProyecto] = useState(null);
    const [tabActiva, setTabActiva] = useState("fases");

    useEffect(() => {
        const fetchProyecto = async () => {
            try {
                const data = await getProyectoPorId(id);
                setProyecto(data);
            } catch (error) {
                console.error("Error fetching proyecto:", error);
            }
        };

        fetchProyecto();
    }, [id]);

    if (!proyecto) {
        return <Cargando texto="Cargando proyecto..." />;
    }

    return (
        <div className="proyecto-detalle">

            <ProyectoDetalleHeader proyecto={proyecto} />

            <div className="tabs">
                <button 
                    className={tabActiva === 'fases' ? 'active' : ''}
                    onClick={() => setTabActiva('fases')}
                >
                    Fases del proyecto
                </button>
                                <button 
                    className={tabActiva === 'acciones' ? 'active' : ''}
                    onClick={() => setTabActiva('acciones')}
                >
                    Acciones
                </button>
                                <button
                    className={tabActiva === 'analisis' ? 'active' : ''}
                    onClick={() => setTabActiva('analisis')}
                >
                    Análisis General
                </button>
                                <button
                    className={tabActiva === 'seguimiento' ? 'active' : ''}
                    onClick={() => setTabActiva('seguimiento')}
                >
                    Seguimiento
                </button>
            </div>

            {tabActiva === 'fases' && <Fases proyectoId={proyecto.id} />}
            {tabActiva === 'acciones' && <Acciones proyectoId={proyecto.id} proyectoNombre={proyecto.nombre} />}
            {tabActiva === 'analisis' && <AnalisisGeneral proyectoId={proyecto.id} />}
            {tabActiva === 'seguimiento' && (
                <Seguimiento proyectoId={proyecto.id} onIrATab={setTabActiva} />
            )}

        </div>



    );
}

export default ProyectoDetalle;