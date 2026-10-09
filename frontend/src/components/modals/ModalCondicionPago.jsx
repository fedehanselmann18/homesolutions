import { useState, useEffect } from "react";
import { CalendarClock } from "lucide-react";

import ModalShell, { AccionesFormulario } from "./ModalShell";
import { ErrorCampo } from "../shared/ErrorCampo";
import { describirDias, leerDias, nombreSugerido } from "../../utils/plazos";

/**
 * Alta y edición de una condición de pago en Ajustes: nombre + días (cada
 * plazo, contado desde la fecha de la factura). «Contado» (protegido) sólo
 * se puede renombrar: no lleva días.
 */
export function ModalCondicionPago({ titulo, registro, onGuardar, onCerrar }) {
  const esEdicion = Boolean(registro);
  const protegido = Boolean(registro?.protegido);

  const [form, setForm] = useState({ nombre: "", dias: "" });
  const [nombreTocado, setNombreTocado] = useState(false);
  const [errores, setErrores] = useState({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (registro) {
      setForm({ nombre: registro.nombre ?? "", dias: (registro.dias ?? []).join("/") });
      setNombreTocado(true);
    }
  }, [registro]);

  const dias = leerDias(form.dias);

  const cambiarDias = (e) => {
    const texto = e.target.value;
    const leidos = leerDias(texto);
    setForm((prev) => ({
      ...prev,
      dias: texto,
      // Mientras Agus no escriba un nombre propio, se arma solo ("30/60 días").
      nombre: nombreTocado || !leidos ? prev.nombre : nombreSugerido(leidos),
    }));
    setErrores((prev) => ({ ...prev, dias: null }));
  };

  const cambiarNombre = (e) => {
    setNombreTocado(true);
    setForm((prev) => ({ ...prev, nombre: e.target.value }));
    setErrores((prev) => ({ ...prev, nombre: null }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const encontrados = {
      nombre: form.nombre.trim() ? null : "El nombre es obligatorio.",
      dias: protegido
        ? null
        : dias === null
          ? "Escribí los días separados por barra, de 1 a 365 (ej. 30/60/90)."
          : dias.length === 0
            ? "Poné al menos un plazo. Para pagar en el día ya está «Contado»."
            : null,
    };
    setErrores(encontrados);
    if (encontrados.nombre || encontrados.dias) return;

    setGuardando(true);
    try {
      await onGuardar(
        protegido ? { nombre: form.nombre.trim() } : { nombre: form.nombre.trim(), dias }
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <ModalShell
      titulo={titulo}
      icono={CalendarClock}
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
      {!protegido && (
        <label>
          Días de cada pago
          <input
            type="text"
            name="dias"
            inputMode="numeric"
            value={form.dias}
            onChange={cambiarDias}
            placeholder="30/60/90"
            aria-label="Días de cada pago"
          />
          {errores.dias ? (
            <ErrorCampo texto={errores.dias} />
          ) : (
            <p className="campo-hint">
              {dias?.length
                ? `${describirDias(dias)} desde la fecha de la factura, en partes iguales.`
                : "Desde la fecha de la factura. 30/60 = mitad a 30 días y mitad a 60."}
            </p>
          )}
        </label>
      )}

      <label>
        Nombre
        <input
          type="text"
          name="nombre"
          value={form.nombre}
          onChange={cambiarNombre}
          maxLength={100}
          placeholder="30/60/90 días"
          required
        />
        <ErrorCampo texto={errores.nombre} />
        {protegido && (
          <p className="campo-hint">
            Contado es un solo pago el día de la factura. Se puede renombrar, pero no borrar.
          </p>
        )}
      </label>

      {esEdicion && !protegido && (
        <p className="campo-hint">
          Cambiar los días no toca lo que ya cargaste: cada compra y gasto armó sus plazos al
          cargarse.
        </p>
      )}
    </ModalShell>
  );
}

export default ModalCondicionPago;
