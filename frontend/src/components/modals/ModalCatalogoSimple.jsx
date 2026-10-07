import { useState, useEffect } from "react";
import { CircleAlert, Tag } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";
import { validarRequerido } from "../../utils/formValidation";

/**
 * Alta y edición de un registro de catálogo que es sólo un nombre: hoy
 * impuestos y categorías de gasto (ver pages/Catalogos.jsx). Es uno solo a
 * propósito -- los dos formularios son idénticos y lo único que cambia es el
 * texto, que entra por props.
 */
export function ModalCatalogoSimple({ titulo, icono = Tag, registro, onGuardar, onCerrar }) {
  const esEdicion = Boolean(registro);

  const [nombre, setNombre] = useState("");
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (registro) {
      setNombre(registro.nombre ?? "");
    }
  }, [registro]);

  const handleChange = (e) => {
    setNombre(e.target.value);
    setError(validarRequerido(e.target.value, "El nombre es obligatorio."));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errorNombre = validarRequerido(nombre, "El nombre es obligatorio.");
    if (errorNombre) {
      setError(errorNombre);
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({ nombre: nombre.trim() });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={titulo}
      icono={icono}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear"}
        />
      }
    >
      <label>
        Nombre
        <input
          type="text"
          name="nombre"
          value={nombre}
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
    </ModalShell>
  );
}

export default ModalCatalogoSimple;
