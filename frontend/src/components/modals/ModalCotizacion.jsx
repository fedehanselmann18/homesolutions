import { useState, useEffect } from "react";
import ModalShell from "./ModalShell";
import { LogoCargando } from "../shared/LogoCargando";
import { TIPOS_CAMBIO } from "../../utils/moneda";
import { validarFecha } from "../../utils/formValidation";

const hoy = () => new Date().toISOString().slice(0, 10);

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
      <div className="modal-form-fila">
        <label>
          Fecha
          <input type="date" name="fecha" value={form.fecha} onChange={handleChange} required />
          {errores.fecha && <p className="campo-error">{errores.fecha}</p>}
        </label>

        <label>
          Dólar
          <select name="tipo" value={form.tipo} onChange={handleChange}>
            {TIPOS_CAMBIO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Cotización ($ por US$)
        <input
          type="number"
          name="valor"
          value={form.valor}
          onChange={handleChange}
          min="0"
          step="0.0001"
          required
        />
        {errores.valor && <p className="campo-error">{errores.valor}</p>}
      </label>
    </ModalShell>
  );
}

export default ModalCotizacion;
