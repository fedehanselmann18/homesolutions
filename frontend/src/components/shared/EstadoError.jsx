import { CircleAlert } from "lucide-react";

import "./EstadoError.css";

/**
 * Estado de error compartido: sin el isotipo de la marca (ver comentario en
 * EstadoVacio.jsx), pero con el ícono y el color de error del resto de la app.
 *
 * Antes el mensaje salía en `--color-tinta-muted` y sin ícono, o sea idéntico
 * a un estado vacío: un fallo de red y una lista sin resultados se veían igual,
 * siendo que una situación es normal y la otra pide una acción. El lenguaje de
 * error ya existía en `.campo-error` y en el aviso del footer de los modales
 * (CircleAlert + `--color-error`); esto lo alinea con eso.
 *
 * `grande`: para el error de una página entera (ej. falló el fetch del
 * proyecto). Default: fila chica dentro de una sección.
 */
export function EstadoError({ mensaje, grande }) {
  return (
    <div className={`estado-error ${grande ? "estado-error--grande" : ""}`} role="alert">
      <CircleAlert
        className="estado-error-icono"
        size={grande ? 20 : 16}
        strokeWidth={2}
        aria-hidden="true"
      />
      <p className="estado-error-mensaje">{mensaje}</p>
    </div>
  );
}

export default EstadoError;
