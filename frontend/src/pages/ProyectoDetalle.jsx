import { useState } from "react";
import { useParams } from "react-router-dom";
import { useProyecto } from "../hooks/queries";
import { usePageTitle } from "../hooks/usePageTitle";
import ProyectoDetalleHeader from "../components/proyectos/ProyectoDetalleHeader";
import Fases from "../components/proyectos/Fases";
import Acciones from "../components/proyectos/Acciones";
import AnalisisGeneral from "../components/proyectos/AnalisisGeneral";
import Seguimiento from "../components/proyectos/Seguimiento";
import { Cargando } from "../components/shared/Cargando";
import { EstadoError } from "../components/shared/EstadoError";
import { Tabs } from "../components/shared/Tabs";
import { obtenerMensajeError } from "../utils/errorHandling";
import "./ProyectoDetalle.css";

const TABS = [
  { key: "fases", label: "Fases del proyecto" },
  { key: "acciones", label: "Acciones" },
  { key: "analisis", label: "Análisis General" },
  { key: "seguimiento", label: "Seguimiento" },
];

function ProyectoDetalle() {
  const { id } = useParams();
  const { data: proyecto, error } = useProyecto(id);
  const [tabActiva, setTabActiva] = useState("fases");

  usePageTitle(proyecto?.nombre);

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
      <ProyectoDetalleHeader
        proyecto={proyecto}
        breadcrumb={[{ label: "Proyectos", to: "/proyectos" }, { label: proyecto.nombre }]}
      />

      <Tabs
        tabs={TABS}
        activa={tabActiva}
        onCambiar={setTabActiva}
        etiqueta="Secciones del proyecto"
      />

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
