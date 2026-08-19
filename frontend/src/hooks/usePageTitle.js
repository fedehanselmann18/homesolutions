import { useEffect } from "react";

const NOMBRE_APP = "Home Solutions";

// Antes el título de pestaña era fijo ("Home Solutions" en todas), así que
// con varias pestañas abiertas no se distinguía una de otra. undefined
// (dato todavía sin cargar, ej. nombre de un proyecto) deja el título en
// el nombre de la app en vez de parpadear "undefined · Home Solutions".
export function usePageTitle(titulo) {
  useEffect(() => {
    document.title = titulo ? `${titulo} · ${NOMBRE_APP}` : NOMBRE_APP;
  }, [titulo]);
}
