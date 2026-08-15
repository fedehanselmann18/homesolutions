import { Fragment, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Pencil, Trash2 } from "lucide-react";
import { useProyectos } from "../hooks/useProyectos";
import { useFases, useGastos, useCobros, useCompras } from "../hooks/queries";
import { calcularPanel } from "../utils/panel";
import { TablaProyectos, FilaProyecto } from "../components/proyectos/TablaProyectos";
import ModalProyecto from "../components/modals/ModalProyecto";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import useAuth from "../context/useAuth";
import ProyectosHeader from "../components/proyectos/ProyectoHeader";
import { Cargando } from "../components/shared/Cargando";
import { useToast } from "../context/useToast";
import "./Proyectos.css";

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
  const errorCarga = error || fasesQuery.error || gastosQuery.error || cobrosQuery.error || comprasQuery.error;

  const panel = useMemo(() => {
    if (cargando || errorCarga) return null;
    return calcularPanel({
      proyectos,
      fases: fasesQuery.data,
      gastos: gastosQuery.data,
      cobros: cobrosQuery.data,
      compras: comprasQuery.data,
    });
  }, [cargando, errorCarga, proyectos, fasesQuery.data, gastosQuery.data, cobrosQuery.data, comprasQuery.data]);

  if (cargando) {
    return <Cargando texto="Cargando proyectos..." />;
  }

  if (errorCarga) {
    return <p className="proyectos-feedback">Error al cargar los proyectos.</p>;
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
          className="panel-tabla-accion-btn"
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
          className="panel-tabla-accion-btn panel-tabla-accion-btn--eliminar"
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
        <p className="proyectos-feedback">No hay proyectos todavía. ¡Creá el primero!</p>
      ) : (
        <>
          <div className="proyectos-toolbar">
            <div className="panel-filtro-estado" role="tablist" aria-label="Filtrar proyectos por estado">
              {FILTROS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  role="tab"
                  aria-selected={f.key === filtroEstado}
                  className={
                    f.key === filtroEstado
                      ? "panel-filtro-estado-btn panel-filtro-estado-btn--activo"
                      : "panel-filtro-estado-btn"
                  }
                  onClick={() => setFiltroEstado(f.key)}
                >
                  {f.label} <span className="panel-filtro-estado-contador">{contadores[f.key]}</span>
                </button>
              ))}
            </div>

            <label className="proyectos-orden">
              <span className="label-ficha">Ordenar por</span>
              <select value={ordenarPor} onChange={(e) => setOrdenarPor(e.target.value)}>
                <option value="disponible">Disponible</option>
                <option value="nombre">Nombre</option>
                <option value="presupuesto">Presupuesto ejecutado</option>
              </select>
            </label>
          </div>

          {proyectosVisibles.length === 0 ? (
            <p className="proyectos-feedback">No se encontraron proyectos con ese criterio.</p>
          ) : filtroEstado === "todos" ? (
            <div className="panel-tabla panel-tabla--acciones">
              <div className="panel-tabla-header">
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
