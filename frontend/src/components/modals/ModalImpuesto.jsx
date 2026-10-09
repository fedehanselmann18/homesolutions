import { useState, useEffect } from "react";
import { Percent } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";
import { ErrorCampo } from "../shared/ErrorCampo";
import { validarRequerido } from "../../utils/formValidation";

/**
 * Alta y edición de un impuesto en Ajustes (ver models.Impuesto):
 * - Alícuota (opcional): con porcentaje, la compra calcula el monto sola
 *   sobre el precio sin impuestos. Sin porcentaje (percepciones que cambian
 *   factura a factura), el monto se tipea.
 * - Grupo (opcional): los del mismo grupo suman juntos en el Análisis
 *   (IVA 21 e IVA 10,5 → "IVA") y una factura lleva uno solo de cada grupo.
 */
export function ModalImpuesto({ titulo, registro, onGuardar, onCerrar }) {
  const esEdicion = Boolean(registro);

  const [form, setForm] = useState({ nombre: "", alicuota: "", grupo: "" });
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (registro) {
      setForm({
        nombre: registro.nombre ?? "",
        alicuota: registro.alicuota ?? "",
        grupo: registro.grupo ?? "",
      });
    }
  }, [registro]);

  const validar = (campo, valor) => {
    if (campo === "nombre") return validarRequerido(valor, "El nombre es obligatorio.");
    if (campo === "alicuota" && valor !== "") {
      const numero = Number(valor);
      if (!(numero > 0 && numero <= 100)) return "Tiene que ser un porcentaje entre 0 y 100.";
    }
    return null;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrores((prev) => ({ ...prev, [name]: validar(name, value) }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const encontrados = {
      nombre: validar("nombre", form.nombre),
      alicuota: validar("alicuota", form.alicuota),
    };
    setErrores(encontrados);
    if (encontrados.nombre || encontrados.alicuota) return;

    setGuardando(true);
    try {
      await onGuardar({
        nombre: form.nombre.trim(),
        // Vacío = sin alícuota / sin grupo (se manda null para poder sacarlos).
        alicuota: form.alicuota === "" ? null : Number(form.alicuota),
        grupo: form.grupo.trim() || null,
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={titulo}
      icono={Percent}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      cerrarDeshabilitado={guardando}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar={esEdicion ? "Guardar cambios" : "Crear"}
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
          maxLength={100}
          placeholder="IVA 21"
          required
        />
        <ErrorCampo texto={errores.nombre} />
      </label>

      <label>
        <span>
          Alícuota <span className="label-campo__opcional">(opcional)</span>
        </span>
        <div className="campo">
          <input
            type="number"
            name="alicuota"
            value={form.alicuota}
            onChange={handleChange}
            min="0"
            max="100"
            step="0.01"
            placeholder="21"
            aria-label="Alícuota"
          />
          <span className="campo__sufijo">%</span>
        </div>
        {errores.alicuota ? (
          <ErrorCampo texto={errores.alicuota} />
        ) : (
          <p className="campo-hint">
            Con alícuota, la compra calcula el monto sola sobre el precio sin impuestos (y lo podés
            corregir a mano). Sin alícuota, el monto se escribe en cada compra.
          </p>
        )}
      </label>

      <label>
        <span>
          Grupo <span className="label-campo__opcional">(opcional)</span>
        </span>
        <input
          type="text"
          name="grupo"
          value={form.grupo}
          onChange={handleChange}
          maxLength={50}
          placeholder="IVA"
          aria-label="Grupo"
        />
        <p className="campo-hint">
          Los del mismo grupo suman juntos en el Análisis (IVA 21 e IVA 10,5 se ven como IVA), y una
          factura lleva uno solo de cada grupo.
        </p>
      </label>
    </ModalShell>
  );
}

export default ModalImpuesto;
