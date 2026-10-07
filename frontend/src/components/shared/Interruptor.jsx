import "./Interruptor.css";

/**
 * Interruptor on/off con su etiqueta al lado. Es la EXCEPCIÓN a "nada de
 * switches" de DESIGN.md §9: esa regla es para los formularios de carga, donde
 * pago/envío son valores de un dato y van como opción. Acá es una acción
 * rápida en una vista de lectura (el pago en el detalle de una compra), donde
 * un botón grande "Marcar pagado" era demasiado para un sí/no.
 */
export function Interruptor({ etiqueta, activo, onCambiar, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      className={`interruptor${activo ? " interruptor--activo" : ""}`}
      onClick={onCambiar}
      disabled={disabled}
    >
      <span className="interruptor__pista" aria-hidden="true">
        <span className="interruptor__perilla" />
      </span>
      {etiqueta}
    </button>
  );
}

export default Interruptor;
