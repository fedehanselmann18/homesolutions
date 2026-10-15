import { ListaBarras } from "./ListaBarras";
import { ETIQUETAS_METRICAS } from "../../constants/metricas";
import { OLIVA, GRIS } from "../../constants/colores";
import { formatNumero } from "../../utils/formato";

/**
 * Rentabilidad por obra, de mayor a menor. La barra mide el % contra la obra
 * más alejada de cero; una rentabilidad negativa va en gris (rojo y ámbar
 * quedan para los badges, nunca en un gráfico).
 */
export function RankingRentabilidad({ obras }) {
  const maximo = Math.max(...obras.map((o) => Math.abs(o.rentabilidad)), 0);
  const items = obras.map((o) => ({
    clave: o.id,
    nombre: o.nombre,
    ancho: maximo ? (Math.abs(o.rentabilidad) / maximo) * 100 : 0,
    valor: `${formatNumero(o.rentabilidad, 1)} %`,
    color: o.rentabilidad < 0 ? GRIS : OLIVA,
  }));
  return (
    <ListaBarras
      titulo={ETIQUETAS_METRICAS.rentabilidadPorObra}
      items={items}
      vacio={ETIQUETAS_METRICAS.sinIngresos}
    />
  );
}

export default RankingRentabilidad;
