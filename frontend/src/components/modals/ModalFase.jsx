import { useState, useEffect } from "react";
import "./ModalFase.css";

const ESTADOS_OPCIONES = [
  { value: "por_empezar", label: "Por empezar" },
  { value: "en_curso", label: "En curso" },
  { value: "terminada", label: "Terminada" },
  { value: "auditada", label: "Auditada" },
];

export function ModalFase({ fase, onGuardar, onCerrar }) {
  const esEdicion = Boolean(fase);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    estado: "por_empezar",
  });

  useEffect(() => {
    if (fase) {
      setForm({
        nombre: fase.nombre ?? "",
        descripcion: fase.descripcion ?? "",
        estado: fase.estado ?? "por_empezar",
      });
    }
  }, [fase]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    // Ojo: proyecto_id no se maneja acá. Si es creación (FaseCreate),
    // el componente padre debe agregarlo antes de llamar al service:
    // onGuardar({ ...form, proyecto_id: proyectoId })
    onGuardar(form);
  };

  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenido" onClick={(e) => e.stopPropagation()}>
        <h2>{esEdicion ? "Editar fase" : "Nueva fase"}</h2>

        <form onSubmit={handleSubmit} className="modal-form">
          <label>
            Nombre
            <input
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              required
            />
          </label>

          <label>
            Descripción
            <textarea
              name="descripcion"
              value={form.descripcion}
              onChange={handleChange}
              rows={3}
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

          <div className="modal-acciones">
            <button type="button" onClick={onCerrar} className="modal-btn-cancelar">
              Cancelar
            </button>
            <button type="submit" className="modal-btn-guardar">
              {esEdicion ? "Guardar cambios" : "Crear fase"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ModalFase;