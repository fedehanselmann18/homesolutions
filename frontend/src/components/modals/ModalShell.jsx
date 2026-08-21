import { X, CircleAlert } from "lucide-react";

import { formatMoneda } from "../../utils/formato";
import { useModal } from "../../hooks/useModal";

import "./modal-base.css";
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
  contextoDestacado = false,
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
  const dialogoRef = useModal(onCerrar, cerrarDeshabilitado);

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
        ref={dialogoRef}
        // `tabIndex={-1}` lo hace enfocable por código sin meterlo en el orden
        // de tabulación: useModal le da el foco al abrir, así el lector de
        // pantalla anuncia el diálogo y su título.
        tabIndex={-1}
        className={`modal-contenido shell${ancho ? " shell--ancho" : ""}${clase ? ` ${clase}` : ""}`}
        // El diálogo se anuncia como tal (y con su título) para lectores de
        // pantalla: sin esto es un div más, indistinguible del resto de la
        // página que quedó atrás del overlay.
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="shell__header">
          {/* Con `contextoDestacado` el contexto sube arriba del título como
              etiqueta (punto + mayúsculas): sirve cuando es un nombre corto
              ("Aluar Sur"). Por defecto queda debajo y en texto plano, que es
              lo que necesitan los modales cuyo contexto es una frase larga
              (ej. "Sobre: <descripción>" en ModalNota). */}
          <div className="shell__titulo">
            {contexto && contextoDestacado && (
              <span className="shell__contexto shell__contexto--destacado">
                <span className="shell__contexto-punto" />
                {contexto}
              </span>
            )}
            <h2>{titulo}</h2>
            {contexto && !contextoDestacado && <span className="shell__contexto">{contexto}</span>}
          </div>
          <span className="shell__espaciador" />
          <button
            type="button"
            className="btn-icono"
            onClick={onCerrar}
            disabled={cerrarDeshabilitado}
            title="Cerrar"
            aria-label="Cerrar"
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
