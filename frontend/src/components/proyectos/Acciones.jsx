import { useMemo, useState } from "react";
import { getComprobanteCompra, getNotaCompra } from "../../services/compraService";
import { getComprobanteGasto } from "../../services/gastoService";
import { getComprobanteCobro, getNotaCobro } from "../../services/cobroService";
import useAuth from "../../context/useAuth";
import { formatMoneda, formatFecha } from "../../utils/formato";
import { useAccionesProyecto } from "../../hooks/useAccionesProyecto";
import { useProyecto } from "../../hooks/queries";
import { montoCobroNeto } from "../../utils/moneda";

import LibroDeObra from "./LibroDeObra";
import SaldoObra from "./SaldoObra";
import ModalGasto from "../modals/ModalGasto";
import ModalCobro from "../modals/ModalCobro";
import ModalCompra from "../modals/ModalCompra";
import ModalNota from "../modals/ModalNota";
import ModalConfirmar from "../modals/ModalConfirmar";
import ModalDetalleGasto from "../modals/ModalDetalleGasto";
import ModalDetalleCobro from "../modals/ModalDetalleCobro";
import ModalDetalleCompra from "../modals/ModalDetalleCompra";
import FiltrosLista from "../shared/FiltrosLista";
import { FiltrosSegmentados } from "../shared/FiltrosSegmentados";
import { BotonMovimiento } from "../shared/BotonMovimiento";
import {
  FILTROS_VACIOS,
  CAMPOS_FILTRO_POR_TIPO,
  filtrosParaTipo,
  filtrarCompras,
  filtrarCobros,
  filtrarGastos,
  tieneAlerta,
} from "../../utils/filtros";

import "./Acciones.css";

const FILTROS_TIPO = [
  { key: "todo", label: "Todo" },
  { key: "compras", label: "Compras" },
  { key: "gastos", label: "Gastos" },
  { key: "cobros", label: "Cobros" },
  { key: "alertas", label: "Con alertas" },
];

// "compra-<id>" -> { tipo, id }. Es lo que manda "Últimos movimientos" del
// Panel: en vez de dejar al usuario buscando el movimiento que tocó en una
// planilla de 200 filas, se le abre su ficha. Las notas de crédito/débito no
// tienen ficha propia, así que ahí no hay nada que abrir.
const TIPOS_CON_DETALLE = ["compra", "gasto", "cobro"];

function parsearFoco(foco) {
  if (!foco) return null;
  const separador = foco.indexOf("-");
  if (separador < 1) return null;
  const tipo = foco.slice(0, separador);
  const id = foco.slice(separador + 1);
  return TIPOS_CON_DETALLE.includes(tipo) && id ? { tipo, id } : null;
}

