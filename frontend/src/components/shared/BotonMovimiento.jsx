import { getTipoMovimiento } from "../../constants/tipoMovimiento";

/**
 * Botón para cargar un movimiento nuevo (compra, gasto, cobro) — diseño 1a de
 * `HS Botones`: cada tipo lleva el ícono y el color con que aparece en la lista
 * de movimientos, así el botón y la fila que crea se reconocen como lo mismo.
 *
 * `principal` es la acción primaria de la vista (oliva relleno): ahí el ícono
 * va en blanco como el texto, porque el color del tipo no se lee sobre oliva.
 */
export function BotonMovimiento({ tipo, principal = false, onClick, children }) {
  const { icono: Icono, color, singular } = getTipoMovimiento(tipo);
  return (
    <button
      type="button"
      className={principal ? "btn btn-primary" : "btn btn-secondary"}
      onClick={onClick}
    >
      {Icono && <Icono color={principal ? undefined : color} aria-hidden="true" />}
      {children ?? singular}
    </button>
  );
}

export default BotonMovimiento;
