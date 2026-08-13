import { useMemo, useState } from "react";
import { getComprobanteCompra, getNotaCompra } from "../../services/compraService";
import { getComprobanteGasto } from "../../services/gastoService";
import { getComprobanteCobro, getNotaCobro } from "../../services/cobroService";
import useAuth from "../../context/useAuth";
import { formatMoneda, formatFecha } from "../../utils/formato";
import { useAccionesProyecto } from "../../hooks/useAccionesProyecto";

import GastoCard from "./cards/GastoCard";
import CobroCard from "./cards/CobroCard";
import CompraCard from "./cards/CompraCard";
import ModalGasto from "../modals/ModalGasto";
import ModalCobro from "../modals/ModalCobro";
import ModalCompra from "../modals/ModalCompra";
import ModalNota from "../modals/ModalNota";
import ModalConfirmar from "../modals/ModalConfirmar";
import ModalDetalleGasto from "../modals/ModalDetalleGasto";
import ModalDetalleCobro from "../modals/ModalDetalleCobro";
import ModalDetalleCompra from "../modals/ModalDetalleCompra";
import FiltrosLista from "../shared/FiltrosLista";
import { FILTROS_VACIOS, filtrarCompras, filtrarCobros, filtrarGastos } from "../../utils/filtros";

import "./Acciones.css";

