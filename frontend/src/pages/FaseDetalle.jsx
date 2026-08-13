import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Clock } from "lucide-react";

import { getFasePorId, actualizarFase } from "../services/faseService";
import { getProyectoPorId } from "../services/proyectoService";
import {
    getGastosPorFase,
    getGastosPorProyecto,
    crearGasto,
    actualizarGasto,
    eliminarGasto,
    subirComprobanteGasto,
    getComprobanteGasto,
    eliminarComprobanteGasto,
} from "../services/gastoService";
import {
    getComprasPorFase,
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
} from "../services/compraService";
import { getCobrosPorProyecto } from "../services/cobroService";
import { getCategoriasGasto } from "../services/categoriaGastoService";
import { getProveedores } from "../services/proveedorService";
import { getProductos } from "../services/productoService";
import { getImpuestos } from "../services/impuestosService";

import useAuth from "../context/useAuth";
import { getEstadoLabel } from "../constants/estados";
import { diasDesde } from "../utils/seguimiento";
import { notasDeCompras, totalNotasCredito, totalNotasDebito } from "../utils/notas";
import { FILTROS_VACIOS, filtrarCompras, filtrarGastos } from "../utils/filtros";
import { formatMoneda, formatFecha } from "../utils/formato";

import { TarjetaKpi } from "../components/shared/TarjetaKpi";
import ModalGasto from "../components/modals/ModalGasto";
import ModalCompra from "../components/modals/ModalCompra";
import ModalNota from "../components/modals/ModalNota";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import ModalDetalleGasto from "../components/modals/ModalDetalleGasto";
import ModalDetalleCompra from "../components/modals/ModalDetalleCompra";
import { Cargando } from "../components/shared/Cargando";
import { Breadcrumbs } from "../components/shared/Breadcrumbs";
import { useToast } from "../context/useToast";
import AccionesFase from "../components/fases/AccionesFase";
import SeguimientoFase from "../components/fases/SeguimientoFase";
import AnalisisFase from "../components/fases/AnalisisFase";

import "../components/proyectos/Acciones.css";
import "../components/proyectos/Seguimiento.css";
import "../components/proyectos/AnalisisGeneral.css";
import "./FaseDetalle.css";

const ROJO = "#dc2626";

const diasTexto = (dias) => `hace ${dias} ${dias === 1 ? "día" : "días"}`;
const sumar = (items, obtenerMonto) => items.reduce((acc, item) => acc + (obtenerMonto(item) || 0), 0);

