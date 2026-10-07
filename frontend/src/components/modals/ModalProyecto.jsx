import { useState, useEffect, useMemo } from "react";
import { Building2, CalendarDays, MapPin } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";
import { CampoMonto, CamposCotizacion } from "./CamposCotizacion";
import { ControlOpcion } from "../shared/ControlOpcion";
import { useCotizacionDia } from "../../hooks/useCotizacionDia";
import { textoEquivalente } from "../../utils/moneda";

const ESTADOS_OPCIONES = [
  { valor: "a_iniciar", label: "A iniciar" },
  { valor: "en_curso", label: "En curso" },
  { valor: "terminado", label: "Terminado" },
];

/**
 * Alta y edición de un proyecto — variante 5f. El precio acordado va aparte,
 * en un panel suave ("Acuerdo con el cliente"): es lo único del formulario
 * que es un compromiso con alguien, no un dato de la obra.
 */
export function ModalProyecto({ proyecto, onGuardar, onCerrar }) {
  const esEdicion = Boolean(proyecto);

  const [form, setForm] = useState({
    nombre: "",
    direccion: "",
    fecha_inicio: "",
    estado: "a_iniciar",
    precio_acordado_usd: "",
  });
  const [guardando, setGuardando] = useState(false);

  // El precio se acuerda en dólares. El dólar del día de la firma es solo
  // trazabilidad (no entra en ninguna cuenta, ver models.Proyecto): se
  // sugiere el de la fecha de inicio y se puede dejar vacío.
  const cotizacionInicial = useMemo(
    () =>
      proyecto
        ? {
            tipo_cambio: proyecto.tipo_cambio_acordado ?? undefined,
            cotizacion_dolar: proyecto.cotizacion_acordada ?? "",
          }
        : undefined,
    [proyecto]
  );
  const cotizacion = useCotizacionDia({ fecha: form.fecha_inicio, inicial: cotizacionInicial });

  useEffect(() => {
    if (proyecto) {
      setForm({
        nombre: proyecto.nombre ?? "",
        direccion: proyecto.direccion ?? "",
        fecha_inicio: proyecto.fecha_inicio ?? "",
        estado: proyecto.estado ?? "a_iniciar",
        precio_acordado_usd: proyecto.precio_acordado_usd ?? "",
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
      const hayCotizacion = Number(cotizacion.valor) > 0;
      await onGuardar({
        ...form,
        precio_acordado_usd: Number(form.precio_acordado_usd),
        cotizacion_acordada: hayCotizacion ? Number(cotizacion.valor) : null,
        tipo_cambio_acordado: hayCotizacion ? cotizacion.tipo : null,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={esEdicion ? "Editar proyecto" : "Nuevo proyecto"}
      icono={Building2}
      contexto={esEdicion ? proyecto.nombre : undefined}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear proyecto"}
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
          placeholder="Ej: Salón de eventos · Martínez"
          required
        />
      </label>

      <label>
        Dirección
        <div className="campo">
          <MapPin aria-hidden="true" />
          <input
            type="text"
            name="direccion"
            value={form.direccion}
            onChange={handleChange}
            required
          />
        </div>
      </label>

      <div className="modal-form-fila modal-form-fila--fecha">
        <label>
          Inicio
          <div className="campo">
            <CalendarDays aria-hidden="true" />
            <input
              type="date"
              name="fecha_inicio"
              value={form.fecha_inicio}
              onChange={handleChange}
              required
            />
          </div>
        </label>

        <ControlOpcion
          etiqueta="Estado"
          opciones={ESTADOS_OPCIONES}
          valor={form.estado}
          onCambiar={(estado) => setForm((prev) => ({ ...prev, estado }))}
          variante="segmentado"
          disabled={guardando}
        />
      </div>

      <div className="modal-form-panel">
        <span className="modal-form-panel__titulo">Acuerdo con el cliente</span>
        <CampoMonto
          etiqueta="Precio acordado"
          name="precio_acordado_usd"
          value={form.precio_acordado_usd}
          onChange={handleChange}
          moneda="usd"
          equivalente={textoEquivalente(form.precio_acordado_usd, "usd", cotizacion.valor)}
          disabled={guardando}
        />
        <CamposCotizacion
          cotizacion={cotizacion}
          etiqueta="Dólar de la firma"
          requerido={false}
          disabled={guardando}
        />
      </div>
    </ModalShell>
  );
}

export default ModalProyecto;