export function Acciones({ proyectoId, proyectoNombre }) {
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";

  const [subTab, setSubTab] = useState("compras");

  const {
    compras,
    gastos,
    cobros,
    fases,
    categoriasGasto,
    proveedores,
    productos,
    impuestos,
    guardarGasto,
    eliminarGasto,
    agregarComprobantesGasto,
    eliminarComprobanteGasto,
    guardarCobro,
    eliminarCobro,
    agregarComprobantesCobro,
    eliminarComprobanteCobro,
    guardarCompra,
    eliminarCompra,
    toggleEstadoPagoCompra,
    toggleEstadoEnvioCompra,
    agregarComprobantesCompra,
    eliminarComprobanteCompra,
    guardarNota,
    eliminarNotaCompra,
    eliminarNotaCobro,
  } = useAccionesProyecto(proyectoId);

  const [filtrosGastos, setFiltrosGastos] = useState(FILTROS_VACIOS);
  const [filtrosCobros, setFiltrosCobros] = useState(FILTROS_VACIOS);
  const [filtrosCompras, setFiltrosCompras] = useState(FILTROS_VACIOS);

  const gastosFiltrados = useMemo(
    () => filtrarGastos(gastos, filtrosGastos),
    [gastos, filtrosGastos]
  );
  const cobrosFiltrados = useMemo(
    () => filtrarCobros(cobros, filtrosCobros),
    [cobros, filtrosCobros]
  );
  const comprasFiltradas = useMemo(
    () => filtrarCompras(compras, filtrosCompras),
    [compras, filtrosCompras]
  );

  const [modalGastoAbierto, setModalGastoAbierto] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);

  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [cobroEditando, setCobroEditando] = useState(null);

  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);

  const [modalNotaAbierto, setModalNotaAbierto] = useState(false);
  const [notaContexto, setNotaContexto] = useState(null); // "compra" | "cobro"
  const [notaEntidad, setNotaEntidad] = useState(null); // la Compra o el Cobro sobre el que se carga la nota

  const [detalle, setDetalle] = useState(null); // { tipo: "gasto" | "cobro" | "compra", entidad }
  const cerrarDetalle = () => setDetalle(null);

  const [confirmarEliminar, setConfirmarEliminar] = useState(null); // { tipo: "gasto" | "cobro" | "compra", id, nombre }
  const cerrarConfirmarEliminar = () => setConfirmarEliminar(null);

  const nombreFase = (faseId) => fases.find((f) => f.id === faseId)?.nombre;
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
    const gasto = gastos.find((g) => g.id === gastoId);
    setConfirmarEliminar({ tipo: "gasto", id: gastoId, nombre: gasto?.descripcion });
  };

  const handleEliminarGasto = async (gastoId) => {
    try {
      await eliminarGasto(gastoId);
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  // --- Cobros ---
  const handleNuevoCobro = () => {
    setCobroEditando(null);
    setModalCobroAbierto(true);
  };

  const handleEditarCobro = (cobro) => {
    setCobroEditando(cobro);
    setModalCobroAbierto(true);
  };

  const handleGuardarCobro = async (datosForm, comprobantesCambios) => {
    try {
      await guardarCobro(cobroEditando, datosForm, comprobantesCambios);
      setModalCobroAbierto(false);
      setCobroEditando(null);
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  const handleSolicitarEliminarCobro = (cobroId) => {
    const cobro = cobros.find((c) => c.id === cobroId);
    setConfirmarEliminar({
      tipo: "cobro",
      id: cobroId,
      nombre: cobro ? `${formatMoneda(cobro.monto)} del ${formatFecha(cobro.fecha)}` : undefined,
    });
  };

  const handleEliminarCobro = async (cobroId) => {
    try {
      await eliminarCobro(cobroId);
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
    const compra = compras.find((c) => c.id === compraId);
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
    setNotaContexto("compra");
    setNotaEntidad(compra);
    setModalNotaAbierto(true);
  };

  const handleAgregarNotaCobro = (cobro) => {
    setNotaContexto("cobro");
    setNotaEntidad(cobro);
    setModalNotaAbierto(true);
  };

  const handleGuardarNota = async (payload) => {
    await guardarNota(notaContexto, notaEntidad, payload);
    setModalNotaAbierto(false);
    setNotaEntidad(null);
  };

  // --- Confirmación de borrado (compra/gasto/cobro) ---
  const handleConfirmarEliminar = async () => {
    const { tipo, id } = confirmarEliminar;
    cerrarConfirmarEliminar();
    if (tipo === "gasto") await handleEliminarGasto(id);
    else if (tipo === "cobro") await handleEliminarCobro(id);
    else if (tipo === "compra") await handleEliminarCompra(id);
  };

  return (
    <div>
      <div className="acciones-subtabs">
        <button
          className={`acciones-subtab ${subTab === "compras" ? "active" : ""}`}
          onClick={() => setSubTab("compras")}
        >
          Compras
        </button>
        <button
          className={`acciones-subtab ${subTab === "gastos" ? "active" : ""}`}
          onClick={() => setSubTab("gastos")}
        >
          Gastos
        </button>
        <button
          className={`acciones-subtab ${subTab === "cobros" ? "active" : ""}`}
          onClick={() => setSubTab("cobros")}
        >
          Cobros
        </button>
      </div>

      {subTab === "compras" && (
        <div className="acciones-seccion">
          <div className="acciones-header">
            <h2>Compras del Proyecto</h2>
            {canManage && <button onClick={handleNuevaCompra}>Nueva compra</button>}
          </div>

          {compras.length > 0 && (
            <FiltrosLista
              filtros={filtrosCompras}
              onCambiar={setFiltrosCompras}
              mostrarNotas
              mostrarEstadoPago
              mostrarEstadoEnvio
            />
          )}

          {compras.length === 0 ? (
            <p>No hay compras registradas para este proyecto.</p>
          ) : comprasFiltradas.length === 0 ? (
            <p>Ninguna compra coincide con los filtros.</p>
          ) : (
            <div className="acciones-grid acciones-grid--compras">
              {comprasFiltradas.map((compra) => (
                <CompraCard
                  key={compra.id}
                  compra={compra}
                  faseNombre={nombreFase(compra.fase_id)}
                  proveedorNombre={nombreProveedor(compra.proveedor_id)}
                  productos={productos}
                  onEditar={handleEditarCompra}
                  onEliminar={handleSolicitarEliminarCompra}
                  onTogglePago={handleToggleEstadoPagoCompra}
                  onToggleEnvio={handleToggleEstadoEnvioCompra}
                  onVerComprobante={getComprobanteCompra}
                  onAgregarComprobante={agregarComprobantesCompra}
                  onEliminarComprobante={eliminarComprobanteCompra}
                  onAgregarNota={handleAgregarNotaCompra}
                  onVerNota={getNotaCompra}
                  onEliminarNota={eliminarNotaCompra}
                  onAbrirDetalle={(c) => setDetalle({ tipo: "compra", entidad: c })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "gastos" && (
        <div className="acciones-seccion">
          <div className="acciones-header">
            <h2>Gastos del Proyecto</h2>
            {canManage && <button onClick={handleNuevoGasto}>Nuevo gasto</button>}
          </div>

          {gastos.length > 0 && (
            <FiltrosLista filtros={filtrosGastos} onCambiar={setFiltrosGastos} mostrarComprobante />
          )}

          {gastos.length === 0 ? (
            <p>No hay gastos registrados para este proyecto.</p>
          ) : gastosFiltrados.length === 0 ? (
            <p>Ningún gasto coincide con los filtros.</p>
          ) : (
            <div className="acciones-grid">
              {gastosFiltrados.map((gasto) => (
                <GastoCard
                  key={gasto.id}
                  gasto={gasto}
                  faseNombre={gasto.fase_id ? nombreFase(gasto.fase_id) : null}
                  onEditar={handleEditarGasto}
                  onEliminar={handleSolicitarEliminarGasto}
                  onVerComprobante={getComprobanteGasto}
                  onAgregarComprobante={agregarComprobantesGasto}
                  onEliminarComprobante={eliminarComprobanteGasto}
                  onAbrirDetalle={(g) => setDetalle({ tipo: "gasto", entidad: g })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "cobros" && (
        <div className="acciones-seccion">
          <div className="acciones-header">
            <h2>Cobros del Proyecto</h2>
            {canManage && <button onClick={handleNuevoCobro}>Nuevo cobro</button>}
          </div>

          {cobros.length > 0 && (
            <FiltrosLista
              filtros={filtrosCobros}
              onCambiar={setFiltrosCobros}
              mostrarNotas
              mostrarComprobante
            />
          )}

          {cobros.length === 0 ? (
            <p>No hay cobros registrados para este proyecto.</p>
          ) : cobrosFiltrados.length === 0 ? (
            <p>Ningún cobro coincide con los filtros.</p>
          ) : (
            <div className="acciones-grid">
              {cobrosFiltrados.map((cobro) => (
                <CobroCard
                  key={cobro.id}
                  cobro={cobro}
                  onEditar={handleEditarCobro}
                  onEliminar={handleSolicitarEliminarCobro}
                  onVerComprobante={getComprobanteCobro}
                  onAgregarComprobante={agregarComprobantesCobro}
                  onEliminarComprobante={eliminarComprobanteCobro}
                  onAgregarNota={handleAgregarNotaCobro}
                  onVerNota={getNotaCobro}
                  onEliminarNota={eliminarNotaCobro}
                  onAbrirDetalle={(c) => setDetalle({ tipo: "cobro", entidad: c })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {modalGastoAbierto && (
        <ModalGasto
          gasto={gastoEditando}
          categoriasDisponibles={categoriasGasto}
          fasesDisponibles={fases}
          onGuardar={handleGuardarGasto}
          onCerrar={() => setModalGastoAbierto(false)}
          onVerComprobante={
            gastoEditando ? (c) => getComprobanteGasto(gastoEditando.id, c.id) : undefined
          }
        />
      )}

      {modalCobroAbierto && (
        <ModalCobro
          cobro={cobroEditando}
          proyectoActual={{ id: proyectoId, nombre: proyectoNombre }}
          onGuardar={handleGuardarCobro}
          onCerrar={() => setModalCobroAbierto(false)}
          onVerComprobante={
            cobroEditando ? (c) => getComprobanteCobro(cobroEditando.id, c.id) : undefined
          }
        />
      )}

      {modalCompraAbierto && (
        <ModalCompra
          compra={compraEditando}
          fasesDisponibles={fases}
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
          contexto={notaContexto}
          entidad={notaEntidad}
          productos={productos}
          impuestosDisponibles={impuestos}
          onGuardar={handleGuardarNota}
          onCerrar={() => setModalNotaAbierto(false)}
        />
      )}

      {detalle?.tipo === "gasto" && (
        <ModalDetalleGasto
          gasto={detalle.entidad}
          faseNombre={detalle.entidad.fase_id ? nombreFase(detalle.entidad.fase_id) : null}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteGasto(detalle.entidad.id, c.id)}
        />
      )}

      {detalle?.tipo === "cobro" && (
        <ModalDetalleCobro
          cobro={detalle.entidad}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteCobro(detalle.entidad.id, c.id)}
          onVerNota={(n) => getNotaCobro(detalle.entidad.id, n.id)}
        />
      )}

      {detalle?.tipo === "compra" && (
        <ModalDetalleCompra
          compra={detalle.entidad}
          faseNombre={nombreFase(detalle.entidad.fase_id)}
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

export default Acciones;
