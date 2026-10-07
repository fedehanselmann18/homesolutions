import { useId, useRef } from "react";
import { CircleAlert } from "lucide-react";

import "./ControlOpcion.css";

/**
 * Elegir UNA opción entre pocas en un formulario — DESIGN.md §9, "Controles
 * de opción". Reemplaza a los `<select>` y a los switches de los modales: con
 * 6 opciones o menos se muestran todas, a un click.
 *
 * Tres formas, según cuántas opciones hay:
 *   - `segmentado`: 2–3 excluyentes y cortas (Pago, Estado del proyecto, tipo
 *     de dólar). Mide lo mismo que un campo.
 *   - `chips` (default): 4–6 (Tipo de factura, Condición de pago).
 *   - `tiles`: pocas opciones con ícono que vale la pena ver grande (el estado
 *     de una fase, que es el mismo semáforo del resto de la app).
 *
 * Es un `radiogroup` de verdad: una sola parada de Tab (la opción elegida, o
 * la primera si no hay ninguna) y las flechas mueven la elección, como un
 * grupo de radios nativo. `opciones` es `[{ valor, label, icono? }]`.
 */
export function ControlOpcion({
  etiqueta,
  opcional = false,
  opciones,
  valor,
  onCambiar,
  variante = "chips",
  disabled = false,
  error,
  hint,
  className = "",
}) {
  const idEtiqueta = useId();
  const refs = useRef([]);
  const indiceElegido = opciones.findIndex((o) => o.valor === valor);
  const indiceFoco = indiceElegido >= 0 ? indiceElegido : 0;

  const elegir = (indice) => {
    const opcion = opciones[indice];
    if (!opcion || disabled) return;
    onCambiar(opcion.valor);
    refs.current[indice]?.focus();
  };

  const alPresionar = (evento, indice) => {
    const total = opciones.length;
    if (evento.key === "ArrowRight" || evento.key === "ArrowDown") {
      evento.preventDefault();
      elegir((indice + 1) % total);
    } else if (evento.key === "ArrowLeft" || evento.key === "ArrowUp") {
      evento.preventDefault();
      elegir((indice - 1 + total) % total);
    }
  };

  const claseGrupo = {
    segmentado: "segmentado segmentado--campo",
    chips: "control-opcion__chips",
    tiles: "control-opcion__tiles",
  }[variante];

  const claseOpcion = (activa) =>
    ({
      segmentado: `segmentado__btn${activa ? " segmentado__btn--activo" : ""}`,
      chips: `chip chip--opcion${activa ? " chip--activo" : ""}`,
      tiles: `control-opcion__tile${activa ? " control-opcion__tile--activa" : ""}`,
    })[variante];

  return (
    <div className={`control-opcion${className ? ` ${className}` : ""}`}>
      {etiqueta && (
        <span id={idEtiqueta} className="label-campo">
          {etiqueta}
          {opcional && <span className="label-campo__opcional"> (opcional)</span>}
        </span>
      )}
      <div
        className={claseGrupo}
        role="radiogroup"
        aria-labelledby={etiqueta ? idEtiqueta : undefined}
        aria-invalid={error ? true : undefined}
      >
        {opciones.map((opcion, i) => {
          const activa = opcion.valor === valor;
          const Icono = opcion.icono;
          return (
            <button
              key={opcion.valor}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="radio"
              aria-checked={activa}
              tabIndex={i === indiceFoco ? 0 : -1}
              className={claseOpcion(activa)}
              style={activa && opcion.color ? { color: opcion.color } : undefined}
              disabled={disabled}
              onClick={() => elegir(i)}
              onKeyDown={(e) => alPresionar(e, i)}
            >
              {Icono && (
                <Icono
                  size={variante === "tiles" ? 18 : 14}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              )}
              {opcion.label}
            </button>
          );
        })}
      </div>
      {error ? (
        <p className="campo-error">
          <CircleAlert aria-hidden="true" />
          {error}
        </p>
      ) : (
        hint && <p className="campo-hint">{hint}</p>
      )}
    </div>
  );
}

export default ControlOpcion;
