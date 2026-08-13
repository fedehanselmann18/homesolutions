import { useState } from "react";
import { useParams } from "react-router-dom";
import { useProyecto } from "../hooks/queries";
import ProyectoDetalleHeader from "../components/proyectos/ProyectoDetalleHeader";
import Fases from "../components/proyectos/Fases";
import Acciones from "../components/proyectos/Acciones";
import AnalisisGeneral from "../components/proyectos/AnalisisGeneral";
import Seguimiento from "../components/proyectos/Seguimiento";
import { Cargando } from "../components/shared/Cargando";
import { EstadoError } from "../components/shared/EstadoError";
import { Breadcrumbs } from "../components/shared/Breadcrumbs";
import { obtenerMensajeError } from "../utils/errorHandling";
import "./ProyectoDetalle.css";

function ProyectoDetalle() {
  const { id } = useParams();
  const { data: proyecto, error } = useProyecto(id);
  const [tabActiva, setTabActiva] = useState("fases");

  if (error) {
    return (
      <div className="proyecto-detalle-error">
        <EstadoError mensaje={obtenerMensajeError(error)} grande />
      </div>
    );
  }

  if (!proyecto) {
    return <Cargando texto="Cargando proyecto..." />;
  }

  return (
    <div className="proyecto-detalle">
      <Breadcrumbs items={[{ label: "Proyectos", to: "/proyectos" }, { label: proyecto.nombre }]} />

      <ProyectoDetalleHeader proyecto={proyecto} />

      <div className="tabs">
        <button
          className={tabActiva === "fases" ? "active" : ""}
          onClick={() => setTabActiva("fases")}
        >
          Fases del proyecto
        </button>
        <button
          className={tabActiva === "acciones" ? "active" : ""}
          onClick={() => setTabActiva("acciones")}
        >
          Acciones
        </button>
        <button
          className={tabActiva === "analisis" ? "active" : ""}
          onClick={() => setTabActiva("analisis")}
        >
          Análisis General
        </button>
        <button
          className={tabActiva === "seguimiento" ? "active" : ""}
          onClick={() => setTabActiva("seguimiento")}
        >
          Seguimiento
        </button>
      </div>

      {tabActiva === "fases" && <Fases proyectoId={proyecto.id} />}
      {tabActiva === "acciones" && (
        <Acciones proyectoId={proyecto.id} proyectoNombre={proyecto.nombre} />
      )}
      {tabActiva === "analisis" && <AnalisisGeneral proyectoId={proyecto.id} />}
      {tabActiva === "seguimiento" && (
        <Seguimiento proyectoId={proyecto.id} onIrATab={setTabActiva} />
      )}
    </div>
  );
}

export default ProyectoDetalle;
