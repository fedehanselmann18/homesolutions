import { useState, useEffect } from "react";
import { Mail, MapPin, Phone, Truck } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";

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
        cuit: form.cuit || null,
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
      icono={Truck}
      contexto={esEdicion ? proveedor.nombre : undefined}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear proveedor"}
        />
      }
    >
      <label>
        Nombre
        <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required />
      </label>

      <label>
        <span>
          CUIT/CUIL <span className="label-campo__opcional">(opcional)</span>
        </span>
        <input
          type="text"
          name="cuit"
          value={form.cuit}
          onChange={handleChange}
          placeholder="XX-XXXXXXXX-X"
        />
      </label>

      <label>
        <span>
          Dirección <span className="label-campo__opcional">(opcional)</span>
        </span>
        <div className="campo">
          <MapPin aria-hidden="true" />
          <input type="text" name="direccion" value={form.direccion} onChange={handleChange} />
        </div>
      </label>

      <div className="modal-form-fila">
        <label>
          <span>
            Teléfono <span className="label-campo__opcional">(opcional)</span>
          </span>
          <div className="campo">
            <Phone aria-hidden="true" />
            <input type="tel" name="telefono" value={form.telefono} onChange={handleChange} />
          </div>
        </label>

        <label>
          <span>
            Email <span className="label-campo__opcional">(opcional)</span>
          </span>
          <div className="campo">
            <Mail aria-hidden="true" />
            <input type="email" name="email" value={form.email} onChange={handleChange} />
          </div>
        </label>
      </div>
    </ModalShell>
  );
}

export default ModalProveedor;