export function Acciones({ proyectoId, proyectoNombre, foco }) {
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";

  const [filtroTipo, setFiltroTipo] = useState("todo");
  const camposFiltro = CAMPOS_FILTRO_POR_TIPO[filtroTipo];

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

  // Una sola barra de filtros para toda la planilla: compras, gastos y cobros
  // comparten fecha/tipo de factura, y cada colección ignora los campos que no
  // le aplican (un gasto no tiene notas ni estado de pago).
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);

  const gastosFiltrados = useMemo(() => filtrarGastos(gastos, filtros), [gastos, filtros]);
  const cobrosFiltrados = useMemo(() => filtrarCobros(cobros, filtros), [cobros, filtros]);
  // Para el avance de cobro del modal de cobro (variante 5d): el precio sale
  // de la query del proyecto, que ya está en caché por el header.
  const proyectoQuery = useProyecto(proyectoId);
  const cobradoUsd = cobros.reduce((acc, c) => acc + montoCobroNeto(c, "usd"), 0);
  const comprasFiltradas = useMemo(() => filtrarCompras(compras, filtros), [compras, filtros]);

  // "Con alertas" no es un tipo: recorta los tres por el mismo criterio que
  // pinta de ámbar o rojo una fila (ver tieneAlerta en utils/filtros.js).
  const conAlerta = useMemo(
    () => ({
      compras: comprasFiltradas.filter((c) => tieneAlerta("compra", c)),
      gastos: gastosFiltrados.filter((g) => tieneAlerta("gasto", g)),
      cobros: cobrosFiltrados.filter((c) => tieneAlerta("cobro", c)),
    }),
    [comprasFiltradas, gastosFiltrados, cobrosFiltrados]
  );

  const visiblesPorFiltro = {
    todo: { compras: comprasFiltradas, gastos: gastosFiltrados, cobros: cobrosFiltrados },
    compras: { compras: comprasFiltradas, gastos: [], cobros: [] },
    gastos: { compras: [], gastos: gastosFiltrados, cobros: [] },
    cobros: { compras: [], gastos: [], cobros: cobrosFiltrados },
    alertas: conAlerta,
  };
  const {
    compras: comprasVisibles,
    gastos: gastosVisibles,
    cobros: cobrosVisibles,
  } = visiblesPorFiltro[filtroTipo];

  const [modalGastoAbierto, setModalGastoAbierto] = useState(false);
  const [gastoEditando, setGastoEditando] = useState(null);

  const [modalCobroAbierto, setModalCobroAbierto] = useState(false);
  const [cobroEditando, setCobroEditando] = useState(null);

  const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
  const [compraEditando, setCompraEditando] = useState(null);

  const [modalNotaAbierto, setModalNotaAbierto] = useState(false);
  const [notaContexto, setNotaContexto] = useState(null); // "compra" | "cobro"
  const [notaEntidad, setNotaEntidad] = useState(null); // la Compra o el Cobro sobre el que se carga la nota

  // Se guarda el id y no la entidad: agregar o borrar un comprobante desde el
  // modal de detalle recarga la colección del hook, y una copia congelada del
  // objeto seguiría mostrando la lista vieja.
  // Arranca abierto en el movimiento de ?foco=, si vino uno (ver parsearFoco).
  const [detalle, setDetalle] = useState(() => parsearFoco(foco)); // { tipo, id }
  const cerrarDetalle = () => setDetalle(null);

  const coleccionPorTipo = { compra: compras, gasto: gastos, cobro: cobros };
  const entidadDetalle = detalle
    ? coleccionPorTipo[detalle.tipo].find((e) => e.id === detalle.id)
    : null;

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
      nombre: cobro
        ? `${formatMoneda(cobro.monto_usd, "usd")} del ${formatFecha(cobro.fecha)}`
        : undefined,
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

  const contadorPorFiltro = {
    todo: comprasFiltradas.length + gastosFiltrados.length + cobrosFiltrados.length,
    compras: comprasFiltradas.length,
    gastos: gastosFiltrados.length,
    cobros: cobrosFiltrados.length,
    alertas: conAlerta.compras.length + conAlerta.gastos.length + conAlerta.cobros.length,
  };

  return (
    <div className="acciones-proyecto">
      <div className="acciones-header">
        <h2>Movimientos del proyecto</h2>
      </div>

      <SaldoObra
        compras={compras}
        gastos={gastos}
        cobros={cobros}
        precioAcordadoUsd={proyectoQuery.data?.precio_acordado_usd}
      />

      {/* Justo arriba de la lista, no en el título: entre uno y otra está el
          bloque del saldo y los botones quedaban lejos de lo que modifican.
          A la izquierda, con la compra (la primaria) primero. */}
      {canManage && (
        <div className="acciones-nuevo">
          <BotonMovimiento tipo="compra" principal onClick={handleNuevaCompra}>
            Nueva compra
          </BotonMovimiento>
          <BotonMovimiento tipo="gasto" onClick={handleNuevoGasto} />
          <BotonMovimiento tipo="cobro" onClick={handleNuevoCobro} />
        </div>
      )}

      <FiltrosLista
        filtros={filtros}
        onCambiar={setFiltros}
        mostrarEstadoPago={camposFiltro.includes("estadoPago")}
        mostrarEstadoEnvio={camposFiltro.includes("estadoEnvio")}
        mostrarNotas={camposFiltro.includes("notas")}
        mostrarComprobante={camposFiltro.includes("comprobante")}
        mostrarFechas={false}
      >
        <FiltrosSegmentados
          opciones={FILTROS_TIPO}
          activa={filtroTipo}
          contadores={contadorPorFiltro}
          etiqueta="Filtrar movimientos por tipo"
          onCambiar={(key) => {
            setFiltroTipo(key);
            // Lo que no aplica al tipo nuevo se suelta: si no, seguiría
            // filtrando sin estar a la vista en el panel.
            setFiltros((actuales) => filtrosParaTipo(actuales, key));
          }}
        />
      </FiltrosLista>

      <LibroDeObra
        movimientoActivo={detalle}
        compras={comprasVisibles}
        gastos={gastosVisibles}
        cobros={cobrosVisibles}
        nombreFase={nombreFase}
        nombreProveedor={nombreProveedor}
        canManage={canManage}
        onAbrirDetalle={(tipo, entidad) => setDetalle({ tipo, id: entidad.id })}
        onTogglePagoCompra={handleToggleEstadoPagoCompra}
        onToggleEnvioCompra={handleToggleEstadoEnvioCompra}
        onEditar={(tipo, entidad) => {
          if (tipo === "compra") handleEditarCompra(entidad);
          else if (tipo === "gasto") handleEditarGasto(entidad);
          else handleEditarCobro(entidad);
        }}
        onEliminar={(tipo, id) => {
          if (tipo === "compra") handleSolicitarEliminarCompra(id);
          else if (tipo === "gasto") handleSolicitarEliminarGasto(id);
          else handleSolicitarEliminarCobro(id);
        }}
        onAgregarNota={(tipo, entidad) => {
          if (tipo === "compra") handleAgregarNotaCompra(entidad);
          else handleAgregarNotaCobro(entidad);
        }}
        onVerComprobante={(tipo, entidadId, comprobanteId) => {
          if (tipo === "compra") return getComprobanteCompra(entidadId, comprobanteId);
          if (tipo === "gasto") return getComprobanteGasto(entidadId, comprobanteId);
          return getComprobanteCobro(entidadId, comprobanteId);
        }}
      />
      {modalGastoAbierto && (
        <ModalGasto
          gasto={gastoEditando}
          contexto={proyectoNombre}
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
          proyectoActual={{
            id: proyectoId,
            nombre: proyectoNombre,
            precio_acordado_usd: proyectoQuery.data?.precio_acordado_usd,
            cobrado_usd: cobradoUsd,
          }}
          onGuardar={handleGuardarCobro}
          onCerrar={() => setModalCobroAbierto(false)}
          onVerComprobante={
            cobroEditando ? (c) => getComprobanteCobro(cobroEditando.id, c.id) : undefined
          }
          onVerNota={cobroEditando ? (n) => getNotaCobro(cobroEditando.id, n.id) : undefined}
        />
      )}

      {modalCompraAbierto && (
        <ModalCompra
          contexto={proyectoNombre}
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

      {entidadDetalle && detalle.tipo === "gasto" && (
        <ModalDetalleGasto
          gasto={entidadDetalle}
          faseNombre={entidadDetalle.fase_id ? nombreFase(entidadDetalle.fase_id) : null}
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
          onAgregarComprobante={
            canManage ? (files) => agregarComprobantesGasto(entidadDetalle.id, files) : undefined
          }
          onEliminarComprobante={
            canManage ? (id) => eliminarComprobanteGasto(entidadDetalle.id, id) : undefined
          }
          onEditar={
            canManage
              ? () => {
                  cerrarDetalle();
                  handleEditarGasto(entidadDetalle);
                }
              : undefined
          }
        />
      )}

      {entidadDetalle && detalle.tipo === "cobro" && (
        <ModalDetalleCobro
          cobro={entidadDetalle}
          onEliminar={
            canManage
              ? () => {
                  cerrarDetalle();
                  handleSolicitarEliminarCobro(entidadDetalle.id);
                }
              : undefined
          }
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteCobro(entidadDetalle.id, c.id)}
          onVerNota={(n) => getNotaCobro(entidadDetalle.id, n.id)}
          onAgregarComprobante={
            canManage ? (files) => agregarComprobantesCobro(entidadDetalle.id, files) : undefined
          }
          onEliminarComprobante={
            canManage ? (id) => eliminarComprobanteCobro(entidadDetalle.id, id) : undefined
          }
          onAgregarNota={canManage ? () => handleAgregarNotaCobro(entidadDetalle) : undefined}
          onEliminarNota={canManage ? (id) => eliminarNotaCobro(entidadDetalle.id, id) : undefined}
          onEditar={() => {
            cerrarDetalle();
            handleEditarCobro(entidadDetalle);
          }}
          canManage={canManage}
        />
      )}

      {entidadDetalle && detalle.tipo === "compra" && (
        <ModalDetalleCompra
          compra={entidadDetalle}
          faseNombre={nombreFase(entidadDetalle.fase_id)}
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
          onAgregarComprobante={
            canManage ? (files) => agregarComprobantesCompra(entidadDetalle.id, files) : undefined
          }
          onEliminarComprobante={
            canManage ? (id) => eliminarComprobanteCompra(entidadDetalle.id, id) : undefined
          }
          onAgregarNota={canManage ? () => handleAgregarNotaCompra(entidadDetalle) : undefined}
          onEliminarNota={canManage ? (id) => eliminarNotaCompra(entidadDetalle.id, id) : undefined}
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

export default Acciones;
