import { useState, useEffect } from "react";
import ModalShell from "./ModalShell";
import { LogoCargando } from "../shared/LogoCargando";
import { TIPOS_PRODUCTO } from "../../constants/tipoProducto";
import { validarRequerido } from "../../utils/formValidation";

const TIPO_DEFAULT = "materiales";

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
      titulo={esEdicion ? "Editar categoría de producto" : "Nueva categoría de producto"}
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
              "Crear categoría"
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
          value={form.nombre}
          onChange={handleChange}
          maxLength={100}
          required
        />
        {error && <p className="campo-error">{error}</p>}
      </label>

      <label>
        Tipo
        <select name="tipo" value={form.tipo} onChange={handleChange}>
          {Object.entries(TIPOS_PRODUCTO).map(([valor, info]) => (
            <option key={valor} value={valor}>
              {info.label}
            </option>
          ))}
        </select>
      </label>
    </ModalShell>
  );
}

export default ModalCategoria;
