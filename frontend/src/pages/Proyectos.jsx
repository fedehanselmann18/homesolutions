import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import {
  useProyectos,
  useFases,
  useGastos,
  useCobros,
  useCompras,
  useUltimaCotizacion,
} from "../hooks/queries";
import { crearProyecto, actualizarProyecto, eliminarProyecto } from "../services/proyectoService";
import { useMonedaAnalisis } from "../hooks/useMonedaAnalisis";
import { SelectorMoneda } from "../components/shared/SelectorMoneda";
import { calcularPanel } from "../utils/panel";
import { obtenerMensajeError } from "../utils/errorHandling";
import { bloqueadaPorCobros, contarParaBorrar, lineasDeBorrado } from "../utils/proyectos";
import { ProyectoCard } from "../components/proyectos/ProyectoCard";
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
// En "Todos" las cards se agrupan así y, dentro de cada estado, por el orden
// elegido.
const ORDEN_ESTADOS = ["en_curso", "a_iniciar", "terminado"];

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
  const queryClient = useQueryClient();

  // Mismas queries que el Panel y el detalle de cada obra (React Query las
  // comparte): disponible/presupuesto/fases por proyecto salen de
  // calcularPanel, para que los números nunca diverjan entre pantallas.
  const proyectosQuery = useProyectos();
  const proyectos = proyectosQuery.data;
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
    proyectosQuery.isLoading ||
    fasesQuery.isLoading ||
    gastosQuery.isLoading ||
    cobrosQuery.isLoading ||
    comprasQuery.isLoading;
  const errorCarga =
    proyectosQuery.error ||
    fasesQuery.error ||
    gastosQuery.error ||
    cobrosQuery.error ||
    comprasQuery.error;

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

  const proyectosOrdenados = [...proyectosBuscados].sort(
    (a, b) =>
      ORDEN_ESTADOS.indexOf(a.estado) - ORDEN_ESTADOS.indexOf(b.estado) ||
      COMPARADORES[ordenarPor](a, b)
  );

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
        await actualizarProyecto(proyectoSeleccionado.id, datosProyecto);
      } else {
        await crearProyecto(datosProyecto);
      }
      // Se espera el refetch: al cerrarse el modal la lista ya está al día.
      await queryClient.invalidateQueries({ queryKey: ["proyectos"] });
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
      await eliminarProyecto(proyecto.id);
      // El backend borra en cascada sus fases, compras, gastos y cobros: que
      // el Panel, los totales y el próximo aviso de borrado no sigan
      // contándolos.
      await Promise.all(
        ["proyectos", "fases", "gastos", "cobros", "compras"].map((recurso) =>
          queryClient.invalidateQueries({ queryKey: [recurso] })
        )
      );
    } catch (err) {
      console.error("Error eliminando proyecto:", err);
      // El backend explica por qué (ej. 409 por cobros): repetir un genérico
      // dejaría a Agus sin saber qué hacer.
      toast.error(obtenerMensajeError(err));
    }
  };

  const canManage = usuario.rol === "admin";

  /**
   * El aviso de borrado. Dos caras:
   * - con cobros, no se borra: un aviso con un solo botón, que dice cuántos
   *   hay. El bloqueo real es el 409 del backend (api/projects.py); esto evita
   *   ofrecer un botón que va a fallar.
   * - sin cobros, la confirmación de siempre, listando lo que se va con la
   *   obra.
   */
  function ModalBorrarProyecto() {
    const conteos = contarParaBorrar({
      proyectoId: proyectoAEliminar.id,
      fases: fasesQuery.data,
      gastos: gastosQuery.data,
      compras: comprasQuery.data,
      cobros: cobrosQuery.data,
    });
    const cerrar = () => setProyectoAEliminar(null);

    if (bloqueadaPorCobros(conteos)) {
      const cobros = `${conteos.cobros} ${conteos.cobros === 1 ? "cobro" : "cobros"}`;
      return (
        <ModalConfirmar
          titulo="No se puede borrar la obra"
          mensaje={`Tiene ${cobros} cargados: la plata que entró no se borra junto con la obra. Borralos desde la obra y volvé a intentar.`}
          nombreRecurso={proyectoAEliminar.nombre}
          onCancelar={cerrar}
        />
      );
    }

    return (
      <ModalConfirmar
        titulo="Eliminar proyecto"
        mensaje="Se borra la obra con todo lo que tiene cargado. Esta acción no se puede deshacer."
        nombreRecurso={proyectoAEliminar.nombre}
        detalles={lineasDeBorrado(conteos)}
        onConfirmar={handleConfirmarEliminar}
        onCancelar={cerrar}
      />
    );
  }

  const renderAcciones = (proyecto) =>
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
          <Pencil aria-hidden="true" />
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
          <Trash2 aria-hidden="true" />
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

            <div className="proyectos-toolbar__derecha">
              <SelectorMoneda />

              <label className="proyectos-orden">
                <span className="label-campo">Ordenar por</span>
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
          </div>

          {proyectosVisibles.length === 0 ? (
            <EstadoVacio mensaje="No se encontraron proyectos con ese criterio." />
          ) : (
            <div className="proyectos-grilla">
              {proyectosVisibles.map((proyecto) => (
                <ProyectoCard
                  key={proyecto.id}
                  proyecto={proyecto}
                  onAbrir={() => navigate(`/proyectos/${proyecto.id}`)}
                  acciones={renderAcciones(proyecto)}
                />
              ))}
            </div>
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

      {proyectoAEliminar && <ModalBorrarProyecto />}
    </div>
  );
}

export default Proyectos;
