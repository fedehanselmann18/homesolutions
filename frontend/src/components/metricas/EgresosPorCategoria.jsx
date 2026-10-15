import { ListaBarras } from "./ListaBarras";
import { GRIS } from "../../constants/colores";
import { formatMoneda, formatNumero } from "../../utils/formato";

/**
 * Montos con su % (de los egresos o de las compras) en barras horizontales.
 * Lo usan Egresos por categoría y Proveedores: es el mismo bloque con otro
 * título. La barra se mide contra el mayor, así el primero llena la pista.
 * Gris: son egresos, y el oliva queda para lo que entra.
 */
export function EgresosPorCategoria({ titulo, filas, moneda, vacio }) {
  const maximo = Math.max(...filas.map((f) => f.monto), 0);
  const items = filas.map((f) => ({
    clave: f.nombre,
    nombre: f.nombre,
    ancho: maximo > 0 ? (f.monto / maximo) * 100 : 0,
    valor: formatMoneda(f.monto, moneda),
    detalle: `${formatNumero(f.pct, 0)} %`,
    color: GRIS,
  }));
  return <ListaBarras titulo={titulo} items={items} vacio={vacio} />;
}

export default EgresosPorCategoria;
