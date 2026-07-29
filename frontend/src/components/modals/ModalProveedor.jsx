import { useState, useEffect } from "react";
import "./ModalProveedor.css";

export function ModalProveedor({ proveedor, onGuardar, onCerrar }) {
    const esEdicion = Boolean(proveedor);

    const [form, setForm] = useState({
        nombre: "",
        cuit: "",
        direccion: "",
        telefono: "",
        email: "",
    });
    const [guardando, setGuardando] = useState(false);

    useEffect(() => {
        if (proveedor) {
            setForm({
                nombre: proveedor.nombre ?? "",
                cuit: proveedor.cuit ?? "",
                direccion: proveedor.direccion ?? "",
                telefono: proveedor.telefono ?? "",
                email: proveedor.email ?? "",
            });
        }
    }, [proveedor]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setGuardando(true);
        try {
            await onGuardar({
                nombre: form.nombre,
                cuit: form.cuit,
                direccion: form.direccion || null,
                telefono: form.telefono || null,
                email: form.email || null,
            });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="modal-overlay" onClick={onCerrar}>
            <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
                <h2>{esEdicion ? "Editar proveedor" : "Nuevo proveedor"}</h2>

                <form onSubmit={handleSubmit} className="modal-form">
                    <label>
                        Nombre
                        <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required />
                    </label>

                    <label>
                        CUIT
                        <input type="text" name="cuit" value={form.cuit} onChange={handleChange} required />
                    </label>

                    <label>
                        Dirección
                        <input type="text" name="direccion" value={form.direccion} onChange={handleChange} />
                    </label>

                    <div className="modal-form-fila">
                        <label>
                            Teléfono
                            <input type="text" name="telefono" value={form.telefono} onChange={handleChange} />
                        </label>

                        <label>
                            Email
                            <input type="email" name="email" value={form.email} onChange={handleChange} />
                        </label>
                    </div>

                    <div className="modal-acciones">
                        <button type="button" onClick={onCerrar} className="modal-btn-cancelar" disabled={guardando}>
                            Cancelar
                        </button>
                        <button type="submit" className="modal-btn-guardar" disabled={guardando}>
                            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear proveedor"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default ModalProveedor;
