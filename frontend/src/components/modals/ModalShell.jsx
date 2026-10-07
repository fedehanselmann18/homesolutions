import { X, CircleAlert } from "lucide-react";

import { formatMoneda } from "../../utils/formato";
import { useModal } from "../../hooks/useModal";
import { LogoCargando } from "../shared/LogoCargando";

import "./modal-base.css";
import "./ModalShell.css";

/**
 * Header de un modal — DESIGN.md §14: cuadradito de 32px con el ícono del tipo
 * de operación, título y, a la derecha del título, el contexto (el proyecto,
 * la fecha) separado por una línea. Lo comparten el shell de abajo y el de
 * edición de movimientos (EditarShell), así el header es uno solo.
 *
 * `contextoDestacado` queda por compatibilidad: en la v5 el contexto va
 * siempre al lado del título, no arriba en mayúsculas.
 */
export function ModalHeader({
  icono: Icono,
  titulo,
  contexto,
  iconoContexto: IconoContexto,
  onCerrar,
  cerrarDeshabilitado = false,
}) {
  return (
    <div className="shell__header">
      {Icono && (
        <span className="shell__icono">
          <Icono size={16} strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
      <h2 className="shell__titulo">{titulo}</h2>
      {contexto && (
        <span
          className="shell__contexto"
          title={typeof contexto === "string" ? contexto : undefined}
        >
          {IconoContexto && <IconoContexto size={14} strokeWidth={1.75} aria-hidden="true" />}
          <span className="shell__contexto-texto">{contexto}</span>
        </span>
      )}
      <span className="shell__espaciador" />
      <button
        type="button"
        className="btn-icono"
        onClick={onCerrar}
        disabled={cerrarDeshabilitado}
        title="Cerrar"
        aria-label="Cerrar"
      >
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * Shell común de los modales — DESIGN.md §14. El título y el contexto viven
 * en un header fijo de 64px, el contenido scrollea en el medio y el footer
 * (total + acciones) queda siempre a la vista.
 *
 * v5: un solo shell para ver y para cargar. En la v4 el detalle de un
 * movimiento tenía su propio shell con header NEGRO "porque distingue mirar de
 * cargar"; en una app sin superficies oscuras eso lo dicen el ícono y el
 * título, y el header negro era un resto de la v4.
 *
 * El alto es variable (`max-height: 88vh` con el cuerpo en `flex: 0 1 auto`):
 * el modal se encoge hasta su contenido en vez de dejar un hueco muerto entre
 * el último campo y el pie.
 *
 * `onSubmit` convierte el shell en un <form>, así el footer puede tener el
 * botón submit aunque esté fuera del área scrolleable. `accionesIzquierda`
 * va al otro extremo del pie (el "Borrar" del detalle de un movimiento).
 */
export function ModalShell({
  titulo,
  icono,
  contexto,
  iconoContexto,
  // aria-label del diálogo, si el título solo no alcanza ("Compra" no dice
  // cuál): por defecto es el título.
  etiqueta,
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
  accionesIzquierda,
  children,
}) {
  const Contenedor = onSubmit ? "form" : "div";
  const dialogoRef = useModal(onCerrar, cerrarDeshabilitado);
  const hayPie = total !== undefined || aviso || acciones || accionesIzquierda;

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
        aria-label={etiqueta ?? titulo}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <ModalHeader
          icono={icono}
          titulo={titulo}
          contexto={contexto}
          iconoContexto={iconoContexto}
          onCerrar={onCerrar}
          cerrarDeshabilitado={cerrarDeshabilitado}
        />

        {/* `modal-form` no aporta layout acá (lo pisa .shell__cuerpo): está
            para que sigan aplicando los estilos de label/input/select, que en
            ModalCompra.css cuelgan de ese ancestro. */}
        <div className="shell__cuerpo modal-form">{children}</div>

        {hayPie && (
          <div className="shell__footer">
            {accionesIzquierda && (
              <div className="shell__footer-izquierda">{accionesIzquierda}</div>
            )}
            {total !== undefined && (
              <div className="shell__footer-total">
                <span className="shell__footer-total-label">{totalLabel}</span>
                <span className="shell__footer-total-monto">{formatMoneda(total)}</span>
              </div>
            )}
            {aviso && (
              <span className="shell__footer-aviso">
                <CircleAlert size={14} strokeWidth={2} aria-hidden="true" />
                {aviso}
              </span>
            )}
            <div className="shell__footer-acciones">{acciones}</div>
          </div>
        )}
      </Contenedor>
    </div>
  );
}

/**
 * El pie de un formulario de alta o edición: "Cancelar" y el botón de
 * guardar, los dos en el tamaño de pie de modal (`.btn--lg`, DESIGN.md §8).
 * Era el mismo bloque de 20 líneas copiado en cada modal.
 */
export function AccionesFormulario({
  guardando = false,
  textoGuardar,
  onCancelar,
  deshabilitado = false,
}) {
  return (
    <>
      <button
        type="button"
        onClick={onCancelar}
        className="btn btn--lg btn-secondary"
        disabled={guardando}
      >
        Cancelar
      </button>
      <button
        type="submit"
        className="btn btn--lg btn-primary"
        disabled={guardando || deshabilitado}
      >
        {guardando ? (
          <>
            <LogoCargando size={14} variante="blanco" />
            Guardando...
          </>
        ) : (
          textoGuardar
        )}
      </button>
    </>
  );
}

export default ModalShell;
