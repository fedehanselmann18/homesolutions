import "./Cargando.css";

/**
 * Estado de carga propio de la app: una regla que se completa de
 * izquierda a derecha, coherente con las barras de progreso de los KPIs
 * (ver TarjetaKpi). Reemplaza los "Cargando..." sueltos repetidos por
 * pantalla.
 */
export function Cargando({ texto = "Cargando..." }) {
  return (
    <div className="cargando">
      <div className="cargando-barra" />
      <span className="cargando-texto">{texto}</span>
    </div>
  );
}

export default Cargando;
