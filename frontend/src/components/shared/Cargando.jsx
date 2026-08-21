import { LogoCargando } from "./LogoCargando";

import "./Cargando.css";

/**
 * Estado de carga de una página o de una sección: el isotipo de la marca
 * pulsando (ver LogoCargando) con el texto de qué se está cargando debajo.
 *
 * Antes era una barra de 3px con un barrido, que no se parecía en nada al
 * indicador que ya usaba el flujo de IA — así que esperar a que cargue una
 * página y esperar a que la IA lea un comprobante se veían distinto siendo
 * la misma situación para el usuario.
 *
 * `compacto`: para una sección adentro de una página (no ocupa alto de más).
 */
export function Cargando({ texto = "Cargando...", compacto = false }) {
  return (
    <div className={`cargando${compacto ? " cargando--compacto" : ""}`} role="status">
      <LogoCargando size={compacto ? 24 : 40} />
      <span className="cargando-texto">{texto}</span>
    </div>
  );
}

export default Cargando;
