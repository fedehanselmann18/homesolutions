import { useEffect, useRef } from "react";

/**
 * Comportamiento de teclado compartido por todos los modales: cerrar con
 * Escape, atrapar el foco adentro del diálogo y devolverlo a donde estaba
 * al cerrar.
 *
 * Antes no existía en ninguno de los 14 modales de la app. Los shells ya
 * declaraban `role="dialog"` y `aria-modal="true"` -- que le prometen al
 * lector de pantalla que el resto de la página quedó inerte -- pero sin trap
 * el usuario de teclado tabulaba igual hacia atrás del overlay.
 *
 * El listener va en el diálogo y no en `document` a propósito: cuando hay un
 * modal abierto sobre otro (crear una nota parado en el detalle de la compra,
 * ver `capaSuperior` en ModalShell), el foco está en el de arriba, así que
 * Escape cierra ese y no los dos.
 *
 * @param {() => void} onCerrar
 * @param {boolean} cerrarDeshabilitado  mientras se guarda, Escape no cierra
 * @returns ref para el elemento del diálogo (necesita `tabIndex={-1}`)
 */
export function useModal(onCerrar, cerrarDeshabilitado = false) {
  const dialogoRef = useRef(null);

  // El efecto corre una sola vez (montaje/desmontaje): si dependiera de estos
  // dos valores, cada re-render mientras se guarda volvería a mover el foco.
  const ultimo = useRef({ onCerrar, cerrarDeshabilitado });
  ultimo.current = { onCerrar, cerrarDeshabilitado };

  useEffect(() => {
    const dialogo = dialogoRef.current;
    if (!dialogo) return undefined;

    const focoPrevio = document.activeElement;
    dialogo.focus();

    function alPresionar(evento) {
      if (evento.key === "Escape") {
        if (ultimo.current.cerrarDeshabilitado) return;
        evento.stopPropagation();
        ultimo.current.onCerrar?.();
        return;
      }

      if (evento.key !== "Tab") return;

      // `offsetParent` descarta lo que está oculto (secciones colapsadas,
      // pasos del formulario que todavía no se muestran). Sólo sirve donde el
      // entorno calcula layout: jsdom devuelve null y 0 para todo, así que sin
      // este guard el filtro se comía la lista entera y el trap no hacía nada.
      const hayLayout = dialogo.offsetWidth > 0 || dialogo.offsetHeight > 0;
      const candidatos = Array.from(dialogo.querySelectorAll(SELECTOR_FOCUSABLE));
      const focusables = hayLayout
        ? candidatos.filter((elemento) => elemento.offsetParent !== null)
        : candidatos;

      if (focusables.length === 0) {
        evento.preventDefault();
        return;
      }

      const primero = focusables[0];
      const ultimoFocusable = focusables[focusables.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimoFocusable.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimoFocusable) {
        evento.preventDefault();
        primero.focus();
      }
    }

    dialogo.addEventListener("keydown", alPresionar);

    return () => {
      dialogo.removeEventListener("keydown", alPresionar);
      if (focoPrevio instanceof HTMLElement) focoPrevio.focus();
    };
  }, []);

  return dialogoRef;
}

const SELECTOR_FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export default useModal;
