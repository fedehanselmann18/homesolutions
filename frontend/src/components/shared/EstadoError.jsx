import "./EstadoError.css";

/**
 * Estado de error compartido: el mensaje se dice directo, sin el isotipo
 * de la marca (ver comentario en EstadoVacio.jsx).
 *
 * `grande`: para el error de una página entera (ej. falló el fetch del
 * proyecto). Default: fila chica dentro de una sección.
 */
export function EstadoError({ mensaje, grande }) {
    return (
        <div className={`estado-error ${grande ? "estado-error--grande" : ""}`}>
            <p className="estado-error-mensaje">{mensaje}</p>
        </div>
    );
}

export default EstadoError;
