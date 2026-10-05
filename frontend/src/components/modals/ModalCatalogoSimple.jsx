import { useState, useEffect } from "react";
import ModalShell from "./ModalShell";
import { LogoCargando } from "../shared/LogoCargando";
import { validarRequerido } from "../../utils/formValidation";

/**
 * Alta y edición de un registro de catálogo que es sólo un nombre: hoy
 * impuestos y categorías de gasto (ver pages/Catalogos.jsx). Es uno solo a
 * propósito -- los dos formularios son idénticos y lo único que cambia es el
 * texto, que entra por props.
 */
export function ModalCatalogoSimple({ titulo, registro, onGuardar, onCerrar }) {
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
            {guardando ? (
              <>
                <LogoCargando size={14} variante="blanco" />
                Guardando...
              </>
            ) : esEdicion ? (
              "Guardar cambios"
            ) : (
              "Crear"
            )}
          </button>
        </>
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
        {error && <p className="campo-error">{error}</p>}
      </label>
    </ModalShell>
  );
}

export default ModalCatalogoSimple;
