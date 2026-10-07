import { formatMoneda } from "../../utils/formato";
import { useModal } from "../../hooks/useModal";
import { TINTE_PASTILLA } from "../../constants/tipoMovimiento";

import "./modal-base.css";
import "./ModalEditar.css";
import { ModalHeader } from "./ModalShell";
import { LogoCargando } from "../shared/LogoCargando";

/**
 * Piezas compartidas por los modales de EDICIÓN de Compra / Gasto / Cobro
 * (dirección 1c, ver el mockup de Claude Design). Son la contraparte de
 * PiezasDetalle.jsx: el mismo header (ModalHeader, el de todo modal), y el
 * tratamiento del total, pero con los campos editables.
 *
 * La idea es que pasar de "ver el movimiento" a "editarlo" no se sienta un
 * cambio de aplicación: el header es literalmente el mismo componente.
 */

/**
 * Overlay + form + header + footer. El cuerpo lo pone cada modal:
 * puede ser el paso inicial de "IA primero" o el layout con riel.
 *
 * `total` sólo se usa en los modales SIN riel (Gasto): cuando hay riel, el
 * total vive ahí arriba y repetirlo abajo sería ruido. `totalMoneda` es la
 * moneda en que se tipea el monto y `totalSecundario` el equivalente en la
 * otra, ya formateado (preview: la cifra que se guarda la calcula el backend).
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
  totalMoneda = "ars",
  totalSecundario,
  totalColor,
  textoGuardar,
  guardarDeshabilitado = false,
  children,
}) {
  const dialogoRef = useModal(onCerrar, guardando);

  return (
    <div className="modal-overlay" onClick={guardando ? undefined : onCerrar}>
      <form
        ref={dialogoRef}
        tabIndex={-1}
        className={`modal-contenido mov-edit${conRiel ? " mov-edit--riel" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${esEdicion ? "Editar" : "Nuevo"} ${tipo.toLowerCase()}`}
        onClick={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        <ModalHeader
          icono={Icono}
          titulo={`${tipo} · ${esEdicion ? "Editar" : "Nuevo"}`}
          contexto={[contexto, fecha].filter(Boolean).join(" · ")}
          onCerrar={onCerrar}
          cerrarDeshabilitado={guardando}
        />

        {children}

        <div className="mov-edit__footer">
          {total !== undefined && (
            <div className="mov-edit__footer-total">
              <span className="mov-edit__footer-total-label">{totalLabel}</span>
              <span
                className="mov-edit__footer-total-monto"
                style={totalColor ? { color: totalColor } : undefined}
              >
                {formatMoneda(total, totalMoneda)}
              </span>
              {totalSecundario && (
                <span className="mov-edit__footer-total-secundario">{totalSecundario}</span>
              )}
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
              {guardando ? (
                <>
                  <LogoCargando size={14} variante="blanco" />
                  Guardando...
                </>
              ) : (
                textoGuardar
              )}
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

/**
 * Total grande del riel, con su label arriba. `secundario` es el equivalente
 * en la otra moneda ya formateado, debajo y más chico.
 */
export function TotalRiel({ label = "Total", monto, moneda = "ars", secundario, color }) {
  return (
    <div className="mov-edit__total">
      <span className="mov-edit__total-label">{label}</span>
      <span className="mov-edit__total-monto" style={color ? { color } : undefined}>
        {formatMoneda(monto, moneda)}
      </span>
      {secundario && <span className="mov-edit__total-secundario">{secundario}</span>}
    </div>
  );
}

/**
 * Barra que descompone el total en sus partes, con la leyenda de importes
 * debajo. `segmentos`: [{ label, monto, color, signo }] -- signo -1 pinta el
 * importe en rojo con el menos adelante (notas de crédito), +1 en ámbar con
 * el más (notas de débito), y sin signo queda neutro (neto, impuestos).
 *
 * Vivía en PiezasDetalle; el detalle v5 (Movimientos v2) ya no la usa, así
 * que quedó acá con los modales de edición, que son los únicos que la pintan.
 */
export function BarraComposicion({ segmentos, moneda = "ars" }) {
  const visibles = segmentos.filter((s) => Math.abs(s.monto) > 0);
  if (visibles.length === 0) return null;

  const suma = visibles.reduce((acc, s) => acc + Math.abs(s.monto), 0);

  return (
    <div className="mov-edit__composicion">
      <div className="mov-edit__barra">
        {visibles.map((s) => (
          <span
            key={s.label}
            style={{ width: `${(Math.abs(s.monto) / suma) * 100}%`, background: s.color }}
            title={`${s.label} ${formatMoneda(s.monto, moneda)}`}
          />
        ))}
      </div>
      <div className="mov-edit__leyenda">
        {visibles.map((s) => (
          <span key={s.label} className="mov-edit__leyenda-item">
            <span className="mov-edit__leyenda-punto" style={{ background: s.color }} />
            {s.label}{" "}
            <strong
              className={`mov-edit__leyenda-monto${
                s.signo === -1
                  ? " mov-edit__leyenda-monto--resta"
                  : s.signo === 1
                    ? " mov-edit__leyenda-monto--suma"
                    : ""
              }`}
            >
              {s.signo === -1 ? "-" : s.signo === 1 ? "+" : ""}
              {formatMoneda(Math.abs(s.monto), moneda)}
            </strong>
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Tile de estado (pago / envío) con switch, para el formulario de compra.
 * Sin `onToggle` queda de sólo lectura. Los switches salen en los modales de
 * alta v5 (DESIGN.md §9: controles de opción, no switches).
 */
export function TileEstado({ label, estado, activo, onToggle, titulo }) {
  const Icono = estado.icono;
  return (
    <div className={`mov-edit__estado${activo ? " mov-edit__estado--activo" : ""}`}>
      <span
        className="mov-edit__estado-icono"
        style={{ background: `${estado.color}${TINTE_PASTILLA}`, color: estado.color }}
      >
        {Icono && <Icono size={15} strokeWidth={2} />}
      </span>
      <span className="mov-edit__estado-texto">
        <span className="mov-edit__estado-label">{label}</span>
        <span className="mov-edit__estado-valor" style={{ color: estado.color }}>
          {estado.label}
        </span>
      </span>
      <span className="mov-edit__estado-espaciador" />
      {onToggle && (
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          aria-label={titulo}
          title={titulo}
          className={`mov-edit__switch${activo ? " mov-edit__switch--on" : ""}`}
          onClick={onToggle}
        >
          <span className="mov-edit__switch-perilla" />
        </button>
      )}
    </div>
  );
}
