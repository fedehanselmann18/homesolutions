import { useEffect, useMemo, useState } from "react";
import {
    getComprasPorProyecto,
    crearCompra,
    actualizarCompra,
    eliminarCompra,
    subirComprobanteCompra,
    getComprobanteCompra,
    eliminarComprobanteCompra,
    crearNotaCompra,
    getNotaCompra,
    eliminarNotaCompra,
} from "../../services/compraService";
import {
    getGastosPorProyecto,
    crearGasto,
    actualizarGasto,
    eliminarGasto,
    subirComprobanteGasto,
    getComprobanteGasto,
    eliminarComprobanteGasto,
} from "../../services/gastoService";
import {
    getCobrosPorProyecto,
    crearCobro,
    actualizarCobro,
    eliminarCobro,
    subirComprobanteCobro,
    getComprobanteCobro,
    eliminarComprobanteCobro,
    crearNotaCobro,
    getNotaCobro,
    eliminarNotaCobro,
} from "../../services/cobroService";
import { getFasesPorProyecto } from "../../services/faseService";
import { getCategoriasGasto } from "../../services/categoriaGastoService";
import { getProveedores } from "../../services/proveedorService";
import { getProductos } from "../../services/productoService";
import { getImpuestos } from "../../services/impuestosService";
import useAuth from "../../context/useAuth";
import { useToast } from "../../context/useToast";

import GastoCard from "./cards/GastoCard";
import CobroCard from "./cards/CobroCard";
import CompraCard from "./cards/CompraCard";
import ModalGasto from "../modals/ModalGasto";
import ModalCobro from "../modals/ModalCobro";
import ModalCompra from "../modals/ModalCompra";
import ModalNota from "../modals/ModalNota";
import ModalDetalleGasto from "../modals/ModalDetalleGasto";
import ModalDetalleCobro from "../modals/ModalDetalleCobro";
import ModalDetalleCompra from "../modals/ModalDetalleCompra";
import FiltrosLista from "../shared/FiltrosLista";
import { FILTROS_VACIOS, filtrarCompras, filtrarCobros, filtrarGastos } from "../../utils/filtros";

import "./Acciones.css";

