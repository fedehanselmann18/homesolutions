import isoOliva from "../../assets/HS_iso_oliva.png";
import "./EstadoVacio.css";

/**
 * Estado "no hay datos" compartido: el isotipo de la marca a baja opacidad
 * en vez de un párrafo suelto. Se usa en listas vacías (Seguimiento, Panel)
 * y no en errores -- un error no lleva la marca, se dice directo.
 *
 * `grande`: para el primer estado vacío de una página entera (ej. "todavía
 * no hay proyectos cargados"). Default: fila chica dentro de una sección.
 */
export function EstadoVacio({ mensaje, grande }) {
    return (
        <div className={`estado-vacio ${grande ? "estado-vacio--grande" : ""}`}>
            <img src={isoOliva} alt="" className="estado-vacio-icono" />
            <p className="estado-vacio-mensaje">{mensaje}</p>
        </div>
    );
}

export default EstadoVacio;
