import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";

import { getComprobanteCompra, getNotaCompra } from "../services/compraService";
import { getComprobanteGasto } from "../services/gastoService";

import useAuth from "../context/useAuth";
import { getEstadoLabel } from "../constants/estados";
import { diasDesde, esCompraImpaga } from "../utils/seguimiento";
import { formatMoneda, formatFecha } from "../utils/formato";
import { ROJO } from "../constants/colores";
import { useFaseDetalle } from "../hooks/useFaseDetalle";
import { usePageTitle } from "../hooks/usePageTitle";

import { TarjetaKpi } from "../components/shared/TarjetaKpi";
import ModalGasto from "../components/modals/ModalGasto";
import ModalCompra from "../components/modals/ModalCompra";
import ModalNota from "../components/modals/ModalNota";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import ModalDetalleGasto from "../components/modals/ModalDetalleGasto";
import ModalDetalleCompra from "../components/modals/ModalDetalleCompra";
import { Cargando } from "../components/shared/Cargando";
import { Tabs } from "../components/shared/Tabs";
import { EstadoError } from "../components/shared/EstadoError";
import { Breadcrumbs } from "../components/shared/Breadcrumbs";
import AccionesFase from "../components/fases/AccionesFase";
import SeguimientoFase from "../components/fases/SeguimientoFase";
import AnalisisFase from "../components/fases/AnalisisFase";

import "../components/proyectos/Seguimiento.css";
import "../components/proyectos/AnalisisGeneral.css";
import "./FaseDetalle.css";
import { TINTE_PASTILLA } from "../constants/tipoMovimiento";

const diasTexto = (dias) => `hace ${dias} ${dias === 1 ? "día" : "días"}`;

