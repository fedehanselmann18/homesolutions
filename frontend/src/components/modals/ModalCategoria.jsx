import { useState, useEffect } from "react";
import { CircleAlert, Tag } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";
import { ControlOpcion } from "../shared/ControlOpcion";
import { TIPOS_PRODUCTO } from "../../constants/tipoProducto";
import { validarRequerido } from "../../utils/formValidation";

const TIPO_DEFAULT = "materiales";

const OPCIONES_TIPO = Object.entries(TIPOS_PRODUCTO).map(([valor, info]) => ({
  valor,
  label: info.label,
  icono: info.icono,
}));

export function ModalCategoria({ categoria, onGuardar, onCerrar }) {
  const esEdicion = Boolean(categoria);

  const [form, setForm] = useState({ nombre: "", tipo: TIPO_DEFAULT });
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (categoria) {
      setForm({
        nombre: categoria.nombre ?? "",
        tipo: categoria.tipo ?? TIPO_DEFAULT,
      });
    }
  }, [categoria]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "nombre") setError(validarRequerido(value, "El nombre es obligatorio."));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errorNombre = validarRequerido(form.nombre, "El nombre es obligatorio.");
    if (errorNombre) {
      setError(errorNombre);
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({ nombre: form.nombre.trim(), tipo: form.tipo });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={esEdicion ? "Editar categoría" : "Nueva categoría"}
      etiqueta={esEdicion ? "Editar categoría de producto" : "Nueva categoría de producto"}
      icono={Tag}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear categoría"}
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
          maxLength={100}
          required
        />
        {error && (
          <p className="campo-error">
            <CircleAlert aria-hidden="true" />
            {error}
          </p>
        )}
      </label>

      <ControlOpcion
        etiqueta="Tipo de producto"
        opciones={OPCIONES_TIPO}
        valor={form.tipo}
        onCambiar={(tipo) => setForm((prev) => ({ ...prev, tipo }))}
        variante="segmentado"
        disabled={guardando}
      />
    </ModalShell>
  );
}

export default ModalCategoria;
