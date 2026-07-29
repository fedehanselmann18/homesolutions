import { useEffect, useState } from "react";
import {
    getComprasPorProyecto,
    crearCompra,
    actualizarCompra,
    eliminarCompra,
    subirComprobanteCompra,
    getComprobanteCompra,
    eliminarComprobanteCompra,
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
} from "../../services/cobroService";
import { getFasesPorProyecto } from "../../services/faseService";
import { getCategoriasGasto } from "../../services/categoriaGastoService";
import { getProveedores } from "../../services/proveedorService";
import { getProductos } from "../../services/productoService";
import { getImpuestos } from "../../services/impuestosService";
import useAuth from "../../context/useAuth";

import GastoCard from "./cards/GastoCard";
import CobroCard from "./cards/CobroCard";
import CompraCard from "./cards/CompraCard";
import ModalGasto from "../modals/ModalGasto";
import ModalCobro from "../modals/ModalCobro";
import ModalCompra from "../modals/ModalCompra";

import "./Acciones.css";

export function Acciones({ proyectoId }) {
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";

    const [subTab, setSubTab] = useState("gastos");

    const [compras, setCompras] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [cobros, setCobros] = useState([]);

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
        }
    };

    const handleEliminarGasto = async (gastoId) => {
        try {
            await eliminarGasto(gastoId);
            fetchAcciones();
        } catch (error) {
            console.error("Error eliminando gasto:", error);
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
        }
    };

    const handleEliminarCobro = async (cobroId) => {
        try {
            await eliminarCobro(cobroId);
            fetchAcciones();
        } catch (error) {
            console.error("Error eliminando cobro:", error);
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
        }
    };

    const handleEliminarCompra = async (compraId) => {
        try {
            await eliminarCompra(compraId);
            fetchAcciones();
        } catch (error) {
            console.error("Error eliminando compra:", error);
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

                    {gastos.length === 0 ? (
                        <p>No hay gastos registrados para este proyecto.</p>
                    ) : (
                        <div className="acciones-grid">
                            {gastos.map((gasto) => (
                                <GastoCard
                                    key={gasto.id}
                                    gasto={gasto}
                                    faseNombre={gasto.fase_id ? nombreFase(gasto.fase_id) : null}
                                    onEditar={handleEditarGasto}
                                    onEliminar={handleEliminarGasto}
                                    onVerComprobante={getComprobanteGasto}
                                    onAgregarComprobante={handleAgregarComprobantesGasto}
                                    onEliminarComprobante={handleEliminarComprobanteGasto}
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

                    {cobros.length === 0 ? (
                        <p>No hay cobros registrados para este proyecto.</p>
                    ) : (
                        <div className="acciones-grid">
                            {cobros.map((cobro) => (
                                <CobroCard
                                    key={cobro.id}
                                    cobro={cobro}
                                    onEditar={handleEditarCobro}
                                    onEliminar={handleEliminarCobro}
                                    onVerComprobante={getComprobanteCobro}
                                    onAgregarComprobante={handleAgregarComprobantesCobro}
                                    onEliminarComprobante={handleEliminarComprobanteCobro}
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

                    {compras.length === 0 ? (
                        <p>No hay compras registradas para este proyecto.</p>
                    ) : (
                        <div className="acciones-grid">
                            {compras.map((compra) => (
                                <CompraCard
                                    key={compra.id}
                                    compra={compra}
                                    faseNombre={nombreFase(compra.fase_id)}
                                    proveedorNombre={nombreProveedor(compra.proveedor_id)}
                                    productos={productos}
                                    onEditar={handleEditarCompra}
                                    onEliminar={handleEliminarCompra}
                                    onVerComprobante={getComprobanteCompra}
                                    onAgregarComprobante={handleAgregarComprobantesCompra}
                                    onEliminarComprobante={handleEliminarComprobanteCompra}
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
                    proyectoActual={{ id: proyectoId , nombre: "Proyecto Actual" }} // You can replace this with the actual project name if available
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
        </div>
    );
}

export default Acciones;