export function Acciones({ proyectoId, proyectoNombre }) {
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";
    const toast = useToast();

    const [subTab, setSubTab] = useState("gastos");

    const [compras, setCompras] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [cobros, setCobros] = useState([]);

    const [filtrosGastos, setFiltrosGastos] = useState(FILTROS_VACIOS);
    const [filtrosCobros, setFiltrosCobros] = useState(FILTROS_VACIOS);
    const [filtrosCompras, setFiltrosCompras] = useState(FILTROS_VACIOS);

    const gastosFiltrados = useMemo(() => filtrarGastos(gastos, filtrosGastos), [gastos, filtrosGastos]);
    const cobrosFiltrados = useMemo(() => filtrarCobros(cobros, filtrosCobros), [cobros, filtrosCobros]);
    const comprasFiltradas = useMemo(() => filtrarCompras(compras, filtrosCompras), [compras, filtrosCompras]);

    // Listas de apoyo para los selects de los modales
    const [fases, setFases] = useState([]);
    const [categoriasGasto, setCategoriasGasto] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [impuestos, setImpuestos] = useState([]);

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

    useEffect(() => {
        fetchAcciones();
        fetchListasDeApoyo();
    }, [proyectoId]);

    const fetchAcciones = async () => {
        try {
            const [comprasData, gastosData, cobrosData] = await Promise.all([
                getComprasPorProyecto(proyectoId),
                getGastosPorProyecto(proyectoId),
                getCobrosPorProyecto(proyectoId),
            ]);
            setCompras(comprasData);
            setGastos(gastosData);
            setCobros(cobrosData);
        } catch (error) {
            console.error("Error fetching acciones:", error);
        }
    };

    const fetchListasDeApoyo = async () => {
        try {
            const [fasesData, categoriasData, proveedoresData, productosData, impuestosData] =
                await Promise.all([
                    getFasesPorProyecto(proyectoId),
                    getCategoriasGasto(),
                    getProveedores(),
                    getProductos(),
                    getImpuestos(),
                ]);
            setFases(fasesData);
            setCategoriasGasto(categoriasData);
            setProveedores(proveedoresData);
            setProductos(productosData);
            setImpuestos(impuestosData);
        } catch (error) {
            console.error("Error fetching listas de apoyo:", error);
        }
    };

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

    const handleGuardarGasto = async (datosForm, comprobantesCambios = { archivos: [], eliminarIds: [] }) => {
        try {
            const gasto = gastoEditando
                ? await actualizarGasto(gastoEditando.id, datosForm)
                : await crearGasto({ ...datosForm, proyecto_id: proyectoId });

            await Promise.all([
                ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteGasto(gasto.id, id)),
                ...comprobantesCambios.archivos.map((archivo) => subirComprobanteGasto(gasto.id, archivo)),
            ]);

            setModalGastoAbierto(false);
            setGastoEditando(null);
            fetchAcciones();
        } catch (error) {
            console.error("Error guardando gasto:", error);
            toast.error("No se pudo guardar el gasto.");
        }
    };

    const handleEliminarGasto = async (gastoId) => {
        try {
            await eliminarGasto(gastoId);
            fetchAcciones();
        } catch (error) {
            console.error("Error eliminando gasto:", error);
            toast.error("No se pudo eliminar el gasto.");
        }
    };

    const handleAgregarComprobantesGasto = async (gastoId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteGasto(gastoId, archivo)));
        fetchAcciones();
    };

    const handleEliminarComprobanteGasto = async (gastoId, comprobanteId) => {
        await eliminarComprobanteGasto(gastoId, comprobanteId);
        fetchAcciones();
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

    const handleGuardarCobro = async (datosForm, comprobantesCambios = { archivos: [], eliminarIds: [] }) => {
        try {
            const cobro = cobroEditando
                ? await actualizarCobro(cobroEditando.id, datosForm)
                : await crearCobro({ ...datosForm, proyecto_id: proyectoId });

            await Promise.all([
                ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteCobro(cobro.id, id)),
                ...comprobantesCambios.archivos.map((archivo) => subirComprobanteCobro(cobro.id, archivo)),
            ]);

            setModalCobroAbierto(false);
            setCobroEditando(null);
            fetchAcciones();
        } catch (error) {
            console.error("Error guardando cobro:", error);
            toast.error("No se pudo guardar el cobro.");
        }
    };

    const handleEliminarCobro = async (cobroId) => {
        try {
            await eliminarCobro(cobroId);
            fetchAcciones();
        } catch (error) {
            console.error("Error eliminando cobro:", error);
            toast.error("No se pudo eliminar el cobro.");
        }
    };

    const handleAgregarComprobantesCobro = async (cobroId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteCobro(cobroId, archivo)));
        fetchAcciones();
    };

    const handleEliminarComprobanteCobro = async (cobroId, comprobanteId) => {
        await eliminarComprobanteCobro(cobroId, comprobanteId);
        fetchAcciones();
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

    const handleGuardarCompra = async (datosForm, comprobantesCambios = { archivos: [], eliminarIds: [] }) => {
        try {
            const compra = compraEditando
                ? await actualizarCompra(compraEditando.id, datosForm)
                : await crearCompra(datosForm);

            await Promise.all([
                ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteCompra(compra.id, id)),
                ...comprobantesCambios.archivos.map((archivo) => subirComprobanteCompra(compra.id, archivo)),
            ]);

            setModalCompraAbierto(false);
            setCompraEditando(null);
            fetchAcciones();
        } catch (error) {
            console.error("Error guardando compra:", error);
            toast.error("No se pudo guardar la compra.");
        }
    };

    const handleEliminarCompra = async (compraId) => {
        try {
            await eliminarCompra(compraId);
            fetchAcciones();
        } catch (error) {
            console.error("Error eliminando compra:", error);
            toast.error("No se pudo eliminar la compra.");
        }
    };

    const handleToggleEstadoPagoCompra = async (compra) => {
        try {
            const estado_pago = compra.estado_pago === "pagado" ? "pendiente" : "pagado";
            await actualizarCompra(compra.id, { estado_pago });
            fetchAcciones();
        } catch (error) {
            console.error("Error actualizando el estado de pago de la compra:", error);
            toast.error("No se pudo actualizar el estado de pago.");
        }
    };

    const handleToggleEstadoEnvioCompra = async (compra) => {
        try {
            const estado_envio = compra.estado_envio === "entregado" ? "pedido" : "entregado";
            await actualizarCompra(compra.id, { estado_envio });
            fetchAcciones();
        } catch (error) {
            console.error("Error actualizando el estado de envío de la compra:", error);
            toast.error("No se pudo actualizar el estado de envío.");
        }
    };

    const handleAgregarComprobantesCompra = async (compraId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteCompra(compraId, archivo)));
        fetchAcciones();
    };

    const handleEliminarComprobanteCompra = async (compraId, comprobanteId) => {
        await eliminarComprobanteCompra(compraId, comprobanteId);
        fetchAcciones();
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
        if (notaContexto === "compra") {
            await crearNotaCompra(notaEntidad.id, payload);
        } else {
            await crearNotaCobro(notaEntidad.id, payload);
        }
        setModalNotaAbierto(false);
        setNotaEntidad(null);
        fetchAcciones();
    };

    const handleEliminarNotaCompra = async (compraId, notaId) => {
        await eliminarNotaCompra(compraId, notaId);
        fetchAcciones();
    };

    const handleEliminarNotaCobro = async (cobroId, notaId) => {
        await eliminarNotaCobro(cobroId, notaId);
        fetchAcciones();
    };

    return (
        <div>
            <div className="acciones-subtabs">
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
                <button
                    className={`acciones-subtab ${subTab === "compras" ? "active" : ""}`}
                    onClick={() => setSubTab("compras")}
                >
                    Compras
                </button>
            </div>

            {subTab === "gastos" && (
                <div className="acciones-seccion">
                    <div className="acciones-header">
                        <h2>Gastos del Proyecto</h2>
                        {canManage && <button onClick={handleNuevoGasto}>Nuevo gasto</button>}
                    </div>

                    {gastos.length > 0 && (
                        <FiltrosLista
                            filtros={filtrosGastos}
                            onCambiar={setFiltrosGastos}
                            mostrarComprobante
                        />
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
                                    onEliminar={handleEliminarGasto}
                                    onVerComprobante={getComprobanteGasto}
                                    onAgregarComprobante={handleAgregarComprobantesGasto}
                                    onEliminarComprobante={handleEliminarComprobanteGasto}
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
                                    onEliminar={handleEliminarCobro}
                                    onVerComprobante={getComprobanteCobro}
                                    onAgregarComprobante={handleAgregarComprobantesCobro}
                                    onEliminarComprobante={handleEliminarComprobanteCobro}
                                    onAgregarNota={handleAgregarNotaCobro}
                                    onVerNota={getNotaCobro}
                                    onEliminarNota={handleEliminarNotaCobro}
                                    onAbrirDetalle={(c) => setDetalle({ tipo: "cobro", entidad: c })}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

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
                        <div className="acciones-grid">
                            {comprasFiltradas.map((compra) => (
                                <CompraCard
                                    key={compra.id}
                                    compra={compra}
                                    faseNombre={nombreFase(compra.fase_id)}
                                    proveedorNombre={nombreProveedor(compra.proveedor_id)}
                                    productos={productos}
                                    onEditar={handleEditarCompra}
                                    onEliminar={handleEliminarCompra}
                                    onTogglePago={handleToggleEstadoPagoCompra}
                                    onToggleEnvio={handleToggleEstadoEnvioCompra}
                                    onVerComprobante={getComprobanteCompra}
                                    onAgregarComprobante={handleAgregarComprobantesCompra}
                                    onEliminarComprobante={handleEliminarComprobanteCompra}
                                    onAgregarNota={handleAgregarNotaCompra}
                                    onVerNota={getNotaCompra}
                                    onEliminarNota={handleEliminarNotaCompra}
                                    onAbrirDetalle={(c) => setDetalle({ tipo: "compra", entidad: c })}
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
                    onVerComprobante={gastoEditando ? (c) => getComprobanteGasto(gastoEditando.id, c.id) : undefined}
                />
            )}

            {modalCobroAbierto && (
                <ModalCobro
                    cobro={cobroEditando}
                    proyectoActual={{ id: proyectoId, nombre: proyectoNombre }}
                    onGuardar={handleGuardarCobro}
                    onCerrar={() => setModalCobroAbierto(false)}
                    onVerComprobante={cobroEditando ? (c) => getComprobanteCobro(cobroEditando.id, c.id) : undefined}
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
                    onVerComprobante={compraEditando ? (c) => getComprobanteCompra(compraEditando.id, c.id) : undefined}
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
        </div>
    );
}

export default Acciones;