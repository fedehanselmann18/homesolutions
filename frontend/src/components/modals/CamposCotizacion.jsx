import { TIPOS_CAMBIO, getTipoCambioLabel } from "../../utils/moneda";
import { formatCotizacion, formatFecha, formatMoneda } from "../../utils/formato";

import "./CamposCotizacion.css";

/**
 * Tipo de dólar + cotización de un movimiento, con la sugerencia de la tabla
 * de cotizaciones y el equivalente en la otra moneda como preview. El estado
 * vive en useCotizacionDia; esto solo lo dibuja.
 *
 * El equivalente es eso, un preview: la cifra que se guarda la calcula el
 * backend con la misma cuenta (ver app/tipo_cambio.py), ignorando lo que se
 * vea acá.
 *
 * Se usa en dos layouts distintos (los modales de edición con riel y el
 * ModalShell clásico de notas/proyecto), así que la fila y los campos toman
 * la clase del modal que los contiene en vez de traer una geometría propia.
 *
 * - monto / monedaMonto: lo que se está tipeando ("ars" en compras y gastos,
 *   "usd" en cobros), para calcular el equivalente.
 * - requerido: false solo en el proyecto, donde el dólar de la firma es
 *   trazabilidad opcional y no entra en ninguna cuenta.
 * - etiqueta: el label del select de tipo ("Dólar" por default).
 */
export function CamposCotizacion({
  cotizacion,
  monto,
  monedaMonto = "ars",
  claseFila = "",
  claseCampo = "",
  mostrarError = false,
  disabled = false,
  requerido = true,
  etiqueta = "Dólar",
}) {
  const { tipo, setTipo, valor, setValor, sugerencia, error } = cotizacion;

  const valorNumero = Number(valor);
  const montoNumero = Number(monto);
  const hayEquivalente = valorNumero > 0 && montoNumero > 0;
  const monedaEquivalente = monedaMonto === "ars" ? "usd" : "ars";
  const equivalente = monedaMonto === "ars" ? montoNumero / valorNumero : montoNumero * valorNumero;

  let ayuda;
  if (sugerencia) {
    ayuda = `Sugerido: ${getTipoCambioLabel(sugerencia.tipo).toLowerCase()} ${formatCotizacion(
      sugerencia.valor
    )} del ${formatFecha(sugerencia.fecha)}.`;
  } else {
    ayuda = "No hay cotización de este tipo cargada a esa fecha: tipeala a mano.";
  }

  return (
    <>
      <div className={claseFila}>
        <label className={claseCampo}>
          {etiqueta}
          <select
            name="tipo_cambio"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            disabled={disabled}
          >
            {TIPOS_CAMBIO.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        <label className={claseCampo}>
          Cotización ($ por US$)
          <input
            type="number"
            name="cotizacion_dolar"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            min="0"
            step="0.0001"
            required={requerido}
            disabled={disabled}
          />
          {mostrarError && error && <p className="campo-error">{error}</p>}
        </label>
      </div>

      <p className="campos-cotizacion__ayuda">
        {ayuda}
        {hayEquivalente && (
          <>
            {" "}
            Equivale a{" "}
            <strong className="campos-cotizacion__equivalente">
              {formatMoneda(equivalente, monedaEquivalente)}
            </strong>
            .
          </>
        )}
      </p>
    </>
  );
}

export default CamposCotizacion;
