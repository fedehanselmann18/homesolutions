import "./BadgeEstado.css";

/**
 * El estado de pago o envío de una compra como badge (DESIGN.md §12): el par
 * de color de constants/estadoCompra.js, su ícono y su texto. Si viene
 * `onToggle`, el badge es además el botón que lo cambia; si no, es el mismo
 * badge deshabilitado (lo que ve un usuario de lectura).
 *
 * Lo usan la fila del libro de obra, el detalle de una compra y el historial
 * del proveedor: antes eran dos copias (una en cada uno de los primeros dos).
 * `titulo` es el nombre accesible y el tooltip ("Impaga hace 12 días —
 * marcar pagado"), que dice más que el texto del badge.
 */
export function BadgeEstado({ estado, titulo, onToggle, chico = false }) {
  const Icono = estado.icono;
  return (
    <button
      type="button"
      className={`badge badge-estado${chico ? " badge--sm" : ""}`}
      style={{ color: estado.fg, backgroundColor: estado.bg }}
      title={titulo}
      aria-label={titulo}
      disabled={!onToggle}
      onClick={onToggle}
    >
      {Icono && <Icono size={12} strokeWidth={2} aria-hidden="true" />}
      {estado.label}
    </button>
  );
}

export default BadgeEstado;
