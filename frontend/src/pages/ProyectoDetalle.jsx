import { useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Layers, ArrowRightLeft, ChartNoAxesColumn, Bell, Wallet } from "lucide-react";
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
import CashFlowProyecto from "../components/proyectos/CashFlowProyecto";
import { Cargando } from "../components/shared/Cargando";
import { EstadoError } from "../components/shared/EstadoError";
import { Tabs } from "../components/shared/Tabs";
import { obtenerMensajeError } from "../utils/errorHandling";
import { calcularSeguimiento } from "../utils/seguimiento";
import "./ProyectoDetalle.css";

const TABS = [
  { key: "fases", label: "Fases del proyecto", icono: Layers },
  { key: "acciones", label: "Acciones", icono: ArrowRightLeft },
  { key: "analisis", label: "Análisis General", icono: ChartNoAxesColumn },
  { key: "seguimiento", label: "Seguimiento", icono: Bell },
  { key: "cashflow", label: "Cash flow", icono: Wallet },
];

function ProyectoDetalle() {
  const { id } = useParams();
  const { data: proyecto, error } = useProyecto(id);
  // `?tab=seguimiento` abre directo en esa tab: el Panel manda ahí desde
  // "Para resolver", que es donde se resuelve cada pendiente.
  const [searchParams] = useSearchParams();
  const [tabActiva, setTabActiva] = useState(() => {
    const pedida = searchParams.get("tab");
    return TABS.some((t) => t.key === pedida) ? pedida : "fases";
  });
  // `?foco=` dice CUÁL fila/movimiento se tocó en el Panel, para marcarlo acá
  // en vez de largar al usuario en una lista larga a buscarlo. Se lee una sola
  // vez: si después se cambia de tab a mano, la marca ya no corresponde.
  const [foco] = useState(() => searchParams.get("foco"));
  const focoDeTab = (tab) => (tabActiva === tab ? foco : null);

  // Las mismas queries que usan las tabs (React Query las dedupea): la tab de
  // Seguimiento necesita todo esto para su contador.
  const { data: fases } = useFasesPorProyecto(id);
  const { data: gastos } = useGastosPorProyecto(id);
  const { data: cobros } = useCobrosPorProyecto(id);
  const { data: compras } = useComprasPorProyecto(id);

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
      />

      <Tabs
        tabs={tabs}
        activa={tabActiva}
        onCambiar={setTabActiva}
        etiqueta="Secciones del proyecto"
      />

      {tabActiva === "fases" && <Fases proyectoId={proyecto.id} />}
      {tabActiva === "acciones" && (
        <Acciones
          proyectoId={proyecto.id}
          proyectoNombre={proyecto.nombre}
          foco={focoDeTab("acciones")}
        />
      )}
      {tabActiva === "analisis" && <AnalisisGeneral proyectoId={proyecto.id} />}
      {tabActiva === "seguimiento" && (
        <Seguimiento proyectoId={proyecto.id} foco={focoDeTab("seguimiento")} />
      )}
      {tabActiva === "cashflow" && <CashFlowProyecto proyectoId={proyecto.id} />}
    </div>
  );
}

export default ProyectoDetalle;
