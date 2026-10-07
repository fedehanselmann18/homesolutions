import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRightLeft,
  Bell,
  CalendarDays,
  ChartNoAxesColumn,
  Check,
  Clock,
  Plus,
} from "lucide-react";

import { getComprobanteCompra, getNotaCompra } from "../services/compraService";
import { getComprobanteGasto } from "../services/gastoService";

import useAuth from "../context/useAuth";
import { getEstadoLabel } from "../constants/estados";
import { diasDesde, esCompraImpaga } from "../utils/seguimiento";
import { formatFecha } from "../utils/formato";
import { etapaDeFase } from "../utils/fases";
import { useFaseDetalle } from "../hooks/useFaseDetalle";
import { precioTotalCompra } from "../utils/moneda";
import { usePageTitle } from "../hooks/usePageTitle";

import ModalGasto from "../components/modals/ModalGasto";
import ModalCompra from "../components/modals/ModalCompra";
import ModalNota from "../components/modals/ModalNota";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import ModalDetalleGasto from "../components/modals/ModalDetalleGasto";
import ModalDetalleCompra from "../components/modals/ModalDetalleCompra";
import { Cargando } from "../components/shared/Cargando";
import { Tabs } from "../components/shared/Tabs";
import { EstadoError } from "../components/shared/EstadoError";
import AccionesFase from "../components/fases/AccionesFase";
import SeguimientoFase from "../components/fases/SeguimientoFase";
import AnalisisFase from "../components/fases/AnalisisFase";

import "../components/proyectos/Seguimiento.css";
import "../components/proyectos/AnalisisGeneral.css";
import "./FaseDetalle.css";

const diasTexto = (dias) => `hace ${dias} ${dias === 1 ? "día" : "días"}`;

const TABS = [
  { key: "acciones", label: "Acciones de la fase", icono: ArrowRightLeft },
  { key: "seguimiento", label: "Seguimiento de la fase", icono: Bell },
  { key: "analisis", label: "Análisis de la fase", icono: ChartNoAxesColumn },
];

export function FaseDetalle() {
  const { proyectoId, faseId } = useParams();
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
  // Lo que se debe, en las dos monedas: la deuda es en pesos (caveat 6.2 de
  // PLAN_TIPO_CAMBIO.md) y el USD congelado va de referencia.
  const montoSinPagarFase = {
    ars: comprasImpagasFase.reduce((acc, c) => acc + precioTotalCompra(c, "ars"), 0),
    usd: comprasImpagasFase.reduce((acc, c) => acc + precioTotalCompra(c, "usd"), 0),
  };

  return (
    <div className="fase-detalle">
      {/* Variante 4h: volver al proyecto, el número de la fase en su punto de
          la línea de tiempo (el mismo de la tab Fases), nombre y estado, y una
          sola acción principal. "Terminar fase" se fue al panel de Acciones. */}
      <header className="fase-detalle__header">
        <Link to={`/proyectos/${proyectoId}`} className="fase-detalle__volver">
          <ArrowLeft size={14} strokeWidth={2} aria-hidden="true" />
          {proyecto.nombre}
        </Link>

        <div className="fase-detalle__fila">
          <div className="fase-detalle__titulo">
            <span
              className={`fase-detalle__numero fase-detalle__numero--${etapaDeFase(fase.estado)}`}
              aria-label={`Fase ${fase.orden}`}
            >
              {etapaDeFase(fase.estado) === "cerrada" ? (
                <Check size={14} strokeWidth={2.6} aria-hidden="true" />
              ) : (
                fase.orden
              )}
            </span>
            <h1 className="fase-detalle__nombre">{fase.nombre}</h1>
            <span
              className="badge"
              style={{ color: estadoInfo.fg, backgroundColor: estadoInfo.bg }}
            >
              {IconoEstado && <IconoEstado size={12} strokeWidth={2} aria-hidden="true" />}
              {estadoInfo.label}
            </span>
          </div>

          {canManage && (
            <div className="fase-detalle__acciones">
              <button type="button" className="btn btn-secondary" onClick={handleNuevoGasto}>
                <Plus size={15} strokeWidth={2} aria-hidden="true" />
                Gasto
              </button>
              <button type="button" className="btn btn-primary" onClick={handleNuevaCompra}>
                <Plus size={15} strokeWidth={2} aria-hidden="true" />
                Nueva compra
              </button>
            </div>
          )}
        </div>

        {(fase.descripcion || fase.fecha_inicio || diasEnCurso !== null) && (
          <ul className="fase-detalle__meta">
            {fase.descripcion && <li>{fase.descripcion}</li>}
            {fase.fecha_inicio && (
              <li>
                <CalendarDays size={14} strokeWidth={1.75} aria-hidden="true" />
                Inicio el {formatFecha(fase.fecha_inicio)}
              </li>
            )}
            {diasEnCurso !== null && (
              <li>
                <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
                En curso {diasTexto(diasEnCurso)}
              </li>
            )}
          </ul>
        )}
      </header>

      <Tabs
        tabs={TABS}
        activa={tabActiva}
        onCambiar={setTabActiva}
        etiqueta="Secciones de la fase"
      />

      {tabActiva === "acciones" && (
        <AccionesFase
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
          kpis={kpis}
          productos={productos}
          proveedores={proveedores}
          onVerSeguimiento={() => setTabActiva("seguimiento")}
          onTerminarFase={puedeMarcarTerminada ? marcarTerminada : undefined}
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
          comprasImpagasFase={comprasImpagasFase}
          montoSinPagarFase={montoSinPagarFase}
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
          onEliminar={
            canManage
              ? () => {
                  cerrarDetalle();
                  handleSolicitarEliminarGasto(entidadDetalle.id);
                }
              : undefined
          }
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
          onEliminar={
            canManage
              ? () => {
                  cerrarDetalle();
                  handleSolicitarEliminarCompra(entidadDetalle.id);
                }
              : undefined
          }
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
