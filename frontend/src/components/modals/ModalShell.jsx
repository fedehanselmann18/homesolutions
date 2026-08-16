import { X, CircleAlert } from "lucide-react";

import { formatMoneda } from "../../utils/formato";

import "./ModalCompra.css";
import "./ModalShell.css";

/**
 * Shell común de los modales de alta/edición — dirección 5c del rediseño (ver
 * claudedesign/). El título y el contexto viven en un header fijo, el
 * formulario scrollea en el medio y el footer (total + acciones) queda
 * siempre a la vista.
 *
 * `onSubmit` convierte el shell en un <form>, así el footer puede tener el
 * botón submit aunque esté fuera del área scrolleable.
 */
export function ModalShell({
  titulo,
  contexto,
  ancho = false,
  clase = "",
  capaSuperior = false,
  onCerrar,
  onSubmit,
  cerrarDeshabilitado = false,
  totalLabel = "Total",
  total,
  aviso,
  acciones,
  children,
}) {
  const Contenedor = onSubmit ? "form" : "div";

  return (
    <div
      className="modal-overlay"
      // Un modal que se abre desde otro (crear una nota parado en el detalle
      // de la compra) tiene que quedar por encima: con el mismo z-index gana
      // el que va último en el DOM, y ahí el orden depende de en qué parte del
      // JSX del padre quedó cada uno.
      style={capaSuperior ? { zIndex: 1100 } : undefined}
      onClick={cerrarDeshabilitado ? undefined : onCerrar}
    >
      <Contenedor
        className={`modal-contenido shell${ancho ? " modal-contenido--ancho shell--ancho" : ""}${clase ? ` ${clase}` : ""}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="shell__header">
          <div className="shell__titulo">
            <h2>{titulo}</h2>
            {contexto && <span className="shell__contexto">{contexto}</span>}
          </div>
          <span className="shell__espaciador" />
          <button
            type="button"
            className="shell__cerrar"
            onClick={onCerrar}
            disabled={cerrarDeshabilitado}
            title="Cerrar"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {/* `modal-form` no aporta layout acá (lo pisa .shell__cuerpo): está
            para que sigan aplicando los estilos de label/input/select, que en
            ModalCompra.css cuelgan de ese ancestro. */}
        <div className="shell__cuerpo modal-form">{children}</div>

        <div className="shell__footer">
          {total !== undefined && (
            <div className="shell__footer-total">
              <span className="shell__footer-total-label">{totalLabel}</span>
              <span className="shell__footer-total-monto">{formatMoneda(total)}</span>
            </div>
          )}
          {aviso && (
            <span className="shell__footer-aviso">
              <CircleAlert size={14} strokeWidth={2.25} />
              {aviso}
            </span>
          )}
          <div className="shell__footer-acciones">{acciones}</div>
        </div>
      </Contenedor>
    </div>
  );
}

export default ModalShell;
