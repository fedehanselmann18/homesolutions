import { useState, useEffect } from "react";
import ModalShell from "./ModalShell";
import { LogoCargando } from "../shared/LogoCargando";

const ESTADOS_OPCIONES = [
  { value: "a_iniciar", label: "A iniciar" },
  { value: "en_curso", label: "En curso" },
  { value: "terminado", label: "Terminado" },
];

export function ModalProyecto({ proyecto, onGuardar, onCerrar }) {
  const esEdicion = Boolean(proyecto);

  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    fecha_inicio: "",
    estado: "a_iniciar",
    precio_acordado: "",
  });
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (proyecto) {
      setForm({
        nombre: proyecto.nombre ?? "",
        direccion: proyecto.direccion ?? "",
        fecha_inicio: proyecto.fecha_inicio ?? "",
        estado: proyecto.estado ?? "a_iniciar",
        precio_acordado: proyecto.precio_acordado ?? "",
      });
    }
  }, [proyecto]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({
        ...form,
        precio_acordado: Number(form.precio_acordado),
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={esEdicion ? "Editar proyecto" : "Nuevo proyecto"}
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
              "Crear proyecto"
            )}
          </button>
        </>
      }
    >
      <label>
        Nombre
        <input type="text" name="nombre" value={form.nombre} onChange={handleChange} required />
      </label>

      <label>
        Dirección
        <input
          type="text"
          name="direccion"
          value={form.direccion}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Fecha de inicio
        <input
          type="date"
          name="fecha_inicio"
          value={form.fecha_inicio}
          onChange={handleChange}
          required
        />
      </label>

      <label>
        Estado
        <select name="estado" value={form.estado} onChange={handleChange}>
          {ESTADOS_OPCIONES.map((op) => (
            <option key={op.value} value={op.value}>
              {op.label}
            </option>
          ))}
        </select>
      </label>

      <label>
        Precio acordado
        <input
          type="number"
          name="precio_acordado"
          value={form.precio_acordado}
          onChange={handleChange}
          min="0"
          step="0.01"
          required
        />
      </label>
    </ModalShell>
  );
}

export default ModalProyecto;
