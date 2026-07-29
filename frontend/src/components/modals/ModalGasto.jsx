import { useState, useEffect } from "react";
import { ComprobantesUploader } from "../shared/ComprobantesUploader";
import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import "./ModalGasto.css";

export function ModalGasto({
    gasto,
    categoriasDisponibles = [],
    fasesDisponibles = [],
    faseFija,
    onGuardar,
    onCerrar,
    onVerComprobante,
}) {
    const esEdicion = Boolean(gasto);

    const [form, setForm] = useState({
        descripcion: "",
        monto: "",
        fecha: "",
        tipo_factura: "",
        fase_id: faseFija?.id ?? "",
        categoria_gasto_ids: "",
    });
    const [comprobantesCambios, setComprobantesCambios] = useState({ archivos: [], eliminarIds: [] });
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (gasto) {
            setForm({
                descripcion: gasto.descripcion ?? "",
                monto: gasto.monto ?? "",
                fecha: gasto.fecha ?? "",
                tipo_factura: gasto.tipo_factura ?? "",
                // Si viene de la pantalla de una fase, la fase queda fija aunque
                // el gasto ya tuviera otra cargada (no debería pasar: acá solo se
                // editan gastos que ya son de esta fase).
                fase_id: faseFija?.id ?? gasto.fase_id ?? "",
                categoria_gasto_ids: gasto.categorias?.[0]?.id ?? "",
            });
        }
        setComprobantesCambios({ archivos: [], eliminarIds: [] });
    }, [gasto, faseFija]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const payload = {
            descripcion: form.descripcion,
            monto: Number(form.monto),
            fecha: form.fecha,
            tipo_factura: form.tipo_factura,
            // Con faseFija la fase no se puede tocar desde el form -- se manda
            // siempre la fija, sin depender del estado del selector (que ni se dibuja).
            fase_id: faseFija?.id ?? form.fase_id ?? null,
            categoria_gasto_ids: form.categoria_gasto_ids ? [form.categoria_gasto_ids] : [],
        };

        // proyecto_id no se manda desde acá: Acciones.jsx ya sabe en qué
        // proyecto está parado y lo agrega al crear (GastoUpdate tampoco lo
        // acepta -- no se puede reasignar el proyecto de un gasto existente).

        setGuardando(true);
        try {
            await onGuardar(payload, comprobantesCambios);
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div className="modal-contenido modal-contenido--ancho" onClick={(e) => e.stopPropagation()}>
                <h2>{esEdicion ? "Editar gasto" : "Nuevo gasto"}</h2>

                <form onSubmit={handleSubmit} className="modal-form">
                    <div className="modal-form-seccion">
                        <div className="modal-form-seccion-header">
                            <span>Datos generales</span>
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

                        <div className="modal-form-fila">
                            <label>
                                Monto
                                <input
                                    type="number"
                                    name="monto"
                                    value={form.monto}
                                    onChange={handleChange}
                                    min="0"
                                    step="0.01"
                                    required
                                />
                            </label>

                            <label>
                                Fecha
                                <input
                                    type="date"
                                    name="fecha"
                                    value={form.fecha}
                                    onChange={handleChange}
                                    required
                                />
                            </label>
                        </div>

                        <div className="modal-form-fila">
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

                            {faseFija ? (
                                <label>
                                    Fase
                                    <input type="text" value={faseFija.nombre} disabled readOnly />
                                </label>
                            ) : (
                                fasesDisponibles.length > 0 && (
                                    <label>
                                        Fase (opcional)
                                        <select name="fase_id" value={form.fase_id} onChange={handleChange}>
                                            <option value="">Sin fase (gasto general)</option>
                                            {fasesDisponibles.map((fase) => (
                                                <option key={fase.id} value={fase.id}>
                                                    {fase.nombre}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                )
                            )}
                        </div>

                        {categoriasDisponibles.length > 0 && (
                            <label>
                                Categoría
                                <select
                                    name="categoria_gasto_ids"
                                    value={form.categoria_gasto_ids}
                                    onChange={handleChange}
                                >
                                    <option value="">Sin categoría</option>
                                    {categoriasDisponibles.map((cat) => (
                                        <option key={cat.id} value={cat.id}>
                                            {cat.nombre}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>

                    <div className="modal-form-seccion">
                        <div className="modal-form-seccion-header">
                            <span>Comprobantes</span>
                        </div>
                        <ComprobantesUploader
                            existentes={gasto?.comprobantes ?? []}
                            onVerExistente={onVerComprobante}
                            onCambio={setComprobantesCambios}
                            disabled={guardando}
                        />
                    </div>

                    <div className="modal-acciones">
                        <button type="button" onClick={onCerrar} className="modal-btn-cancelar" disabled={guardando}>
                            Cancelar
                        </button>
                        <button type="submit" className="modal-btn-guardar" disabled={guardando}>
                            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear gasto"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ModalGasto;