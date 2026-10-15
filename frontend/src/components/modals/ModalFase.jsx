import { useState, useEffect, useRef } from "react";
import { Building2, Layers, PenLine } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";
import { ControlOpcion } from "../shared/ControlOpcion";
import { ESTADO_LABELS } from "../../constants/estados";
import { hoyISO } from "../../utils/formato";

// El estado de una fase se elige mirando el mismo semáforo del resto de la
// app (estados.js): cada tile lleva el ícono de su badge.
const ESTADOS_OPCIONES = Object.entries(ESTADO_LABELS).map(([valor, info]) => ({
  valor,
  label: info.label,
  icono: info.icono,
}));

// Valor del <select> que pasa el nombre a un input de texto libre. No puede
// chocar con un nombre real: ninguno empieza con "__".
const OPCION_A_MANO = "__a_mano__";

/**
 * Alta y edición de una fase — variante 5e. `contexto` es dónde se carga
 * ("Fase 5 de Edificio Olleros"): lo arma quien lo abre, que sabe en qué
 * proyecto está y cuántas fases hay.
 *
 * `nombresSugeridos`: las fases predeterminadas (Ajustes → «Fases
 * predeterminadas»), en orden. El nombre se elige de ese select, o con
 * «Otra (escribir a mano)» se tipea uno libre: la fase guarda el nombre como
 * texto, no una referencia, así que cualquiera vale. Sin sugerencias (todavía
 * cargando, o la lista vacía) queda directo el input de texto.
 *
 * En curso pide desde qué fecha: la elegís vos (hoy por default), así una
 * fase que arrancó hace meses no queda "en curso desde hoy" al cargarla.
 */
export function ModalFase({ fase, contexto, nombresSugeridos = [], onGuardar, onCerrar }) {
  const esEdicion = Boolean(fase);
  const haySugerencias = nombresSugeridos.length > 0;

  const [form, setForm] = useState({
    nombre: "",
    descripcion: "",
    estado: "por_empezar",
    fecha_en_curso_desde: hoyISO(),
  });
  const [guardando, setGuardando] = useState(false);
  // A mano si se eligió «Otra», o si la fase que se edita tiene un nombre
  // que no está en la lista (se lo escribió a mano, o la predeterminada se
  // renombró/borró después).
  const [aMano, setAMano] = useState(
    () => Boolean(fase?.nombre) && !nombresSugeridos.includes(fase.nombre)
  );
  const inputNombreRef = useRef(null);
  const usarSelect = haySugerencias && !aMano;

  useEffect(() => {
    if (fase) {
      setForm({
        nombre: fase.nombre ?? "",
        descripcion: fase.descripcion ?? "",
        estado: fase.estado ?? "por_empezar",
        fecha_en_curso_desde: fase.fecha_en_curso_desde ?? hoyISO(),
      });
    }
  }, [fase]);

  // Si las sugerencias llegan después de abrir el modal (la query todavía
  // estaba cargando), una fase con nombre fuera de la lista pasa a mano.
  useEffect(() => {
    if (fase?.nombre && haySugerencias && !nombresSugeridos.includes(fase.nombre)) {
      setAMano(true);
    }
  }, [fase, haySugerencias, nombresSugeridos]);

  const handleElegirNombre = (e) => {
    const { value } = e.target;
    if (value === OPCION_A_MANO) {
      setAMano(true);
      setForm((prev) => ({ ...prev, nombre: "" }));
      // El input recién se monta en el próximo render.
      setTimeout(() => inputNombreRef.current?.focus(), 0);
      return;
    }
    setForm((prev) => ({ ...prev, nombre: value }));
  };

  const volverALaLista = () => {
    setAMano(false);
    setForm((prev) => ({
      ...prev,
      nombre: nombresSugeridos.includes(prev.nombre) ? prev.nombre : "",
    }));
  };

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
    // La fecha sólo viaja si la fase queda en curso.
    const datos = { ...form };
    if (datos.estado !== "en_curso") delete datos.fecha_en_curso_desde;
    try {
      await onGuardar(datos);
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
      {usarSelect ? (
        <label>
          Nombre
          <select name="nombre" value={form.nombre} onChange={handleElegirNombre} required>
            <option value="" disabled>
              Elegí una fase
            </option>
            {nombresSugeridos.map((nombre) => (
              <option key={nombre} value={nombre}>
                {nombre}
              </option>
            ))}
            <option value={OPCION_A_MANO}>Otra (escribir a mano)</option>
          </select>
        </label>
      ) : (
        <>
          <label>
            Nombre
            <input
              ref={inputNombreRef}
              type="text"
              name="nombre"
              value={form.nombre}
              onChange={handleChange}
              placeholder="Ej: Entrega y garantía"
              maxLength={150}
              required
            />
          </label>
          {haySugerencias && (
            <p className="campo-hint">
              <PenLine aria-hidden="true" />
              <span>
                Nombre escrito a mano{" · "}
                <button type="button" className="campo-hint__accion" onClick={volverALaLista}>
                  elegir de la lista
                </button>
              </span>
            </p>
          )}
        </>
      )}

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

      {form.estado === "en_curso" && (
        <label>
          En curso desde
          <input
            type="date"
            name="fecha_en_curso_desde"
            value={form.fecha_en_curso_desde}
            onChange={handleChange}
            max={hoyISO()}
            required
          />
        </label>
      )}
    </ModalShell>
  );
}

export default ModalFase;
