import { useState, useEffect } from "react";
import { Mail, MapPin, Phone, Truck } from "lucide-react";

import { avisoFaltantes, validarRequerido } from "../../utils/formValidation";
import { ErrorCampo } from "../shared/ErrorCampo";
import ModalShell, { AccionesFormulario } from "./ModalShell";

// El email es opcional, pero si se escribe tiene que poder usarse.
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validarCampo = (name, value) => {
  if (name === "nombre") return validarRequerido(value, "Escribí el nombre del proveedor.");
  if (name === "email" && value && !EMAIL_VALIDO.test(value)) return "Revisá el email.";
  return null;
};

const ETIQUETAS = { nombre: "Nombre", email: "Email" };

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
  const [errores, setErrores] = useState({});
  const [intentoGuardar, setIntentoGuardar] = useState(false);

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
    // Como en gasto y compra: un campo que ya marcó error se revalida al
    // escribir, para que el error se vaya apenas se corrige.
    if (errores[name] || intentoGuardar) {
      setErrores((prev) => ({ ...prev, [name]: validarCampo(name, value) }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nuevosErrores = Object.fromEntries(
      Object.keys(ETIQUETAS).map((campo) => [campo, validarCampo(campo, form[campo])])
    );
    setErrores(nuevosErrores);
    setIntentoGuardar(true);
    if (Object.values(nuevosErrores).some(Boolean)) return;

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

  const faltantes = Object.keys(ETIQUETAS)
    .filter((campo) => errores[campo])
    .map((campo) => ETIQUETAS[campo]);

  return (
    <ModalShell
      titulo={esEdicion ? "Editar proveedor" : "Nuevo proveedor"}
      icono={Truck}
      contexto={esEdicion ? proveedor.nombre : undefined}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      validacionPropia
      aviso={avisoFaltantes(faltantes)}
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
        <input
          type="text"
          name="nombre"
          value={form.nombre}
          onChange={handleChange}
          placeholder="Ej: CobreSur Materiales"
          aria-invalid={errores.nombre ? true : undefined}
          className={errores.nombre ? "campo--error" : undefined}
          required
        />
        <ErrorCampo texto={errores.nombre} />
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
          <div className={`campo${errores.email ? " campo--error" : ""}`}>
            <Mail aria-hidden="true" />
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              aria-invalid={errores.email ? true : undefined}
            />
          </div>
          <ErrorCampo texto={errores.email} />
        </label>
      </div>
    </ModalShell>
  );
}

export default ModalProveedor;
