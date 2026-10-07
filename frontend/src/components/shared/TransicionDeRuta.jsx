import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import "./TransicionDeRuta.css";

/**
 * Cómo se siente pasar de una página a otra. Dos cosas, las dos chicas a
 * propósito: la idea es que no salte, no que se note una animación.
 *
 * 1. La página entrante aparece en 180ms (opacidad + 6px de subida). Sólo al
 *    ENTRAR, nunca al salir: animar la salida retrasa la página nueva, así
 *    que se siente más lenta, no más suave.
 * 2. El scroll vuelve arriba. Sin esto, entrar a un proyecto desde el final
 *    del Panel te deja parado a mitad de la página nueva -- que es el salto
 *    que más se nota de todos. Scrollea la ventana, no .main-content (ese no
 *    tiene overflow propio).
 *
 * La excepción es `?foco=`: ahí la página se posiciona sola en la fila que se
 * tocó (ver Bandeja), así que mandar el scroll arriba sería pelearse con eso.
 *
 * El `key` por pathname remonta la página al cambiar de ruta, que es lo que
 * dispara la animación de entrada. Cambiar sólo el query (?tab=) no remonta,
 * así no se reinicia la pestaña elegida.
 *
 * prefers-reduced-motion no se contempla acá: lo apaga la regla global de
 * index.css, que anula animaciones y scroll suave en toda la app.
 */
export function TransicionDeRuta({ children }) {
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (new URLSearchParams(search).has("foco")) return;
    // "instant" y no "smooth": en una página recién abierta no hay nada que
    // recorrer, un scroll animado sólo haría esperar.
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname, search]);

  return (
    <div key={pathname} className="transicion-ruta">
      {children}
    </div>
  );
}

export default TransicionDeRuta;
