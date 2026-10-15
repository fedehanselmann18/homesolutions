import { BarraProgreso } from "../shared/TarjetaKpi";
import { EstadoVacio } from "../shared/EstadoVacio";

/**
 * Bloque de Métricas con un ranking en barras horizontales: nombre y valor
 * arriba, la barra debajo. Lo usan Rentabilidad por obra, Egresos por
 * categoría y Proveedores. La barra es la de los KPIs (BarraProgreso).
 *
 * `items`: [{ clave, nombre, ancho (0–100), valor, detalle?, color }]; `valor`
 * y `detalle` ya formateados. Sin items, una línea de vacío.
 */
export function ListaBarras({ titulo, items, vacio }) {
  return (
    <section className="metricas-bloque" aria-label={titulo}>
      <h2 className="metricas-seccion__titulo">{titulo}</h2>
      {items.length === 0 ? (
        <EstadoVacio mensaje={vacio} />
      ) : (
        <ul className="metricas-barras">
          {items.map((item) => (
            <li
              key={item.clave}
              className="metricas-barras__item"
              title={`${item.nombre}: ${item.valor}`}
            >
              <div className="metricas-barras__texto">
                <span className="metricas-barras__nombre">{item.nombre}</span>
                <span className="metricas-barras__valor cifra">
                  {item.valor}
                  {item.detalle && <span className="metricas-barras__detalle">{item.detalle}</span>}
                </span>
              </div>
              <BarraProgreso porcentaje={item.ancho} color={item.color} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default ListaBarras;
