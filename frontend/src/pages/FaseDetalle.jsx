import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";

import { getComprobanteCompra, getNotaCompra } from "../services/compraService";
import { getComprobanteGasto } from "../services/gastoService";

import useAuth from "../context/useAuth";
import { getEstadoLabel } from "../constants/estados";
import { diasDesde } from "../utils/seguimiento";
import { FILTROS_VACIOS, filtrarCompras, filtrarGastos } from "../utils/filtros";
import { formatMoneda, formatFecha } from "../utils/formato";
import { ROJO } from "../constants/colores";
import { useFaseDetalle } from "../hooks/useFaseDetalle";

import { TarjetaKpi } from "../components/shared/TarjetaKpi";
import ModalGasto from "../components/modals/ModalGasto";
import ModalCompra from "../components/modals/ModalCompra";
import ModalNota from "../components/modals/ModalNota";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import ModalDetalleGasto from "../components/modals/ModalDetalleGasto";
import ModalDetalleCompra from "../components/modals/ModalDetalleCompra";
import { Cargando } from "../components/shared/Cargando";
import { Breadcrumbs } from "../components/shared/Breadcrumbs";
import AccionesFase from "../components/fases/AccionesFase";
import SeguimientoFase from "../components/fases/SeguimientoFase";
import AnalisisFase from "../components/fases/AnalisisFase";

import "../components/proyectos/Acciones.css";
import "../components/proyectos/Seguimiento.css";
import "../components/proyectos/AnalisisGeneral.css";
import "./FaseDetalle.css";

const diasTexto = (dias) => `hace ${dias} ${dias === 1 ? "día" : "días"}`;

