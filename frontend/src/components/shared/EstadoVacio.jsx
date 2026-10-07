import isoOliva from "../../assets/HS_iso_oliva.png";
import "./EstadoVacio.css";

/**
 * Estado "no hay datos" compartido: el isotipo de la marca a baja opacidad
 * en vez de un párrafo suelto. Para errores va EstadoError -- un error no
 * lleva la marca, se dice directo.
 *
 * `grande`: para el primer estado vacío de una página entera (ej. "todavía
 * no hay proyectos cargados"). Default: fila chica dentro de una sección.
 *
 * Antes convivían nueve implementaciones de esto (`.libro-vacio`,
 * `.analisis-vacio`, `.panel-vacio`, `.manager-vacio`, `.comparador-feedback`,
 * `.proyectos-feedback`, `.proveedores-feedback`, `.seguimiento-vacio` y
 * cuatro `<p>` sin ninguna clase, que además heredaban el negro del body en
 * vez del gris apagado) con cinco tamaños distintos. Este componente es el
 * único lugar donde se decide cómo se ve una lista vacía a nivel página o
 * sección.
 *
 * EXCEPCIÓN a propósito: adentro de un modal o de un formulario el hueco
 * vacío se dice con la clase del propio componente (`.seccion-notas-vacio`,
 * `.modal-form-seccion-vacio`). Ahí el isotipo de marca al lado de un campo sería
 * ruido, no orientación.
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
