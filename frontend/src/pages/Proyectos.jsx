import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { useProyectos } from "../hooks/useProyectos";
import { useFases, useGastos, useCobros, useCompras, useUltimaCotizacion } from "../hooks/queries";
import { useMonedaAnalisis } from "../hooks/useMonedaAnalisis";
import { SelectorMoneda } from "../components/shared/SelectorMoneda";
import { calcularPanel } from "../utils/panel";
import { TablaProyectos, FilaProyecto } from "../components/proyectos/TablaProyectos";
import ModalProyecto from "../components/modals/ModalProyecto";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import useAuth from "../context/useAuth";
import ProyectosHeader from "../components/proyectos/ProyectoHeader";
import { Cargando } from "../components/shared/Cargando";
import { useToast } from "../context/useToast";
import { usePageTitle } from "../hooks/usePageTitle";
import "./Proyectos.css";
import { FiltrosSegmentados } from "../components/shared/FiltrosSegmentados";
import { EstadoVacio } from "../components/shared/EstadoVacio";
import { EstadoError } from "../components/shared/EstadoError";

// Orden fijo pedido: en curso primero, después a iniciar, después terminados.
const ORDEN_SECCIONES = ["en_curso", "a_iniciar", "terminado"];

const ETIQUETAS_GRUPO = {
  en_curso: "En curso",
  a_iniciar: "A iniciar",
  terminado: "Terminados",
};

const FILTROS = [
  { key: "todos", label: "Todos" },
  { key: "en_curso", label: "En curso" },
  { key: "a_iniciar", label: "A iniciar" },
  { key: "terminado", label: "Terminados" },
];

const COMPARADORES = {
  disponible: (a, b) => b.disponible - a.disponible,
  nombre: (a, b) => a.nombre.localeCompare(b.nombre, "es"),
  presupuesto: (a, b) => b.pctPresupuesto - a.pctPresupuesto,
};

const normalizar = (valor) => (valor ?? "").toString().toLowerCase();

