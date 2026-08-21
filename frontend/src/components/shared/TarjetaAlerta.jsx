import "./TarjetaAlerta.css";
import { TINTE_PASTILLA } from "../../constants/tipoMovimiento";

/**
 * Fila de "algo que necesita atención". Nació en la sección Necesita atención
 * del Panel y hoy la usa la pestaña Seguimiento de cada proyecto.
 *
 * - `icono`: componente de lucide-react (se le pasa el tipo, no el elemento).
 * - `monto`/`extra`: van a la derecha; `extra` es la línea chica de abajo
 *   (se usa para los "hace N días").
 * - `onClick`: opcional. Si no viene, la fila se renderiza como div y no es
 *   clickeable, así no queda un botón que no lleva a ningún lado.
 */
export function TarjetaAlerta({ icono: Icono, color, titulo, detalle, monto, extra, onClick }) {
  const contenido = (
    <>
      <span
        className="alerta-icono"
        style={{ color, backgroundColor: `${color}${TINTE_PASTILLA}` }}
      >
        <Icono size={16} strokeWidth={2} />
      </span>
      <span className="alerta-texto">
        <span className="alerta-titulo">{titulo}</span>
        {detalle && <span className="alerta-detalle">{detalle}</span>}
      </span>
      {(monto || extra) && (
        <span className="alerta-derecha">
          {monto && (
            <span className="alerta-monto" style={{ color }}>
              {monto}
            </span>
          )}
          {extra && <span className="alerta-extra">{extra}</span>}
        </span>
      )}
    </>
  );

  if (!onClick) {
    return <div className="alerta alerta--estatica">{contenido}</div>;
  }

  return (
    <button type="button" className="alerta" onClick={onClick}>
      {contenido}
    </button>
  );
}

export default TarjetaAlerta;