export function FaseDetalle() {
  const { proyectoId, faseId } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";

  const [tabActiva, setTabActiva] = useState("acciones");

  const {
    fase,
    proyecto,
    gastosFase,
    comprasFase,
    cobrosProyecto,
    proveedores,
    productos,
    categoriasGasto,
    impuestos,
    kpis,
    cargando,
    error,
    marcarTerminada,
    guardarGasto,
    eliminarGasto,
    agregarComprobantesGasto,
    eliminarComprobanteGasto,
    guardarCompra,
    eliminarCompra,
    toggleEstadoPagoCompra,
    toggleEstadoEnvioCompra,
    agregarComprobantesCompra,
    eliminarComprobanteCompra,
    guardarNota,
    eliminarNotaCompra,
  } = useFaseDetalle(faseId);

  const [modalGastoAbierto, setModalGastoAbierto] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);

  const [modalNotaAbierto, setModalNotaAbierto] = useState(false);
  const [notaCompra, setNotaCompra] = useState(null); // la Compra sobre la que se carga la nota

  const [detalle, setDetalle] = useState(null); // { tipo: "gasto" | "compra", entidad }
  const cerrarDetalle = () => setDetalle(null);

  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // { tipo: "gasto" | "compra", id, nombre }
  const cerrarConfirmarEliminar = () => setConfirmarEliminar(null);

  const [filtrosGastos, setFiltrosGastos] = useState(FILTROS_VACIOS);
  const [filtrosCompras, setFiltrosCompras] = useState(FILTROS_VACIOS);

  const gastosFaseFiltrados = useMemo(
    () => filtrarGastos(gastosFase, filtrosGastos),
    [gastosFase, filtrosGastos]
  );
  const comprasFaseFiltradas = useMemo(
    () => filtrarCompras(comprasFase, filtrosCompras),
    [comprasFase, filtrosCompras]
  );

  const nombreProveedor = (proveedorId) => proveedores.find((p) => p.id === proveedorId)?.nombre;

  // --- Gastos ---
  const handleNuevoGasto = () => {
    setGastoEditando(null);
    setModalGastoAbierto(true);
  };

  const handleEditarGasto = (gasto) => {
    setGastoEditando(gasto);
    setModalGastoAbierto(true);
  };

  const handleGuardarGasto = async (datosForm, comprobantesCambios) => {
    try {
      await guardarGasto(gastoEditando, datosForm, comprobantesCambios);
      setModalGastoAbierto(false);
      setGastoEditando(null);
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  const handleSolicitarEliminarGasto = (gastoId) => {
    const gasto = gastosFase.find((g) => g.id === gastoId);
    setConfirmarEliminar({ tipo: "gasto", id: gastoId, nombre: gasto?.descripcion });
  };

  const handleEliminarGasto = async (gastoId) => {
    try {
      await eliminarGasto(gastoId);
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  // --- Compras ---
  const handleNuevaCompra = () => {
    setCompraEditando(null);
    setModalCompraAbierto(true);
  };

  const handleEditarCompra = (compra) => {
    setCompraEditando(compra);
    setModalCompraAbierto(true);
  };

  const handleGuardarCompra = async (datosForm, comprobantesCambios) => {
    try {
      await guardarCompra(compraEditando, datosForm, comprobantesCambios);
      setModalCompraAbierto(false);
      setCompraEditando(null);
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  const handleSolicitarEliminarCompra = (compraId) => {
    const compra = comprasFase.find((c) => c.id === compraId);
    setConfirmarEliminar({
      tipo: "compra",
      id: compraId,
      nombre: compra
        ? `${nombreProveedor(compra.proveedor_id) ?? "Compra"} - ${formatFecha(compra.fecha)}`
        : undefined,
    });
  };

  const handleEliminarCompra = async (compraId) => {
    try {
      await eliminarCompra(compraId);
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  const handleToggleEstadoPagoCompra = async (compra) => {
    try {
      await toggleEstadoPagoCompra(compra);
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  const handleToggleEstadoEnvioCompra = async (compra) => {
    try {
      await toggleEstadoEnvioCompra(compra);
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  // --- Notas (cuenta corriente: nota de crédito / débito) ---
  const handleAgregarNotaCompra = (compra) => {
    setNotaCompra(compra);
    setModalNotaAbierto(true);
  };

  const handleGuardarNota = async (payload) => {
    await guardarNota(notaCompra, payload);
    setModalNotaAbierto(false);
    setNotaCompra(null);
  };

  // --- Confirmación de borrado (compra/gasto) ---
  const handleConfirmarEliminar = async () => {
    const { tipo, id } = confirmarEliminar;
    cerrarConfirmarEliminar();
    if (tipo === "gasto") await handleEliminarGasto(id);
    else if (tipo === "compra") await handleEliminarCompra(id);
  };

  if (cargando) return <Cargando texto="Cargando fase..." />;
  if (error || !fase || !proyecto) {
    return <div className="fase-detalle-vacio">No se pudo cargar el detalle de la fase.</div>;
  }

  const estadoInfo = getEstadoLabel(fase.estado);
  const IconoEstado = estadoInfo.icono;
  // Mismo criterio que las fases estancadas del Panel: solo tiene sentido
  // contar "días en curso" mientras la fase sigue en curso.
  const diasEnCurso =
    fase.estado === "en_curso" ? diasDesde(fase.fecha_actualizacion, new Date()) : null;
  const puedeMarcarTerminada =
    canManage && fase.estado !== "terminada" && fase.estado !== "auditada";

  return (
    <div className="fase-detalle">
      <Breadcrumbs
        items={[
          { label: "Proyectos", to: "/proyectos" },
          { label: proyecto.nombre, to: `/proyectos/${proyectoId}` },
          { label: fase.nombre },
        ]}
      />

      <button
        type="button"
        className="fase-detalle-volver"
        onClick={() => navigate(`/proyectos/${proyectoId}`)}
      >
        <ArrowLeft size={16} strokeWidth={2} />
        Volver al proyecto
      </button>

      <div className="fase-detalle-header" style={{ borderLeftColor: estadoInfo.color }}>
        <div className="fase-detalle-header-top">
          <h1 className="fase-detalle-nombre">{fase.nombre}</h1>
          <span
            className="fase-detalle-estado"
            style={{
              color: estadoInfo.color,
              backgroundColor: `${estadoInfo.color}1c`,
              borderColor: `${estadoInfo.color}55`,
            }}
          >
            {IconoEstado && (
              <IconoEstado size={13} strokeWidth={2.25} className="fase-detalle-estado-icono" />
            )}
            {estadoInfo.label}
          </span>
        </div>

        {fase.descripcion && <p className="fase-detalle-descripcion">{fase.descripcion}</p>}

        <div className="fase-detalle-datos">
          {fase.fecha_inicio && (
            <span className="fase-detalle-dato">
              <CalendarDays size={16} strokeWidth={2} />
              Inicio: {formatFecha(fase.fecha_inicio)}
            </span>
          )}
          {diasEnCurso !== null && (
            <span className="fase-detalle-dato">
              <Clock size={16} strokeWidth={2} />
              En curso {diasTexto(diasEnCurso)}
            </span>
          )}
        </div>

        {puedeMarcarTerminada && (
          <button type="button" className="fase-detalle-btn-terminar" onClick={marcarTerminada}>
            Marcar como terminada
          </button>
        )}
      </div>

      <div className="analisis-kpis">
        <TarjetaKpi
          titulo="Gastado en esta fase"
          valor={formatMoneda(kpis.gastadoFase)}
          destacado
        />
        <TarjetaKpi
          titulo="% del presupuesto del proyecto"
          valor={`${kpis.pctPresupuesto.toFixed(1)}%`}
          porcentaje={kpis.pctPresupuesto}
          detalle={`${formatMoneda(proyecto.precio_acordado)} acordados`}
          color={kpis.pctPresupuesto > 100 ? ROJO : undefined}
        />
        <TarjetaKpi
          titulo="% del gasto total del proyecto"
          valor={`${kpis.pctGastoTotal.toFixed(1)}%`}
          porcentaje={kpis.pctGastoTotal}
          detalle="Comparado con las demás fases"
        />
      </div>

      <div className="fase-detalle-tabs">
        <button
          type="button"
          className={tabActiva === "acciones" ? "active" : ""}
          onClick={() => setTabActiva("acciones")}
        >
          Acciones de la fase
        </button>
        <button
          type="button"
          className={tabActiva === "seguimiento" ? "active" : ""}
          onClick={() => setTabActiva("seguimiento")}
        >
          Seguimiento de la fase
        </button>
        <button
          type="button"
          className={tabActiva === "analisis" ? "active" : ""}
          onClick={() => setTabActiva("analisis")}
        >
          Análisis de la fase
        </button>
      </div>

      {tabActiva === "acciones" && (
        <AccionesFase
          canManage={canManage}
          faseNombre={fase.nombre}
          nombreProveedor={nombreProveedor}
          productos={productos}
          compras={comprasFase}
          comprasFiltradas={comprasFaseFiltradas}
          filtrosCompras={filtrosCompras}
          onCambiarFiltrosCompras={setFiltrosCompras}
          onNuevaCompra={handleNuevaCompra}
          onEditarCompra={handleEditarCompra}
          onEliminarCompra={handleSolicitarEliminarCompra}
          onTogglePagoCompra={handleToggleEstadoPagoCompra}
          onToggleEnvioCompra={handleToggleEstadoEnvioCompra}
          onVerComprobanteCompra={getComprobanteCompra}
          onAgregarComprobanteCompra={agregarComprobantesCompra}
          onEliminarComprobanteCompra={eliminarComprobanteCompra}
          onAgregarNotaCompra={handleAgregarNotaCompra}
          onVerNotaCompra={getNotaCompra}
          onEliminarNotaCompra={eliminarNotaCompra}
          onAbrirDetalleCompra={(c) => setDetalle({ tipo: "compra", entidad: c })}
          gastos={gastosFase}
          gastosFiltrados={gastosFaseFiltrados}
          filtrosGastos={filtrosGastos}
          onCambiarFiltrosGastos={setFiltrosGastos}
          onNuevoGasto={handleNuevoGasto}
          onEditarGasto={handleEditarGasto}
          onEliminarGasto={handleSolicitarEliminarGasto}
          onVerComprobanteGasto={getComprobanteGasto}
          onAgregarComprobanteGasto={agregarComprobantesGasto}
          onEliminarComprobanteGasto={eliminarComprobanteGasto}
          onAbrirDetalleGasto={(g) => setDetalle({ tipo: "gasto", entidad: g })}
        />
      )}

      {tabActiva === "seguimiento" && (
        <SeguimientoFase
          faseNombre={fase.nombre}
          comprasFase={comprasFase}
          gastosFase={gastosFase}
          productos={productos}
          proveedores={proveedores}
          onVerComprobanteCompra={getComprobanteCompra}
          onVerNotaCompra={getNotaCompra}
          onVerComprobanteGasto={getComprobanteGasto}
        />
      )}

      {tabActiva === "analisis" && (
        <AnalisisFase
          proyecto={proyecto}
          gastosFase={gastosFase}
          comprasFase={comprasFase}
          productos={productos}
          proveedores={proveedores}
          cobrosProyecto={cobrosProyecto}
          kpisFase={kpis}
        />
      )}

      {modalGastoAbierto && (
        <ModalGasto
          gasto={gastoEditando}
          categoriasDisponibles={categoriasGasto}
          faseFija={fase}
          onGuardar={handleGuardarGasto}
          onCerrar={() => setModalGastoAbierto(false)}
          onVerComprobante={
            gastoEditando ? (c) => getComprobanteGasto(gastoEditando.id, c.id) : undefined
          }
        />
      )}

      {modalCompraAbierto && (
        <ModalCompra
          compra={compraEditando}
          faseFija={fase}
          proveedores={proveedores}
          productosDisponibles={productos}
          impuestosDisponibles={impuestos}
          onGuardar={handleGuardarCompra}
          onCerrar={() => setModalCompraAbierto(false)}
          onVerComprobante={
            compraEditando ? (c) => getComprobanteCompra(compraEditando.id, c.id) : undefined
          }
        />
      )}

      {modalNotaAbierto && (
        <ModalNota
          contexto="compra"
          entidad={notaCompra}
          productos={productos}
          impuestosDisponibles={impuestos}
          onGuardar={handleGuardarNota}
          onCerrar={() => setModalNotaAbierto(false)}
        />
      )}

      {detalle?.tipo === "gasto" && (
        <ModalDetalleGasto
          gasto={detalle.entidad}
          faseNombre={fase.nombre}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteGasto(detalle.entidad.id, c.id)}
        />
      )}

      {detalle?.tipo === "compra" && (
        <ModalDetalleCompra
          compra={detalle.entidad}
          faseNombre={fase.nombre}
          proveedorNombre={nombreProveedor(detalle.entidad.proveedor_id)}
          productos={productos}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteCompra(detalle.entidad.id, c.id)}
          onVerNota={(n) => getNotaCompra(detalle.entidad.id, n.id)}
        />
      )}

      {confirmarEliminar && (
        <ModalConfirmar
          titulo={`Eliminar ${confirmarEliminar.tipo}`}
          mensaje="Esta acción no se puede deshacer."
          nombreRecurso={confirmarEliminar.nombre}
          onConfirmar={handleConfirmarEliminar}
          onCancelar={cerrarConfirmarEliminar}
        />
      )}
    </div>
  );
}

export default FaseDetalle;
