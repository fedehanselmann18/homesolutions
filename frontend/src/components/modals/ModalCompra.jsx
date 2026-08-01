import { useState, useEffect } from "react";
import { X, Sparkles } from "lucide-react";
import { ComprobantesUploader } from "../shared/ComprobantesUploader";
import { formatMoneda } from "../../utils/formato";
import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import { getTipoProducto } from "../../constants/tipoProducto";
import { getCondicionPagoLabel } from "../../constants/estadoCompra";
import { useExtraccionIA } from "../../hooks/useExtraccionIA";
import { useToast } from "../../context/useToast";
import "./ModalCompra.css";

const CONDICION_PAGO_OPCIONES = ["contado", "cuenta_corriente", "cheque", "transferencia"];
const ESTADO_PAGO_OPCIONES = [
    { value: "pendiente", label: "Pendiente" },
    { value: "pagado", label: "Pagado" },
];
const ESTADO_ENVIO_OPCIONES = [
    { value: "pedido", label: "Pedido" },
    { value: "entregado", label: "Entregado" },
];

let contadorFilaTemp = 0;
const nuevaFilaId = () => `tmp-${++contadorFilaTemp}`;

export function ModalCompra({
    compra,
    fasesDisponibles = [],
    faseFija,
    proveedores = [],
    proveedorFijo,
    productosDisponibles = [],
    impuestosDisponibles = [],
    onGuardar,
    onCerrar,
    onVerComprobante,
}) {
    const esEdicion = Boolean(compra);

    const [form, setForm] = useState({
        fase_id: faseFija?.id ?? "",
        proveedor_id: proveedorFijo?.id ?? "",
        descripcion: "",
        tipo_factura: "",
        fecha: "",
        condicion_pago: "",
        estado_pago: "pendiente",
        estado_envio: "pedido",
    });
    const [detalle, setDetalle] = useState([]);
    const [impuestos, setImpuestos] = useState([]);
    const [comprobantesCambios, setComprobantesCambios] = useState({ archivos: [], eliminarIds: [] });
    const [guardando, setGuardando] = useState(false);
    const { extraer, extrayendo } = useExtraccionIA();
    const toast = useToast();

    useEffect(() => {
        if (compra) {
            setForm({
                // Con faseFija/proveedorFijo esos campos no se pueden cambiar desde
                // acá (ver más abajo, donde el selector se reemplaza por texto fijo).
                fase_id: faseFija?.id ?? compra.fase_id ?? "",
                proveedor_id: proveedorFijo?.id ?? compra.proveedor_id ?? "",
                descripcion: compra.descripcion ?? "",
                tipo_factura: compra.tipo_factura ?? "",
                fecha: compra.fecha ?? "",
                condicion_pago: compra.condicion_pago ?? "",
                estado_pago: compra.estado_pago ?? "pendiente",
                estado_envio: compra.estado_envio ?? "pedido",
            });
            setDetalle(
                (compra.detalle ?? []).map((d) => ({
                    _id: nuevaFilaId(),
                    producto_id: d.producto_id,
                    cantidad: d.cantidad,
                    precio_unitario: d.precio_unitario,
                }))
            );
            setImpuestos(
                (compra.impuestos_aplicados ?? []).map((i) => ({
                    _id: nuevaFilaId(),
                    impuesto_id: i.impuesto_id,
                    monto: i.monto,
                }))
            );
        }
        setComprobantesCambios({ archivos: [], eliminarIds: [] });
    }, [compra, faseFija, proveedorFijo]);

    const productosDelProveedor = productosDisponibles.filter(
        (p) => p.proveedor_id === form.proveedor_id
    );

    // Precio neto y total NO se cargan a mano: se calculan solos a partir de
    // las líneas de producto (cantidad x precio unitario) y los impuestos
    // cargados, así nunca queda un total desactualizado respecto al detalle.
    const precioNeto = detalle.reduce(
        (acc, fila) => acc + (Number(fila.cantidad) || 0) * (Number(fila.precio_unitario) || 0),
        0
    );
    const totalImpuestos = impuestos.reduce((acc, fila) => acc + (Number(fila.monto) || 0), 0);
    const precioTotal = precioNeto + totalImpuestos;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));

        // Las líneas de detalle quedan atadas a un proveedor -- si cambia,
        // los productos ya elegidos dejan de tener sentido.
        if (name === "proveedor_id") {
            setDetalle([]);
        }
    };

    // Toma el primer comprobante recién arrastrado/seleccionado (todavía sin
    // subir) y le pide a la IA que lo lea. precio_neto sigue sin tocarse a
    // mano (se calcula solo de las líneas de detalle) pero, si la IA logra
    // identificar el proveedor Y reconoce productos de SU catálogo en la
    // factura, agrega esas líneas -- con la cantidad que leyó y el precio
    // de catálogo del producto (nunca un precio leído de la factura).
    const handleAutocompletarIA = async () => {
        const archivo = comprobantesCambios.archivos[0];
        if (!archivo) return;

        try {
            const resultado = await extraer(archivo, "compra", {
                fases: fasesDisponibles.map((f) => ({ id: f.id, nombre: f.nombre })),
                proveedores: proveedores.map((p) => ({ id: p.id, nombre: p.nombre, cuit: p.cuit })),
                productos: productosDisponibles.map((p) => ({
                    id: p.id,
                    marca: p.marca,
                    modelo: p.modelo,
                    proveedor_id: p.proveedor_id,
                })),
                impuestos: impuestosDisponibles.map((i) => ({ id: i.id, nombre: i.nombre })),
            });

            const proveedorResuelto = proveedorFijo?.id ?? resultado.proveedor_id ?? form.proveedor_id;

            setForm((prev) => ({
                ...prev,
                descripcion: resultado.descripcion ?? prev.descripcion,
                fecha: resultado.fecha ?? prev.fecha,
                tipo_factura: resultado.tipo_factura ?? prev.tipo_factura,
                fase_id: faseFija ? prev.fase_id : resultado.fase_id ?? prev.fase_id,
                proveedor_id: proveedorFijo ? prev.proveedor_id : resultado.proveedor_id ?? prev.proveedor_id,
            }));

            if (resultado.detalle?.length) {
                const productosDeEseProveedor = productosDisponibles.filter(
                    (p) => p.proveedor_id === proveedorResuelto
                );
                const filasNuevas = resultado.detalle
                    .map((linea) => {
                        const producto = productosDeEseProveedor.find((p) => p.id === linea.producto_id);
                        if (!producto) return null;
                        return {
                            _id: nuevaFilaId(),
                            producto_id: producto.id,
                            cantidad: linea.cantidad,
                            precio_unitario: producto.precio,
                        };
                    })
                    .filter(Boolean);
                if (filasNuevas.length) {
                    setDetalle((prev) => [...prev, ...filasNuevas]);
                }
            }

            if (resultado.impuestos?.length) {
                const filasImpuestos = resultado.impuestos.map((linea) => ({
                    _id: nuevaFilaId(),
                    impuesto_id: linea.impuesto_id,
                    monto: linea.monto,
                }));
                setImpuestos((prev) => [...prev, ...filasImpuestos]);
            }

            if (resultado.advertencias?.length) {
                resultado.advertencias.forEach((a) => toast.error(a));
            } else {
                toast.success("Comprobante leído. Revisá los datos antes de guardar.");
            }
        } catch (err) {
            toast.error(err?.response?.data?.detail ?? "No se pudo leer el comprobante con IA");
        }
    };

    // --- Detalle (productos) ---
    const agregarFilaDetalle = () => {
        setDetalle((prev) => [
            ...prev,
            { _id: nuevaFilaId(), producto_id: "", cantidad: "", precio_unitario: "" },
        ]);
    };

    const actualizarFilaDetalle = (id, campo, valor) => {
        setDetalle((prev) =>
            prev.map((fila) => (fila._id === id ? { ...fila, [campo]: valor } : fila))
        );
    };

    // El precio unitario no se tipea: es el precio de catálogo del producto
    // elegido (Producto.precio) -- acá se "congela" en la línea de la compra,
    // así después no cambia si el proveedor actualiza su lista de precios.
    const seleccionarProducto = (id, productoId) => {
        const producto = productosDelProveedor.find((p) => p.id === productoId);
        setDetalle((prev) =>
            prev.map((fila) =>
                fila._id === id
                    ? { ...fila, producto_id: productoId, precio_unitario: producto?.precio ?? "" }
                    : fila
            )
        );
    };

    const eliminarFilaDetalle = (id) => {
        setDetalle((prev) => prev.filter((fila) => fila._id !== id));
    };

    // --- Impuestos ---
    const agregarFilaImpuesto = () => {
        setImpuestos((prev) => [...prev, { _id: nuevaFilaId(), impuesto_id: "", monto: "" }]);
    };

    const actualizarFilaImpuesto = (id, campo, valor) => {
        setImpuestos((prev) =>
            prev.map((fila) => (fila._id === id ? { ...fila, [campo]: valor } : fila))
        );
    };

    const eliminarFilaImpuesto = (id) => {
        setImpuestos((prev) => prev.filter((fila) => fila._id !== id));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await onGuardar(
                {
                    ...form,
                    fase_id: faseFija?.id ?? form.fase_id,
                    proveedor_id: proveedorFijo?.id ?? form.proveedor_id,
                    precio_neto: precioNeto,
                    detalle: detalle
                        .filter((f) => f.producto_id)
                        .map((f) => ({
                            producto_id: f.producto_id,
                            cantidad: Number(f.cantidad),
                            precio_unitario: Number(f.precio_unitario),
                        })),
                    impuestos: impuestos
                        .filter((f) => f.impuesto_id)
                        .map((f) => ({
                            impuesto_id: f.impuesto_id,
                            monto: Number(f.monto),
                        })),
                },
                comprobantesCambios
            );
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div className="modal-contenido modal-contenido--ancho" onClick={(e) => e.stopPropagation()}>
                <h2>{esEdicion ? "Editar compra" : "Nueva compra"}</h2>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="modal-form-seccion modal-form-seccion--ia">
                        <div className="modal-form-seccion-header">
                            <span>Comprobantes</span>
                        </div>
                        <ComprobantesUploader
                            existentes={compra?.comprobantes ?? []}
                            onVerExistente={onVerComprobante}
                            onCambio={setComprobantesCambios}
                            disabled={guardando}
                        />
                        <button
                            type="button"
                            className="modal-btn-ia"
                            onClick={handleAutocompletarIA}
                            disabled={guardando || extrayendo || comprobantesCambios.archivos.length === 0}
                            title={
                                comprobantesCambios.archivos.length === 0
                                    ? "Primero arrastrá o elegí un comprobante"
                                    : "Leer el comprobante y prellenar proveedor/fase/fecha/tipo de factura/productos"
                            }
                        >
                            <Sparkles size={16} strokeWidth={2.25} />
                            {extrayendo ? "Leyendo comprobante..." : "Autocompletar con IA"}
                        </button>
                    </div>

                    <div className="modal-form-seccion">
                        <div className="modal-form-seccion-header">
                            <span>Datos generales</span>
                        </div>

                        <div className="modal-form-fila">
                            {faseFija ? (
                                <label>
                                    Fase
                                    <input type="text" value={faseFija.nombre} disabled readOnly />
                                </label>
                            ) : (
                                <label>
                                    Fase
                                    <select name="fase_id" value={form.fase_id} onChange={handleChange} required>
                                        <option value="">Seleccionar fase...</option>
                                        {fasesDisponibles.map((fase) => (
                                            <option key={fase.id} value={fase.id}>
                                                {fase.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}

                            {proveedorFijo ? (
                                <label>
                                    Proveedor
                                    <input type="text" value={proveedorFijo.nombre} disabled readOnly />
                                </label>
                            ) : (
                                <label>
                                    Proveedor
                                    <select name="proveedor_id" value={form.proveedor_id} onChange={handleChange} required>
                                        <option value="">Seleccionar proveedor...</option>
                                        {proveedores.map((prov) => (
                                            <option key={prov.id} value={prov.id}>
                                                {prov.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </label>
                            )}
                        </div>

                        <label>
                            Descripción
                            <input
                                type="text"
                                name="descripcion"
                                value={form.descripcion}
                                onChange={handleChange}
                                required
                            />
                        </label>

                        <label>
                            Fecha
                            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
                        </label>
                    </div>

                    <div className="modal-form-seccion">
                        <div className="modal-form-seccion-header">
                            <span>Condiciones</span>
                        </div>

                        <div className="modal-form-fila">
                            <div className="modal-form-calculado">
                                <span className="modal-form-calculado-label">Precio neto (calculado)</span>
                                <span className="modal-form-calculado-valor">{formatMoneda(precioNeto)}</span>
                            </div>

                            <label>
                                Tipo de factura
                                <select
                                    name="tipo_factura"
                                    value={form.tipo_factura}
                                    onChange={handleChange}
                                    required
                                >
                                    <option value="" disabled>
                                        Selecciona un tipo de factura
                                    </option>
                                    {TIPOS_FACTURA.map((tipo) => (
                                        <option key={tipo.value} value={tipo.value}>
                                            {tipo.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <div className="modal-form-fila">
                            <label>
                                Condición de pago
                                <select name="condicion_pago" value={form.condicion_pago} onChange={handleChange} required>
                                    <option value="">Seleccionar...</option>
                                    {CONDICION_PAGO_OPCIONES.map((op) => (
                                        <option key={op} value={op}>
                                            {getCondicionPagoLabel(op)}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label>
                                Estado de pago
                                <select name="estado_pago" value={form.estado_pago} onChange={handleChange}>
                                    {ESTADO_PAGO_OPCIONES.map((op) => (
                                        <option key={op.value} value={op.value}>
                                            {op.label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <label>
                            Estado de envío
                            <select name="estado_envio" value={form.estado_envio} onChange={handleChange}>
                                {ESTADO_ENVIO_OPCIONES.map((op) => (
                                    <option key={op.value} value={op.value}>
                                        {op.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    {/* Detalle de productos */}
                    <div className="modal-form-seccion">
                        <div className="modal-form-seccion-header">
                            <span>Productos</span>
                            <button
                                type="button"
                                className="modal-btn-agregar-fila"
                                onClick={agregarFilaDetalle}
                                disabled={!form.proveedor_id}
                            >
                                + Agregar producto
                            </button>
                        </div>

                        {!form.proveedor_id && (
                            <p className="modal-form-seccion-vacio">Elegí un proveedor primero.</p>
                        )}

                        {detalle.length > 0 && (
                            <div className="modal-form-fila-dinamica modal-form-fila-dinamica--detalle modal-form-fila-dinamica--headers">
                                <span>Producto</span>
                                <span>Cantidad</span>
                                <span>Precio unit.</span>
                                <span>Subtotal</span>
                                <span />
                            </div>
                        )}

                        {detalle.map((fila) => {
                            const productoElegido = productosDelProveedor.find((p) => p.id === fila.producto_id);
                            const tipoProducto = productoElegido ? getTipoProducto(productoElegido.tipo) : null;
                            return (
                            <div key={fila._id} className="modal-form-fila-dinamica modal-form-fila-dinamica--detalle">
                                <div className="modal-form-fila-dinamica-producto">
                                    <select
                                        value={fila.producto_id}
                                        onChange={(e) => seleccionarProducto(fila._id, e.target.value)}
                                        required
                                    >
                                        <option value="">Producto...</option>
                                        {productosDelProveedor.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {p.marca} {p.modelo}
                                            </option>
                                        ))}
                                    </select>
                                    {tipoProducto && (
                                        <span
                                            className="modal-form-fila-dinamica-tipo"
                                            style={{ color: tipoProducto.color, backgroundColor: `${tipoProducto.color}1c` }}
                                        >
                                            {tipoProducto.icono && <tipoProducto.icono size={12} strokeWidth={2.25} />} {tipoProducto.label}
                                        </span>
                                    )}
                                </div>
                                <input
                                    type="number"
                                    placeholder="Cantidad"
                                    value={fila.cantidad}
                                    onChange={(e) => actualizarFilaDetalle(fila._id, "cantidad", e.target.value)}
                                    min="0"
                                    step="0.01"
                                    required
                                />
                                <span className="modal-form-fila-dinamica-precio" title="Precio de catálogo, no se puede editar">
                                    {fila.producto_id ? formatMoneda(Number(fila.precio_unitario) || 0) : "—"}
                                </span>
                                <span className="modal-form-fila-dinamica-subtotal">
                                    {fila.producto_id
                                        ? formatMoneda((Number(fila.cantidad) || 0) * (Number(fila.precio_unitario) || 0))
                                        : "—"}
                                </span>
                                <button
                                    type="button"
                                    className="modal-btn-quitar-fila"
                                    onClick={() => eliminarFilaDetalle(fila._id)}
                                >
                                    <X size={14} strokeWidth={2.25} />
                                </button>
                            </div>
                            );
                        })}
                        {form.proveedor_id && detalle.length === 0 && (
                            <p className="modal-form-seccion-vacio">Sin productos cargados todavía.</p>
                        )}
                    </div>

                    {/* Impuestos */}
                    <div className="modal-form-seccion">
                        <div className="modal-form-seccion-header">
                            <span>Impuestos</span>
                            <button type="button" className="modal-btn-agregar-fila" onClick={agregarFilaImpuesto}>
                                + Agregar impuesto
                            </button>
                        </div>

                        {impuestos.map((fila) => (
                            <div key={fila._id} className="modal-form-fila-dinamica modal-form-fila-dinamica--2col">
                                <select
                                    value={fila.impuesto_id}
                                    onChange={(e) => actualizarFilaImpuesto(fila._id, "impuesto_id", e.target.value)}
                                    required
                                >
                                    <option value="">Impuesto...</option>
                                    {impuestosDisponibles.map((imp) => (
                                        <option key={imp.id} value={imp.id}>
                                            {imp.nombre}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="number"
                                    placeholder="Monto"
                                    value={fila.monto}
                                    onChange={(e) => actualizarFilaImpuesto(fila._id, "monto", e.target.value)}
                                    min="0"
                                    step="0.01"
                                    required
                                />
                                <button
                                    type="button"
                                    className="modal-btn-quitar-fila"
                                    onClick={() => eliminarFilaImpuesto(fila._id)}
                                >
                                    <X size={14} strokeWidth={2.25} />
                                </button>
                            </div>
                        ))}
                        {impuestos.length === 0 && (
                            <p className="modal-form-seccion-vacio">Sin impuestos cargados todavía.</p>
                        )}
                    </div>

                    <div className="modal-form-resumen">
                        <div className="modal-form-resumen-fila">
                            <span>Neto</span>
                            <span>{formatMoneda(precioNeto)}</span>
                        </div>
                        <div className="modal-form-resumen-fila">
                            <span>Impuestos</span>
                            <span>{formatMoneda(totalImpuestos)}</span>
                        </div>
                        <div className="modal-form-resumen-fila modal-form-resumen-fila--total">
                            <span>Total</span>
                            <span>{formatMoneda(precioTotal)}</span>
                        </div>
                    </div>

                    <div className="modal-acciones">
                        <button type="button" onClick={onCerrar} className="modal-btn-cancelar" disabled={guardando}>
                            Cancelar
                        </button>
                        <button type="submit" className="modal-btn-guardar" disabled={guardando}>
                            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear compra"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ModalCompra;
