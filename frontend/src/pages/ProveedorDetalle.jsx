import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Mail, MapPin, Phone, Pencil, Trash2, FileMinus, FilePlus } from "lucide-react";

import {
    getProveedorPorId,
    actualizarProveedor,
    eliminarProveedor,
} from "../services/proveedorService";
import {
    getProductosPorProveedor,
    crearProducto,
    actualizarProducto,
    eliminarProducto,
} from "../services/productoService";
import {
    getCompras,
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
import { getFases } from "../services/faseService";
import { getProyectos } from "../services/proyectoService";
import { getCategorias } from "../services/categoriaService";
import { getImpuestos } from "../services/impuestosService";

import useAuth from "../context/useAuth";
import { getTipoProducto } from "../constants/tipoProducto";
import { formatMoneda, formatFecha } from "../utils/formato";
import { calcularResumenProveedor } from "../utils/proveedores";
import { FILTROS_VACIOS, filtrarCompras } from "../utils/filtros";

import CompraCard from "../components/proyectos/cards/CompraCard";
import ModalProveedor from "../components/modals/ModalProveedor";
import ModalProducto from "../components/modals/ModalProducto";
import ModalCompra from "../components/modals/ModalCompra";
import ModalNota from "../components/modals/ModalNota";
import { Cargando } from "../components/shared/Cargando";
import { TarjetaAlerta } from "../components/shared/TarjetaAlerta";
import FiltrosLista from "../components/shared/FiltrosLista";
import { useToast } from "../context/useToast";

import "../components/proyectos/Acciones.css";
import "../components/proyectos/Seguimiento.css";
import "./ProveedorDetalle.css";

export function ProveedorDetalle() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";
    const toast = useToast();

    const [proveedor, setProveedor] = useState(null);
    const [productos, setProductos] = useState([]);
    const [compras, setCompras] = useState([]);
    const [fases, setFases] = useState([]);
    const [proyectos, setProyectos] = useState([]);
    const [categorias, setCategorias] = useState([]);
    const [impuestos, setImpuestos] = useState([]);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    const [modalProveedorAbierto, setModalProveedorAbierto] = useState(false);
    const [modalProductoAbierto, setModalProductoAbierto] = useState(false);
    const [productoEditando, setProductoEditando] = useState(null);
    const [modalCompraAbierto, setModalCompraAbierto] = useState(false);
    const [compraEditando, setCompraEditando] = useState(null);

    const [modalNotaAbierto, setModalNotaAbierto] = useState(false);
    const [notaCompra, setNotaCompra] = useState(null); // la Compra sobre la que se carga la nota

    const [filtrosCompras, setFiltrosCompras] = useState(FILTROS_VACIOS);

    useEffect(() => {
        fetchTodo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    const fetchTodo = async () => {
        try {
            setCargando(true);
            setError(null);
            const [
                proveedorData,
                productosData,
                comprasData,
                fasesData,
                proyectosData,
                categoriasData,
                impuestosData,
            ] = await Promise.all([
                getProveedorPorId(id),
                getProductosPorProveedor(id),
                getCompras(),
                getFases(),
                getProyectos(),
                getCategorias(),
                getImpuestos(),
            ]);
            setProveedor(proveedorData);
            setProductos(productosData);
            setCompras(comprasData);
            setFases(fasesData);
            setProyectos(proyectosData);
            setCategorias(categoriasData);
            setImpuestos(impuestosData);
        } catch (err) {
            console.error("Error fetching detalle de proveedor:", err);
            setError(err);
        } finally {
            setCargando(false);
        }
    };

    const refetchProductos = async () => {
        setProductos(await getProductosPorProveedor(id));
    };

    const refetchCompras = async () => {
        setCompras(await getCompras());
    };

    const resumen = useMemo(
        () => calcularResumenProveedor(proveedor ?? { id }, { productos, compras }),
        [proveedor, id, productos, compras]
    );

    const comprasDelProveedorFiltradas = useMemo(
        () => filtrarCompras(resumen.comprasDelProveedor, filtrosCompras),
        [resumen.comprasDelProveedor, filtrosCompras]
    );

    const nombreProyecto = (proyectoId) => proyectos.find((p) => p.id === proyectoId)?.nombre;
    const nombreFase = (faseId) => fases.find((f) => f.id === faseId)?.nombre;

    // Lleva la vista a la compra de origen de una nota de crédito -- las
    // compras ya tienen id={`compra-${compra.id}`} en su card (ver CompraCard.jsx).
    const irACompra = (compraId) => {
        document.getElementById(`compra-${compraId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    // Fases etiquetadas con el proyecto al que pertenecen: desde acá no hay un
    // proyecto/fase "actual" como en FaseDetalle, así que hay que poder elegir
    // cualquier fase de cualquier proyecto para la nueva compra.
    const fasesParaSelect = useMemo(
        () => fases.map((f) => ({ id: f.id, nombre: `${nombreProyecto(f.proyecto_id) ?? "?"} — ${f.nombre}` })),
        [fases, proyectos]
    );

    // --- Proveedor ---
    const handleGuardarProveedor = async (datos) => {
        try {
            const actualizado = await actualizarProveedor(id, datos);
            setProveedor(actualizado);
            setModalProveedorAbierto(false);
        } catch (err) {
            console.error("Error guardando proveedor:", err);
            toast.error("No se pudo guardar el proveedor.");
        }
    };

    const handleEliminarProveedor = async () => {
        try {
            await eliminarProveedor(id);
            navigate("/proveedores");
        } catch (err) {
            console.error("Error eliminando proveedor:", err);
            toast.error("No se pudo eliminar el proveedor.");
        }
    };

    // --- Productos ---
    const handleNuevoProducto = () => {
        setProductoEditando(null);
        setModalProductoAbierto(true);
    };

    const handleEditarProducto = (producto) => {
        setProductoEditando(producto);
        setModalProductoAbierto(true);
    };

    const handleGuardarProducto = async (datosForm) => {
        try {
            if (productoEditando) {
                await actualizarProducto(productoEditando.id, datosForm);
            } else {
                await crearProducto({ ...datosForm, proveedor_id: id });
            }
            setModalProductoAbierto(false);
            setProductoEditando(null);
            refetchProductos();
        } catch (err) {
            console.error("Error guardando producto:", err);
            toast.error("No se pudo guardar el producto.");
        }
    };

    const handleEliminarProducto = async (productoId) => {
        try {
            await eliminarProducto(productoId);
            refetchProductos();
        } catch (err) {
            console.error("Error eliminando producto:", err);
            toast.error("No se pudo eliminar el producto.");
        }
    };

    // --- Compras (historial) ---
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
                ...comprobantesCambios.eliminarIds.map((cid) => eliminarComprobanteCompra(compra.id, cid)),
                ...comprobantesCambios.archivos.map((archivo) => subirComprobanteCompra(compra.id, archivo)),
            ]);

            setModalCompraAbierto(false);
            setCompraEditando(null);
            refetchCompras();
        } catch (err) {
            console.error("Error guardando compra:", err);
            toast.error("No se pudo guardar la compra.");
        }
    };

    const handleEliminarCompra = async (compraId) => {
        try {
            await eliminarCompra(compraId);
            refetchCompras();
        } catch (err) {
            console.error("Error eliminando compra:", err);
            toast.error("No se pudo eliminar la compra.");
        }
    };

    const handleToggleEstadoPagoCompra = async (compra) => {
        try {
            const estado_pago = compra.estado_pago === "pagado" ? "pendiente" : "pagado";
            await actualizarCompra(compra.id, { estado_pago });
            refetchCompras();
        } catch (err) {
            console.error("Error actualizando el estado de pago de la compra:", err);
            toast.error("No se pudo actualizar el estado de pago.");
        }
    };

    const handleToggleEstadoEnvioCompra = async (compra) => {
        try {
            const estado_envio = compra.estado_envio === "entregado" ? "pedido" : "entregado";
            await actualizarCompra(compra.id, { estado_envio });
            refetchCompras();
        } catch (err) {
            console.error("Error actualizando el estado de envío de la compra:", err);
            toast.error("No se pudo actualizar el estado de envío.");
        }
    };

    const handleAgregarComprobantesCompra = async (compraId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteCompra(compraId, archivo)));
        refetchCompras();
    };

    const handleEliminarComprobanteCompra = async (compraId, comprobanteId) => {
        await eliminarComprobanteCompra(compraId, comprobanteId);
        refetchCompras();
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
        refetchCompras();
    };

    const handleEliminarNotaCompra = async (compraId, notaId) => {
        await eliminarNotaCompra(compraId, notaId);
        refetchCompras();
    };

    if (cargando) return <Cargando texto="Cargando proveedor..." />;
    if (error || !proveedor) {
        return <div className="proveedor-detalle-vacio">No se pudo cargar el detalle del proveedor.</div>;
    }

    return (
        <div className="proveedor-detalle">
            <button type="button" className="proveedor-detalle-volver" onClick={() => navigate("/proveedores")}>
                <ArrowLeft size={16} strokeWidth={2} />
                Volver a proveedores
            </button>

            <div className="proveedor-detalle-header">
                <div className="proveedor-detalle-header-top">
                    <h1 className="proveedor-detalle-nombre">{proveedor.nombre}</h1>
                    {canManage && (
                        <div className="proveedor-detalle-header-acciones">
                            <button type="button" onClick={() => setModalProveedorAbierto(true)}>
                                <Pencil size={14} strokeWidth={2} />
                                Editar
                            </button>
                            <button type="button" className="proveedor-detalle-btn-eliminar" onClick={handleEliminarProveedor}>
                                <Trash2 size={14} strokeWidth={2} />
                                Eliminar
                            </button>
                        </div>
                    )}
                </div>

                <div className="proveedor-detalle-datos">
                    <span className="proveedor-detalle-dato">CUIT: {proveedor.cuit}</span>
                    {proveedor.telefono && (
                        <span className="proveedor-detalle-dato">
                            <Phone size={15} strokeWidth={2} /> {proveedor.telefono}
                        </span>
                    )}
                    {proveedor.email && (
                        <span className="proveedor-detalle-dato">
                            <Mail size={15} strokeWidth={2} /> {proveedor.email}
                        </span>
                    )}
                    {proveedor.direccion && (
                        <span className="proveedor-detalle-dato">
                            <MapPin size={15} strokeWidth={2} /> {proveedor.direccion}
                        </span>
                    )}
                </div>

                <div className="proveedor-detalle-metricas">
                    <div className="proveedor-detalle-metrica">
                        <span className="proveedor-detalle-metrica-label">Comprado histórico</span>
                        <span className="proveedor-detalle-metrica-valor">{formatMoneda(resumen.totalComprado)}</span>
                    </div>
                    <div className="proveedor-detalle-metrica">
                        <span className="proveedor-detalle-metrica-label">Deuda pendiente</span>
                        <span
                            className="proveedor-detalle-metrica-valor"
                            style={{ color: resumen.deuda > 0 ? "#dc2626" : "#16a34a" }}
                        >
                            {formatMoneda(resumen.deuda)}
                        </span>
                    </div>
                    {resumen.totalNotasCredito > 0 && (
                        <div className="proveedor-detalle-metrica">
                            <span className="proveedor-detalle-metrica-label">Notas de crédito</span>
                            <span className="proveedor-detalle-metrica-valor" style={{ color: "#dc2626" }}>
                                -{formatMoneda(resumen.totalNotasCredito)}
                            </span>
                        </div>
                    )}
                    {resumen.totalNotasDebito > 0 && (
                        <div className="proveedor-detalle-metrica">
                            <span className="proveedor-detalle-metrica-label">Notas de débito</span>
                            <span className="proveedor-detalle-metrica-valor" style={{ color: "#c2662d" }}>
                                +{formatMoneda(resumen.totalNotasDebito)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {resumen.notas.length > 0 && (
                <div className="proveedor-detalle-seccion">
                    <div className="proveedor-detalle-seccion-header">
                        <h2>Notas de crédito / débito</h2>
                    </div>
                    <div className="seguimiento-lista">
                        {resumen.notas.map((nota) => {
                            const esCredito = nota.tipo === "nota_credito";
                            return (
                                <TarjetaAlerta
                                    key={nota.id}
                                    icono={esCredito ? FileMinus : FilePlus}
                                    color={esCredito ? "#dc2626" : "#c2662d"}
                                    titulo={nota.origenDescripcion}
                                    detalle={`Compra del ${formatFecha(nota.origenFecha)}`}
                                    monto={`${esCredito ? "-" : "+"}${formatMoneda(nota.monto)}`}
                                    onClick={() => irACompra(nota.origenId)}
                                />
                            );
                        })}
                    </div>
                </div>
            )}

            <div className="proveedor-detalle-seccion">
                <div className="proveedor-detalle-seccion-header">
                    <h2>Catálogo de productos</h2>
                    {canManage && <button onClick={handleNuevoProducto}>Nuevo producto</button>}
                </div>

                {productos.length === 0 ? (
                    <p>Este proveedor todavía no tiene productos cargados.</p>
                ) : (
                    <div className="proveedor-detalle-tabla-wrap">
                        <table className="proveedor-detalle-tabla">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Tipo</th>
                                    <th>Categorías</th>
                                    <th>Precio</th>
                                    {canManage && <th />}
                                </tr>
                            </thead>
                            <tbody>
                                {productos.map((producto) => {
                                    const tipo = getTipoProducto(producto.tipo);
                                    return (
                                        <tr key={producto.id}>
                                            <td>{producto.marca} {producto.modelo}</td>
                                            <td>
                                                <span
                                                    className="proveedor-detalle-badge"
                                                    style={{ color: tipo.color, backgroundColor: `${tipo.color}1c` }}
                                                >
                                                    {tipo.icono && <tipo.icono size={12} strokeWidth={2.25} />} {tipo.label}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="proveedor-detalle-chips">
                                                    {(producto.categorias ?? []).map((c) => (
                                                        <span key={c.id} className="proveedor-detalle-chip">
                                                            {c.nombre}
                                                        </span>
                                                    ))}
                                                </div>
                                            </td>
                                            <td>{formatMoneda(producto.precio)}</td>
                                            {canManage && (
                                                <td className="proveedor-detalle-tabla-acciones">
                                                    <button type="button" onClick={() => handleEditarProducto(producto)}>
                                                        Editar
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="proveedor-detalle-btn-eliminar-texto"
                                                        onClick={() => handleEliminarProducto(producto.id)}
                                                    >
                                                        Eliminar
                                                    </button>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="acciones-seccion">
                <div className="acciones-header">
                    <h2>Historial de compras</h2>
                    {canManage && <button onClick={handleNuevaCompra}>Nueva compra</button>}
                </div>

                {resumen.comprasDelProveedor.length > 0 && (
                    <FiltrosLista
                        filtros={filtrosCompras}
                        onCambiar={setFiltrosCompras}
                        mostrarNotas
                        mostrarEstadoPago
                        mostrarEstadoEnvio
                    />
                )}

                {resumen.comprasDelProveedor.length === 0 ? (
                    <p>Todavía no hay compras registradas a este proveedor.</p>
                ) : comprasDelProveedorFiltradas.length === 0 ? (
                    <p>Ninguna compra coincide con los filtros.</p>
                ) : (
                    <div className="acciones-grid">
                        {comprasDelProveedorFiltradas.map((compra) => (
                            <CompraCard
                                key={compra.id}
                                compra={compra}
                                faseNombre={nombreFase(compra.fase_id)}
                                proveedorNombre={proveedor.nombre}
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
                            />
                        ))}
                    </div>
                )}
            </div>

            {modalProveedorAbierto && (
                <ModalProveedor
                    proveedor={proveedor}
                    onGuardar={handleGuardarProveedor}
                    onCerrar={() => setModalProveedorAbierto(false)}
                />
            )}

            {modalProductoAbierto && (
                <ModalProducto
                    producto={productoEditando}
                    proveedor={proveedor}
                    categoriasDisponibles={categorias}
                    onGuardar={handleGuardarProducto}
                    onCerrar={() => setModalProductoAbierto(false)}
                />
            )}

            {modalCompraAbierto && (
                <ModalCompra
                    compra={compraEditando}
                    fasesDisponibles={fasesParaSelect}
                    proveedorFijo={proveedor}
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
        </div>
    );
}

export default ProveedorDetalle;