export function Proyectos() {
  usePageTitle("Proyectos");
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const toast = useToast();

  const { proyectos, loading, error, agregarProyecto, editarProyecto, borrarProyecto } =
    useProyectos();

  // El listado en sí viene del hook de arriba (con sus altas/bajas/ediciones
  // locales); disponible/presupuesto/fases por proyecto necesitan además
  // fases/gastos/cobros/compras completos -- mismo cálculo que el Panel
  // (calcularPanel), para que los números nunca diverjan entre pantallas.
  const fasesQuery = useFases();
  const gastosQuery = useGastos();
  const cobrosQuery = useCobros();
  const comprasQuery = useCompras();
  // Misma moneda que el Panel y los análisis (elección global); el precio
  // acordado en pesos sale de la última cotización cargada.
  const [moneda] = useMonedaAnalisis();
  const cotizacionActual = useUltimaCotizacion().data ?? null;

  const [modalAbierto, setModalAbierto] = useState(false);
  const [proyectoSeleccionado, setProyectoSeleccionado] = useState(null);
  const [proyectoAEliminar, setProyectoAEliminar] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [ordenarPor, setOrdenarPor] = useState("disponible");

  const cargando =
    loading ||
    fasesQuery.isLoading ||
    gastosQuery.isLoading ||
    cobrosQuery.isLoading ||
    comprasQuery.isLoading;
  const errorCarga =
    error || fasesQuery.error || gastosQuery.error || cobrosQuery.error || comprasQuery.error;

  const panel = useMemo(() => {
    if (cargando || errorCarga) return null;
    return calcularPanel({
      proyectos,
      fases: fasesQuery.data,
      gastos: gastosQuery.data,
      cobros: cobrosQuery.data,
      compras: comprasQuery.data,
      moneda,
      cotizacionActual,
    });
  }, [
    cargando,
    errorCarga,
    moneda,
    cotizacionActual,
    proyectos,
    fasesQuery.data,
    gastosQuery.data,
    cobrosQuery.data,
    comprasQuery.data,
  ]);

  if (cargando) {
    return <Cargando texto="Cargando proyectos..." />;
  }

  if (errorCarga) {
    return <EstadoError mensaje="Error al cargar los proyectos." grande />;
  }

  const proyectosResumen = panel.proyectosResumen;

  const contadores = {
    todos: proyectosResumen.length,
    en_curso: proyectosResumen.filter((p) => p.estado === "en_curso").length,
    a_iniciar: proyectosResumen.filter((p) => p.estado === "a_iniciar").length,
    terminado: proyectosResumen.filter((p) => p.estado === "terminado").length,
  };

  const termino = normalizar(busqueda.trim());
  const proyectosBuscados = termino
    ? proyectosResumen.filter(
        (p) => normalizar(p.nombre).includes(termino) || normalizar(p.direccion).includes(termino)
      )
    : proyectosResumen;

  const proyectosOrdenados = [...proyectosBuscados].sort(COMPARADORES[ordenarPor]);

  const proyectosVisibles =
    filtroEstado === "todos"
      ? proyectosOrdenados
      : proyectosOrdenados.filter((p) => p.estado === filtroEstado);

  const abrirModalCrear = () => {
    setProyectoSeleccionado(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (proyectoId) => {
    setProyectoSeleccionado(proyectos.find((p) => p.id === proyectoId) ?? null);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setProyectoSeleccionado(null);
  };

  const handleGuardar = async (datosProyecto) => {
    try {
      if (proyectoSeleccionado) {
        await editarProyecto(proyectoSeleccionado.id, datosProyecto);
      } else {
        await agregarProyecto(datosProyecto);
      }
      cerrarModal();
    } catch (err) {
      console.error("Error guardando proyecto:", err);
      toast.error("No se pudo guardar el proyecto.");
    }
  };

  const handleSolicitarEliminar = (proyecto) => {
    setProyectoAEliminar(proyecto);
  };

  const handleConfirmarEliminar = async () => {
    const proyecto = proyectoAEliminar;
    setProyectoAEliminar(null);
    try {
      await borrarProyecto(proyecto.id);
    } catch (err) {
      console.error("Error eliminando proyecto:", err);
      toast.error("No se pudo eliminar el proyecto.");
    }
  };

  const canManage = usuario.rol === "admin";

  const renderAccionesFila = (proyecto) =>
    canManage && (
      <>
        <button
          type="button"
          className="btn-icono btn-icono--sm"
          title="Editar"
          aria-label={`Editar ${proyecto.nombre}`}
          onClick={(e) => {
            e.stopPropagation();
            abrirModalEditar(proyecto.id);
          }}
        >
          <Pencil size={14} strokeWidth={2} />
        </button>
        <button
          type="button"
          className="btn-icono btn-icono--sm btn-icono--peligro"
          title="Eliminar"
          aria-label={`Eliminar ${proyecto.nombre}`}
          onClick={(e) => {
            e.stopPropagation();
            handleSolicitarEliminar(proyecto);
          }}
        >
          <Trash2 size={14} strokeWidth={2} />
        </button>
      </>
    );

  return (
    <div className="proyectos-container">
      <ProyectosHeader
        canManage={canManage}
        onCrearProyecto={abrirModalCrear}
        cantidad={proyectos.length}
        busqueda={busqueda}
        onBuscarChange={setBusqueda}
      />

      {proyectos.length === 0 ? (
        <EstadoVacio mensaje="No hay proyectos todavía. ¡Creá el primero!" grande />
      ) : (
        <>
          <div className="proyectos-toolbar">
            <FiltrosSegmentados
              opciones={FILTROS}
              activa={filtroEstado}
              contadores={contadores}
              etiqueta="Filtrar proyectos por estado"
              onCambiar={setFiltroEstado}
            />

            <SelectorMoneda />

            <label className="proyectos-orden">
              <span className="label-ficha">Ordenar por</span>
              <select
                className="campo campo--sm proyectos-orden__select"
                value={ordenarPor}
                onChange={(e) => setOrdenarPor(e.target.value)}
              >
                <option value="disponible">Disponible</option>
                <option value="nombre">Nombre</option>
                <option value="presupuesto">Presupuesto ejecutado</option>
              </select>
            </label>
          </div>

          {proyectosVisibles.length === 0 ? (
            <EstadoVacio mensaje="No se encontraron proyectos con ese criterio." />
          ) : filtroEstado === "todos" ? (
            <div className="planilla panel-tabla panel-tabla--acciones">
              <div className="planilla__header panel-tabla-header">
                <span className="label-ficha">Proyecto</span>
                <span className="label-ficha">Disponible</span>
                <span className="label-ficha">Presupuesto ejecutado</span>
                <span className="label-ficha">Fases</span>
                <span className="label-ficha">Pendientes</span>
                <span />
              </div>
              {ORDEN_SECCIONES.map((estadoKey) => {
                const grupo = proyectosVisibles.filter((p) => p.estado === estadoKey);
                if (grupo.length === 0) return null;
                return (
                  <Fragment key={estadoKey}>
                    <div className={`panel-tabla-grupo panel-tabla-grupo--${estadoKey}`}>
                      <span className="panel-tabla-grupo-punto" />
                      <span className="panel-tabla-grupo-label">{ETIQUETAS_GRUPO[estadoKey]}</span>
                      <span className="panel-tabla-grupo-contador">{grupo.length}</span>
                    </div>
                    {grupo.map((proyecto) => (
                      <FilaProyecto
                        key={proyecto.id}
                        proyecto={proyecto}
                        onClick={() => navigate(`/proyectos/${proyecto.id}`)}
                        renderAcciones={renderAccionesFila}
                      />
                    ))}
                  </Fragment>
                );
              })}
            </div>
          ) : (
            <TablaProyectos
              proyectos={proyectosVisibles}
              onFilaClick={(proyecto) => navigate(`/proyectos/${proyecto.id}`)}
              renderAcciones={renderAccionesFila}
            />
          )}
        </>
      )}

      {modalAbierto && (
        <ModalProyecto
          proyecto={proyectoSeleccionado}
          onGuardar={handleGuardar}
          onCerrar={cerrarModal}
        />
      )}

      {proyectoAEliminar && (
        <ModalConfirmar
          titulo="Eliminar proyecto"
          mensaje="Esta acción no se puede deshacer."
          nombreRecurso={proyectoAEliminar.nombre}
          onConfirmar={handleConfirmarEliminar}
          onCancelar={() => setProyectoAEliminar(null)}
        />
      )}
    </div>
  );
}

export default Proyectos;
