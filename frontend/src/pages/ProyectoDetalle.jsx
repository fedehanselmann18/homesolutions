import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Layers, ArrowRightLeft, ChartNoAxesColumn, Bell } from "lucide-react";
import {
  useProyecto,
  useFasesPorProyecto,
  useGastosPorProyecto,
  useCobrosPorProyecto,
  useComprasPorProyecto,
} from "../hooks/queries";
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
import { calcularSeguimiento } from "../utils/seguimiento";
import { pluralizar } from "../utils/formato";
import "./ProyectoDetalle.css";

const TABS = [
  { key: "fases", label: "Fases del proyecto", icono: Layers },
  { key: "acciones", label: "Acciones", icono: ArrowRightLeft },
  { key: "analisis", label: "Análisis General", icono: ChartNoAxesColumn },
  { key: "seguimiento", label: "Seguimiento", icono: Bell },
];

const FASE_CERRADA = ["terminada", "auditada"];

/**
 * El tercer ítem de la meta del header: "Fase 3 de 4 · Montaje". La fase
 * actual es la primera en curso por orden. Sin ninguna en curso no se inventa
 * una "actual": se dice cuántas hay y en qué quedaron.
 */
function describirFaseActual(fases) {
  if (!fases?.length) return null;
  const ordenadas = [...fases].sort((a, b) => a.orden - b.orden);
  const total = ordenadas.length;
  const indice = ordenadas.findIndex((f) => f.estado === "en_curso");
  if (indice >= 0) return { numero: indice + 1, total, nombre: ordenadas[indice].nombre };
  if (ordenadas.every((f) => FASE_CERRADA.includes(f.estado))) {
    return { nombre: total === 1 ? "1 fase terminada" : `${total} fases terminadas` };
  }
  return { nombre: `${pluralizar(total, "fase")}, ninguna en curso` };
}

function ProyectoDetalle() {
  const { id } = useParams();
  const { data: proyecto, error } = useProyecto(id);
  const [tabActiva, setTabActiva] = useState("fases");

  // Las mismas queries que usan las tabs (React Query las dedupea): el header
  // necesita las fases para "Fase N de M" y la tab de Seguimiento su contador.
  const { data: fases } = useFasesPorProyecto(id);
  const { data: gastos } = useGastosPorProyecto(id);
  const { data: cobros } = useCobrosPorProyecto(id);
  const { data: compras } = useComprasPorProyecto(id);

  const faseActual = useMemo(() => describirFaseActual(fases), [fases]);

  // El contador sale de calcularSeguimiento, el mismo que pinta la tab: así
  // el número de afuera y la lista de adentro no pueden no coincidir. Hasta
  // que cargan los cuatro no hay número, para no mostrar uno parcial.
  const pendientes = useMemo(
    () =>
      fases && gastos && cobros && compras
        ? calcularSeguimiento({ proyecto, fases, gastos, cobros, compras }).pendientes
        : null,
    [proyecto, fases, gastos, cobros, compras]
  );

  const tabs = useMemo(
    () => TABS.map((t) => (t.key === "seguimiento" ? { ...t, badge: pendientes } : t)),
    [pendientes]
  );

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
        faseActual={faseActual}
      />

      <Tabs
        tabs={tabs}
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