const TABS = [
  { key: "acciones", label: "Acciones de la fase" },
  { key: "seguimiento", label: "Seguimiento de la fase" },
  { key: "analisis", label: "Análisis de la fase" },
];

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
    guardarCompra,
    eliminarCompra,
    toggleEstadoPagoCompra,
    toggleEstadoEnvioCompra,
    agregarComprobantesCompra,
    eliminarComprobanteCompra,
    agregarComprobantesGasto,
    eliminarComprobanteGasto,
    guardarNota,
  } = useFaseDetalle(faseId);

  // proyecto llega por una query aparte, encadenada a la de fase (ver
  // useFaseDetalle) -- puede tardar un instante más, así que el título
  // arranca solo con el nombre de la fase y suma el proyecto cuando llega.
  usePageTitle(fase && (proyecto ? `${fase.nombre} · ${proyecto.nombre}` : fase.nombre));

  const [modalGastoAbierto, setModalGastoAbierto] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);
  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);

  const [modalNotaAbierto, setModalNotaAbierto] = useState(false);
  const [notaCompra, setNotaCompra] = useState(null); // la Compra sobre la que se carga la nota

  // Se guarda el id y no la entidad: togglear pago/envío desde el modal
  // recarga la colección del hook, y una copia congelada seguiría mostrando
  // el estado viejo.
  const [detalle, setDetalle] = useState(null); // { tipo: "gasto" | "compra", id }
  const cerrarDetalle = () => setDetalle(null);

  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // { tipo: "gasto" | "compra", id, nombre }
  const cerrarConfirmarEliminar = () => setConfirmarEliminar(null);

  const nombreProveedor = (proveedorId) => proveedores.find((p) => p.id === proveedorId)?.nombre;

  const entidadDetalle = detalle
    ? (detalle.tipo === "compra" ? comprasFase : gastosFase).find((e) => e.id === detalle.id)
    : null;

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
    return <EstadoError mensaje="No se pudo cargar el detalle de la fase." grande />;
  }

  const estadoInfo = getEstadoLabel(fase.estado);
  const IconoEstado = estadoInfo.icono;
  // Mismo criterio que las fases estancadas del Panel: solo tiene sentido
  // contar "días en curso" mientras la fase sigue en curso.
  // fecha_en_curso_desde (no fecha_actualizacion): ese campo se pisa con
  // cualquier edición de la fase, no solo al entrar en curso -- ver
  // comentario en el modelo Fase (backend).
  const diasEnCurso =
    fase.estado === "en_curso" && fase.fecha_en_curso_desde
      ? diasDesde(fase.fecha_en_curso_desde, new Date())
      : null;
  const puedeMarcarTerminada =
    canManage && fase.estado !== "terminada" && fase.estado !== "auditada";

  const comprasImpagasFase = comprasFase.filter(esCompraImpaga);
  const montoSinPagarFase = comprasImpagasFase.reduce((acc, c) => acc + c.precio_total, 0);

  return (
    <div className="fase-detalle">
      <Breadcrumbs
        items={[
          { label: "Proyectos", to: "/proyectos" },
          { label: proyecto.nombre, to: `/proyectos/${proyectoId}` },
          { label: `${fase.orden}. ${fase.nombre}` },
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
          <div className="fase-detalle-header-titulo">
            <span className="badge badge--neutro fase-detalle-numero">Fase {fase.orden}</span>
            <h1 className="fase-detalle-nombre">{fase.nombre}</h1>
            <span
              className="badge fase-detalle-estado"
              style={{
                color: estadoInfo.color,
                backgroundColor: `${estadoInfo.color}${TINTE_PASTILLA}`,
                borderColor: `${estadoInfo.color}55`,
              }}
            >
              {IconoEstado && (
                <IconoEstado size={13} strokeWidth={2.25} className="fase-detalle-estado-icono" />
              )}
              {estadoInfo.label}
            </span>
          </div>

          {canManage && (
            <div className="fase-detalle-header-acciones">
              {puedeMarcarTerminada && (
                <button
                  type="button"
                  className="fase-detalle-btn-terminar"
                  onClick={marcarTerminada}
                >
                  Marcar como terminada
                </button>
              )}
              <button type="button" className="btn btn-secondary" onClick={handleNuevoGasto}>
                + Gasto
              </button>
              <button type="button" className="btn btn-primary" onClick={handleNuevaCompra}>
                Nueva compra
              </button>
            </div>
          )}
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
        <TarjetaKpi
          titulo="Sin pagar"
          valor={formatMoneda(montoSinPagarFase)}
          detalle={
            comprasImpagasFase.length === 0
              ? "Todo al día"
              : `${comprasImpagasFase.length} ${comprasImpagasFase.length === 1 ? "compra" : "compras"}`
          }
          color={montoSinPagarFase > 0 ? ROJO : undefined}
          destacado
        />
      </div>

      <Tabs
        tabs={TABS}
        activa={tabActiva}
        onCambiar={setTabActiva}
        etiqueta="Secciones de la fase"
      />

      {tabActiva === "acciones" && (
        <AccionesFase
          faseNombre={fase.nombre}
          canManage={canManage}
          nombreProveedor={nombreProveedor}
          compras={comprasFase}
          onEditarCompra={handleEditarCompra}
          onEliminarCompra={handleSolicitarEliminarCompra}
          onTogglePagoCompra={handleToggleEstadoPagoCompra}
          onToggleEnvioCompra={handleToggleEstadoEnvioCompra}
          onVerComprobanteCompra={getComprobanteCompra}
          onAgregarNotaCompra={handleAgregarNotaCompra}
          onAbrirDetalleCompra={(c) => setDetalle({ tipo: "compra", id: c.id })}
          gastos={gastosFase}
          onEditarGasto={handleEditarGasto}
          onEliminarGasto={handleSolicitarEliminarGasto}
          onVerComprobanteGasto={getComprobanteGasto}
          onAbrirDetalleGasto={(g) => setDetalle({ tipo: "gasto", id: g.id })}
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
          onAgregarComprobanteCompra={agregarComprobantesCompra}
          onEliminarComprobanteCompra={eliminarComprobanteCompra}
          onAgregarComprobanteGasto={agregarComprobantesGasto}
          onEliminarComprobanteGasto={eliminarComprobanteGasto}
          onTogglePagoCompra={handleToggleEstadoPagoCompra}
          onToggleEnvioCompra={handleToggleEstadoEnvioCompra}
          onEditarCompra={handleEditarCompra}
          onEditarGasto={handleEditarGasto}
          canManage={canManage}
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

      {entidadDetalle && detalle.tipo === "gasto" && (
        <ModalDetalleGasto
          gasto={entidadDetalle}
          faseNombre={fase.nombre}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteGasto(entidadDetalle.id, c.id)}
        />
      )}

      {entidadDetalle && detalle.tipo === "compra" && (
        <ModalDetalleCompra
          compra={entidadDetalle}
          faseNombre={fase.nombre}
          proveedorNombre={nombreProveedor(entidadDetalle.proveedor_id)}
          productos={productos}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteCompra(entidadDetalle.id, c.id)}
          onVerNota={(n) => getNotaCompra(entidadDetalle.id, n.id)}
          onAgregarNota={canManage ? () => handleAgregarNotaCompra(entidadDetalle) : undefined}
          onTogglePago={() => handleToggleEstadoPagoCompra(entidadDetalle)}
          onToggleEnvio={() => handleToggleEstadoEnvioCompra(entidadDetalle)}
          onEditar={() => {
            cerrarDetalle();
            handleEditarCompra(entidadDetalle);
          }}
          canManage={canManage}
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
