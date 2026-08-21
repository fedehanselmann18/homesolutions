import { Search } from "lucide-react";

import "./Buscador.css";

/**
 * Barra de búsqueda de una lista.
 *
 * Había tres implementaciones. Dos de ellas (Proveedores y Comparador) eran
 * idénticas entre sí y NO tenían ningún estilo de foco: como el <input> va
 * anidado adentro de un contenedor con borde y lleva `outline: none`, la regla
 * global de `:focus-visible` quedaba anulada y al enfocarlo con teclado no
 * pasaba nada visible. La tercera (Proyectos) sí lo resolvía con
 * `:focus-within`; ésta toma esa versión.
 *
 * `ancho`: por defecto la barra ocupa el espacio disponible (fila de filtros).
 * Con `ancho="fijo"` mide 230px, que es lo que necesita cuando convive con
 * botones en el encabezado.
 */
export function Buscador({
  valor,
  onCambiar,
  placeholder = "Buscar…",
  etiqueta,
  ancho = "fluido",
}) {
  return (
    <label className={`buscador buscador--${ancho}`}>
      <Search size={16} strokeWidth={2} aria-hidden="true" />
      <input
        type="search"
        value={valor}
        placeholder={placeholder}
        onChange={(e) => onCambiar(e.target.value)}
        aria-label={etiqueta || placeholder}
      />
    </label>
  );
}

export default Buscador;
