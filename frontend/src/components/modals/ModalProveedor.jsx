import { useState, useEffect } from "react";
import "./ModalProveedor.css";
import ModalShell from "./ModalShell";

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
    <ModalShell
      titulo={esEdicion ? "Editar proveedor" : "Nuevo proveedor"}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <>
          <button
            type="button"
            onClick={onCerrar}
            className="btn btn-secondary"
            disabled={guardando}
          >
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? "Guardando..." : esEdicion ? "Guardar cambios" : "Crear proveedor"}
          </button>
        </>
      }
    >
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
    </ModalShell>
  );
}

export default ModalProveedor;