export function FaseDetalle() {
    const { proyectoId, faseId } = useParams();
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";
    const toast = useToast();

    const [tabActiva, setTabActiva] = useState("acciones");

    const [fase, setFase] = useState(null);
    const [proyecto, setProyecto] = useState(null);
    const [gastosFase, setGastosFase] = useState([]);
    const [comprasFase, setComprasFase] = useState([]);
    const [gastosProyecto, setGastosProyecto] = useState([]);
    const [comprasProyecto, setComprasProyecto] = useState([]);
    const [cobrosProyecto, setCobrosProyecto] = useState([]);
    const [proveedores, setProveedores] = useState([]);
    const [productos, setProductos] = useState([]);
    const [categoriasGasto, setCategoriasGasto] = useState([]);
    const [impuestos, setImpuestos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

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

    const gastosFaseFiltrados = useMemo(() => filtrarGastos(gastosFase, filtrosGastos), [gastosFase, filtrosGastos]);
    const comprasFaseFiltradas = useMemo(() => filtrarCompras(comprasFase, filtrosCompras), [comprasFase, filtrosCompras]);

    useEffect(() => {
        fetchTodo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [faseId]);

    const fetchTodo = async () => {
        try {
            setCargando(true);
            setError(null);
            const faseData = await getFasePorId(faseId);

            const [
                proyectoData,
                gastosFaseData,
                comprasFaseData,
                gastosProyectoData,
                comprasProyectoData,
                cobrosProyectoData,
                proveedoresData,
                productosData,
                categoriasData,
                impuestosData,
            ] = await Promise.all([
                getProyectoPorId(faseData.proyecto_id),
                getGastosPorFase(faseId),
                getComprasPorFase(faseId),
                getGastosPorProyecto(faseData.proyecto_id),
                getComprasPorProyecto(faseData.proyecto_id),
                getCobrosPorProyecto(faseData.proyecto_id),
                getProveedores(),
                getProductos(),
                getCategoriasGasto(),
                getImpuestos(),
            ]);

            setFase(faseData);
            setProyecto(proyectoData);
            setGastosFase(gastosFaseData);
            setComprasFase(comprasFaseData);
            setGastosProyecto(gastosProyectoData);
            setComprasProyecto(comprasProyectoData);
            setCobrosProyecto(cobrosProyectoData);
            setProveedores(proveedoresData);
            setProductos(productosData);
            setCategoriasGasto(categoriasData);
            setImpuestos(impuestosData);
        } catch (err) {
            console.error("Error fetching detalle de fase:", err);
            setError(err);
        } finally {
            setCargando(false);
        }
    };

    const refetchAcciones = async () => {
        const [gastosFaseData, comprasFaseData, gastosProyectoData, comprasProyectoData] = await Promise.all([
            getGastosPorFase(faseId),
            getComprasPorFase(faseId),
            getGastosPorProyecto(fase.proyecto_id),
            getComprasPorProyecto(fase.proyecto_id),
        ]);
        setGastosFase(gastosFaseData);
        setComprasFase(comprasFaseData);
        setGastosProyecto(gastosProyectoData);
        setComprasProyecto(comprasProyectoData);
    };

    const kpis = useMemo(() => {
        if (!proyecto) return null;
        // precio_total ya incluye impuestos + notas de crédito/débito (ver
        // Compra.precio_total en el backend) -- "gastado en esta fase" ya
        // sale bien sin tocar nada acá.
        const gastadoFase = sumar(gastosFase, (g) => g.monto) + sumar(comprasFase, (c) => c.precio_total);
        const totalGastoProyecto = sumar(gastosProyecto, (g) => g.monto) + sumar(comprasProyecto, (c) => c.precio_total);
        const precioAcordado = Number(proyecto.precio_acordado ?? 0);

        const notasFase = notasDeCompras(comprasFase);

        return {
            gastadoFase,
            pctPresupuesto: precioAcordado > 0 ? (gastadoFase / precioAcordado) * 100 : 0,
            pctGastoTotal: totalGastoProyecto > 0 ? (gastadoFase / totalGastoProyecto) * 100 : 0,
            notasCreditoFase: totalNotasCredito(notasFase),
            notasDebitoFase: totalNotasDebito(notasFase),
            cantidadNotasFase: notasFase.length,
        };
    }, [proyecto, gastosFase, comprasFase, gastosProyecto, comprasProyecto]);

    const nombreProveedor = (proveedorId) => proveedores.find((p) => p.id === proveedorId)?.nombre;

    // --- Marcar como terminada ---
    const handleMarcarTerminada = async () => {
        try {
            const actualizada = await actualizarFase(fase.id, { estado: "terminada" });
            setFase(actualizada);
        } catch (err) {
            console.error("Error marcando la fase como terminada:", err);
            toast.error("No se pudo marcar la fase como terminada.");
        }
    };

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
                : await crearGasto({ ...datosForm, proyecto_id: proyecto.id });

            await Promise.all([
                ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteGasto(gasto.id, id)),
                ...comprobantesCambios.archivos.map((archivo) => subirComprobanteGasto(gasto.id, archivo)),
            ]);

            setModalGastoAbierto(false);
            setGastoEditando(null);
            refetchAcciones();
        } catch (err) {
            console.error("Error guardando gasto:", err);
            toast.error("No se pudo guardar el gasto.");
        }
    };

    const handleSolicitarEliminarGasto = (gastoId) => {
        const gasto = gastosFase.find((g) => g.id === gastoId);
        setConfirmarEliminar({ tipo: "gasto", id: gastoId, nombre: gasto?.descripcion });
    };

    const handleEliminarGasto = async (gastoId) => {
        try {
            await eliminarGasto(gastoId);
            refetchAcciones();
        } catch (err) {
            console.error("Error eliminando gasto:", err);
            toast.error("No se pudo eliminar el gasto.");
        }
    };

    const handleAgregarComprobantesGasto = async (gastoId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteGasto(gastoId, archivo)));
        refetchAcciones();
    };

    const handleEliminarComprobanteGasto = async (gastoId, comprobanteId) => {
        await eliminarComprobanteGasto(gastoId, comprobanteId);
        refetchAcciones();
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
            refetchAcciones();
        } catch (err) {
            console.error("Error guardando compra:", err);
            toast.error("No se pudo guardar la compra.");
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
            refetchAcciones();
        } catch (err) {
            console.error("Error eliminando compra:", err);
            toast.error("No se pudo eliminar la compra.");
        }
    };

    const handleToggleEstadoPagoCompra = async (compra) => {
        try {
            const estado_pago = compra.estado_pago === "pagado" ? "pendiente" : "pagado";
            await actualizarCompra(compra.id, { estado_pago });
            refetchAcciones();
        } catch (err) {
            console.error("Error actualizando el estado de pago de la compra:", err);
            toast.error("No se pudo actualizar el estado de pago.");
        }
    };

    const handleToggleEstadoEnvioCompra = async (compra) => {
        try {
            const estado_envio = compra.estado_envio === "entregado" ? "pedido" : "entregado";
            await actualizarCompra(compra.id, { estado_envio });
            refetchAcciones();
        } catch (err) {
            console.error("Error actualizando el estado de envío de la compra:", err);
            toast.error("No se pudo actualizar el estado de envío.");
        }
    };

    const handleAgregarComprobantesCompra = async (compraId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteCompra(compraId, archivo)));
        refetchAcciones();
    };

    const handleEliminarComprobanteCompra = async (compraId, comprobanteId) => {
        await eliminarComprobanteCompra(compraId, comprobanteId);
        refetchAcciones();
    };

    // --- Notas (cuenta corriente: nota de crédito / débito) ---
    const handleAgregarNotaCompra = (compra) => {
        setNotaCompra(compra);
        setModalNotaAbierto(true);
    };

    const handleGuardarNota = async (payload) => {
        await crearNotaCompra(notaCompra.id, payload);
        setModalNotaAbierto(false);
        setNotaCompra(null);
        refetchAcciones();
    };

    const handleEliminarNotaCompra = async (compraId, notaId) => {
        await eliminarNotaCompra(compraId, notaId);
        refetchAcciones();
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
    const diasEnCurso = fase.estado === "en_curso" ? diasDesde(fase.fecha_actualizacion, new Date()) : null;
    const puedeMarcarTerminada = canManage && fase.estado !== "terminada" && fase.estado !== "auditada";

    return (
        <div className="fase-detalle">
            <Breadcrumbs
                items={[
                    { label: "Proyectos", to: "/proyectos" },
                    { label: proyecto.nombre, to: `/proyectos/${proyectoId}` },
                    { label: fase.nombre },
                ]}
            />

            <button type="button" className="fase-detalle-volver" onClick={() => navigate(`/proyectos/${proyectoId}`)}>
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
                        {IconoEstado && <IconoEstado size={13} strokeWidth={2.25} className="fase-detalle-estado-icono" />}
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
                    <button type="button" className="fase-detalle-btn-terminar" onClick={handleMarcarTerminada}>
                        Marcar como terminada
                    </button>
                )}
            </div>

            <div className="analisis-kpis">
                <TarjetaKpi titulo="Gastado en esta fase" valor={formatMoneda(kpis.gastadoFase)} destacado />
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
                    onAgregarComprobanteCompra={handleAgregarComprobantesCompra}
                    onEliminarComprobanteCompra={handleEliminarComprobanteCompra}
                    onAgregarNotaCompra={handleAgregarNotaCompra}
                    onVerNotaCompra={getNotaCompra}
                    onEliminarNotaCompra={handleEliminarNotaCompra}
                    onAbrirDetalleCompra={(c) => setDetalle({ tipo: "compra", entidad: c })}
                    gastos={gastosFase}
                    gastosFiltrados={gastosFaseFiltrados}
                    filtrosGastos={filtrosGastos}
                    onCambiarFiltrosGastos={setFiltrosGastos}
                    onNuevoGasto={handleNuevoGasto}
                    onEditarGasto={handleEditarGasto}
                    onEliminarGasto={handleSolicitarEliminarGasto}
                    onVerComprobanteGasto={getComprobanteGasto}
                    onAgregarComprobanteGasto={handleAgregarComprobantesGasto}
                    onEliminarComprobanteGasto={handleEliminarComprobanteGasto}
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
                    onVerComprobante={gastoEditando ? (c) => getComprobanteGasto(gastoEditando.id, c.id) : undefined}
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
                    onVerComprobante={compraEditando ? (c) => getComprobanteCompra(compraEditando.id, c.id) : undefined}
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
