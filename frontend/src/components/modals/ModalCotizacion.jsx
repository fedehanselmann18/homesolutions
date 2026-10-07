import { useState, useEffect } from "react";
import { CalendarDays, CircleAlert, DollarSign } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";
import { ControlOpcion } from "../shared/ControlOpcion";
import { TIPOS_CAMBIO } from "../../utils/moneda";
import { validarFecha } from "../../utils/formValidation";

const hoy = () => new Date().toISOString().slice(0, 10);

const OPCIONES_TIPO = TIPOS_CAMBIO.map((t) => ({ valor: t.value, label: t.label }));

function ErrorCampo({ texto }) {
  return (
    texto && (
      <p className="campo-error">
        <CircleAlert aria-hidden="true" />
        {texto}
      </p>
    )
  );
}

/**
 * Alta y edición de una fila de la tabla de cotizaciones (ver
 * pages/Catalogos.jsx). Es la fuente de la que los forms de carga sugieren el
 * dólar del día: editarla NO toca los movimientos ya cargados, que guardan su
 * propia cotización congelada (ver docs/PLAN_TIPO_CAMBIO.md, decisión #2).
 */
export function ModalCotizacion({ cotizacion, onGuardar, onCerrar }) {
  const esEdicion = Boolean(cotizacion);

  const [form, setForm] = useState({ fecha: hoy(), tipo: "blue", valor: "" });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (cotizacion) {
      setForm({
        fecha: cotizacion.fecha ?? hoy(),
        tipo: cotizacion.tipo ?? "blue",
        valor: cotizacion.valor ?? "",
      });
    }
  }, [cotizacion]);

  const validar = (datos) => ({
    fecha: validarFecha(datos.fecha),
    valor: Number(datos.valor) > 0 ? null : "La cotización tiene que ser mayor a 0.",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    const siguiente = { ...form, [name]: value };
    setForm(siguiente);
    if (name !== "tipo") setErrores((prev) => ({ ...prev, [name]: validar(siguiente)[name] }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nuevos = validar(form);
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) return;
    setGuardando(true);
    try {
      await onGuardar({ fecha: form.fecha, tipo: form.tipo, valor: Number(form.valor) });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={esEdicion ? "Editar cotización" : "Nueva cotización"}
      icono={DollarSign}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear cotización"}
        />
      }
    >
      <ControlOpcion
        etiqueta="Dólar"
        opciones={OPCIONES_TIPO}
        valor={form.tipo}
        onCambiar={(tipo) => setForm((prev) => ({ ...prev, tipo }))}
        variante="segmentado"
        disabled={guardando}
      />

      <div className="modal-form-fila">
        <label>
          Fecha
          <div className={`campo${errores.fecha ? " campo--error" : ""}`}>
            <CalendarDays aria-hidden="true" />
            <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
          </div>
          <ErrorCampo texto={errores.fecha} />
        </label>

        <label>
          Cotización
          <div className={`campo campo--monto${errores.valor ? " campo--error" : ""}`}>
            <span className="campo__prefijo">$</span>
            <input
              type="number"
              inputMode="decimal"
              name="valor"
              value={form.valor}
              onChange={handleChange}
              min="0"
              step="0.0001"
              aria-label="Cotización ($ por US$)"
              required
            />
            <span className="campo__sufijo">por US$</span>
          </div>
          <ErrorCampo texto={errores.valor} />
        </label>
      </div>
    </ModalShell>
  );
}

export default ModalCotizacion;
