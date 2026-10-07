import { useState, useEffect } from "react";
import { Building2, Layers } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";
import { ControlOpcion } from "../shared/ControlOpcion";
import { ESTADO_LABELS } from "../../constants/estados";

// El estado de una fase se elige mirando el mismo semáforo del resto de la
// app (estados.js): cada tile lleva el ícono de su badge.
const ESTADOS_OPCIONES = Object.entries(ESTADO_LABELS).map(([valor, info]) => ({
  valor,
  label: info.label,
  icono: info.icono,
}));

/**
 * Alta y edición de una fase — variante 5e. `contexto` es dónde se carga
 * ("Fase 5 de Edificio Olleros"): lo arma quien lo abre, que sabe en qué
 * proyecto está y cuántas fases hay.
 */
export function ModalFase({ fase, contexto, onGuardar, onCerrar }) {
  const esEdicion = Boolean(fase);

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    estado: "por_empezar",
  });
  const [guardando, setGuardando] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Ojo: proyecto_id no se maneja acá. Si es creación (FaseCreate),
    // el componente padre debe agregarlo antes de llamar al service:
    // onGuardar({ ...form, proyecto_id: proyectoId })
    setGuardando(true);
    try {
      await onGuardar(form);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={esEdicion ? "Editar fase" : "Nueva fase"}
      icono={Layers}
      contexto={contexto}
      iconoContexto={Building2}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear fase"}
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
          placeholder="Ej: Entrega y garantía"
          required
        />
      </label>

      <label>
        <span>
          Descripción <span className="label-campo__opcional">(opcional)</span>
        </span>
        <textarea
          name="descripcion"
          value={form.descripcion}
          onChange={handleChange}
          placeholder="Qué incluye esta etapa"
          rows={3}
        />
      </label>

      <ControlOpcion
        etiqueta="Estado"
        opciones={ESTADOS_OPCIONES}
        valor={form.estado}
        onCambiar={(estado) => setForm((prev) => ({ ...prev, estado }))}
        variante="tiles"
        disabled={guardando}
      />
    </ModalShell>
  );
}

export default ModalFase;
