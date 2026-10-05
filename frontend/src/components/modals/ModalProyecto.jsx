import { useState, useEffect, useMemo } from "react";
import ModalShell from "./ModalShell";
import { LogoCargando } from "../shared/LogoCargando";
import { CamposCotizacion } from "./CamposCotizacion";
import { useCotizacionDia } from "../../hooks/useCotizacionDia";

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
        Precio acordado (US$)
        <input
          type="number"
          name="precio_acordado_usd"
          value={form.precio_acordado_usd}
          onChange={handleChange}
          min="0"
          step="0.01"
          required
        />
      </label>

      <CamposCotizacion
        cotizacion={cotizacion}
        monto={form.precio_acordado_usd}
        monedaMonto="usd"
        claseFila="modal-form-fila"
        etiqueta="Dólar de la firma (opcional)"
        requerido={false}
        disabled={guardando}
      />
    </ModalShell>
  );
}

export default ModalProyecto;
