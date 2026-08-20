import { X } from "lucide-react";

import { formatMoneda } from "../../utils/formato";

import "./modal-base.css";
import "./ModalDetalle.css";
import "./ModalEditar.css";

/**
 * Piezas compartidas por los modales de EDICIÓN de Compra / Gasto / Cobro
 * (dirección 1c, ver el mockup de Claude Design). Son la contraparte de
 * PiezasDetalle.jsx: mismo header oscuro, mismas secciones con label +
 * línea y el mismo tratamiento del total, pero con los campos editables.
 *
 * La idea es que pasar de "ver el movimiento" a "editarlo" no se sienta un
 * cambio de aplicación, así que todo lo que se puede compartir con la ficha
 * de detalle se comparte de verdad (el header y la barra salen de
 * ModalDetalle.css) en vez de reimplementarse parecido.
 */

/**
 * Overlay + form + header oscuro + footer. El cuerpo lo pone cada modal:
 * puede ser el paso inicial de "IA primero" o el layout con riel.
 *
 * `total` sólo se usa en los modales SIN riel (Gasto): cuando hay riel, el
 * total vive ahí arriba y repetirlo abajo sería ruido.
 */
export function EditarShell({
  tipo,
  icono: Icono,
  esEdicion,
  contexto,
  fecha,
  conRiel = false,
  guardando = false,
  onCerrar,
  onSubmit,
  aviso,
  totalLabel = "Total",
  total,
  totalColor,
  textoGuardar,
  guardarDeshabilitado = false,
  children,
}) {
  return (
    <div className="modal-overlay" onClick={guardando ? undefined : onCerrar}>
      <form
        className={`modal-contenido detalle mov-edit${conRiel ? " mov-edit--riel" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${esEdicion ? "Editar" : "Nuevo"} ${tipo.toLowerCase()}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <div className="detalle__header">
          <span className="detalle__tipo">
            {Icono && <Icono size={13} strokeWidth={2.25} />}
            {tipo} · {esEdicion ? "Editar" : "Nuevo"}
          </span>
          {contexto && <span className="detalle__separador" />}
          {contexto && <span className="detalle__contexto">{contexto}</span>}
          <span className="detalle__espaciador" />
          {fecha && <span className="detalle__fecha">{fecha}</span>}
          <button
            type="button"
            className="detalle__cerrar"
            onClick={onCerrar}
            disabled={guardando}
            title="Cerrar"
          >
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        {children}

        <div className="mov-edit__footer">
          {total !== undefined && (
            <div className="mov-edit__footer-total">
              <span className="mov-edit__footer-total-label">{totalLabel}</span>
              <span
                className="mov-edit__footer-total-monto"
                style={totalColor ? { color: totalColor } : undefined}
              >
                {formatMoneda(total)}
              </span>
            </div>
          )}
          {aviso && <span className="mov-edit__aviso">{aviso}</span>}
          <div className="mov-edit__footer-acciones">
            <button
              type="button"
              onClick={onCerrar}
              className="btn btn-secondary"
              disabled={guardando}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={guardando || guardarDeshabilitado}
            >
              {guardando ? "Guardando..." : textoGuardar}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Encabezado de sección: label en mayúsculas + línea + acción opcional. */
export function SeccionForm({ titulo, accion, children }) {
  return (
    <div className="mov-edit__seccion">
      <div className="mov-edit__seccion-titulo">
        <span>{titulo}</span>
        <span className="mov-edit__seccion-linea" />
        {accion}
      </div>
      {children}
    </div>
  );
}

/** Total grande del riel, con su label arriba. */
export function TotalRiel({ label = "Total", monto, color }) {
  return (
    <div className="mov-edit__total">
      <span className="mov-edit__total-label">{label}</span>
      <span className="mov-edit__total-monto" style={color ? { color } : undefined}>
        {formatMoneda(monto)}
      </span>
    </div>
  );
}
