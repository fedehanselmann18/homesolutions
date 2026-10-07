import { Sparkles } from "lucide-react";

import { LogoCargando } from "../shared/LogoCargando";

import "./PiezasIA.css";

/**
 * Piezas de la lectura con IA de un comprobante. v5 (DESIGN.md §14): el botón
 * va en la fila del archivo, al lado de lo que lee, y cada campo que completó
 * queda marcado. Se fueron el paso "IA primero" (la pantalla con sólo la zona
 * de carga), el banner del comprobante leído y el resumen rojo de faltantes:
 * el formulario está siempre a la vista y los errores van en cada campo.
 */

export function BotonIA({
  onClick,
  disabled,
  leyendo,
  atenuado = false,
  textoLeyendo = "Leyendo comprobante...",
  children,
}) {
  // v5: es `.btn-marca` (tint con borde oliva), la acción de marca al lado
  // del archivo (DESIGN.md §8 y §14). Era una píldora oliva llena que
  // competía con el botón de guardar del pie.
  return (
    <button
      type="button"
      className={`btn btn-marca ia-boton${atenuado ? " ia-boton--atenuado" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {leyendo ? <LogoCargando size={15} /> : <Sparkles size={15} strokeWidth={2} />}
      {leyendo ? textoLeyendo : children}
    </button>
  );
}

/** Marca de "este campo lo leyó la IA", debajo del input correspondiente. */
export function MarcaIA() {
  return (
    <span className="ia-marca">
      <Sparkles size={12} strokeWidth={2.25} />
      leído del comprobante
    </span>
  );
}
