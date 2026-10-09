import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";

import { TIPOS_CAMBIO, getTipoCambioLabel } from "../../utils/moneda";
import { formatCotizacion, formatFecha } from "../../utils/formato";
import { ControlOpcion } from "../shared/ControlOpcion";
import { ErrorCampo } from "../shared/ErrorCampo";

import "./CamposCotizacion.css";

const OPCIONES_TIPO = TIPOS_CAMBIO.map((t) => ({ valor: t.value, label: t.label }));

/**
 * El monto de un movimiento — DESIGN.md §9, "El monto y la conversión": la
 * moneda adentro como prefijo tenue y la conversión al lado, dentro de la
 * misma caja, actualizándose mientras se escribe.
 */
export function CampoMonto({
  etiqueta = "Monto",
  name = "monto",
  value,
  onChange,
  moneda = "ars",
  equivalente,
  error,
  disabled = false,
  required = true,
  className = "",
  children,
}) {
  return (
    <label className={className}>
      {etiqueta}
      <div className={`campo campo--monto${error ? " campo--error" : ""}`}>
        <span className="campo__prefijo">{moneda === "usd" ? "US$" : "$"}</span>
        <input
          type="number"
          inputMode="decimal"
          name={name}
          value={value}
          onChange={onChange}
          min="0"
          step="0.01"
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
        />
        {equivalente && <span className="campo__sufijo">{equivalente}</span>}
      </div>
      <ErrorCampo texto={error} />
      {!error && children}
    </label>
  );
}

/**
 * El dólar de un movimiento, como hint debajo del monto: "Dólar blue
 * $ 1.450,00 del 01/10/2026 · cambiar". Casi siempre la sugerencia de la
 * tabla de cotizaciones es la correcta, así que tipo y cotización quedan
 * plegados detrás del "cambiar"; se abren solos cuando no hay sugerencia o
 * cuando falta el valor al intentar guardar. El estado vive en
 * useCotizacionDia; esto sólo lo dibuja.
 *
 * - requerido: false sólo en el proyecto, donde el dólar de la firma es
 *   trazabilidad opcional y no entra en ninguna cuenta.
 * - etiqueta: cómo se llama este dólar ("Dólar", "Dólar de la firma").
 */
export function CamposCotizacion({
  cotizacion,
  mostrarError = false,
  disabled = false,
  requerido = true,
  etiqueta = "Dólar",
}) {
  const { tipo, setTipo, valor, setValor, sugerencia, buscandoSugerencia, error } = cotizacion;
  const [abierto, setAbierto] = useState(false);

  const hayValor = valor !== "" && valor !== null && valor !== undefined;
  const conError = requerido && mostrarError && Boolean(error);
  const sinSugerencia = !hayValor && !buscandoSugerencia;
  const mostrarCampos = abierto || conError || (requerido && sinSugerencia);

  // Si los campos se abrieron solos por falta de sugerencia, quedan abiertos:
  // si no, al tipear el primer dígito ya "hay valor", la condición de arriba
  // se apaga y el input se desmonta en medio de la escritura (quedaba "1").
  useEffect(() => {
    if (requerido && sinSugerencia && !sugerencia) setAbierto(true);
  }, [requerido, sinSugerencia, sugerencia]);

  const esLaSugerida =
    sugerencia && sugerencia.tipo === tipo && Number(sugerencia.valor) === Number(valor);

  let texto;
  if (hayValor) {
    texto = `${etiqueta} ${getTipoCambioLabel(tipo).toLowerCase()} ${formatCotizacion(valor)}${
      esLaSugerida ? ` del ${formatFecha(sugerencia.fecha)}` : ""
    }`;
  } else if (buscandoSugerencia) {
    texto = `Buscando la cotización del día…`;
  } else {
    texto = "No hay cotización de este tipo cargada a esa fecha: tipeala a mano.";
  }

  return (
    <div className="campos-cotizacion">
      <p className="campo-hint">
        <DollarSign aria-hidden="true" />
        <span>
          {texto}
          {!requerido && <span className="label-campo__opcional"> (opcional)</span>}
          {hayValor && !conError && (
            <>
              {" · "}
              <button
                type="button"
                className="campo-hint__accion"
                onClick={() => setAbierto((a) => !a)}
                aria-expanded={mostrarCampos}
                disabled={disabled}
              >
                {mostrarCampos ? "listo" : "cambiar"}
              </button>
            </>
          )}
        </span>
      </p>

      {mostrarCampos && (
        <div className="modal-form-fila">
          <ControlOpcion
            etiqueta={etiqueta}
            opciones={OPCIONES_TIPO}
            valor={tipo}
            onCambiar={setTipo}
            variante="segmentado"
            disabled={disabled}
          />
          <label>
            Cotización ($ por US$)
            <div className={`campo${conError ? " campo--error" : ""}`}>
              <span className="campo__prefijo">$</span>
              <input
                type="number"
                inputMode="decimal"
                name="cotizacion_dolar"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                min="0"
                step="0.0001"
                required={requerido}
                disabled={disabled}
              />
            </div>
            <ErrorCampo texto={conError ? error : null} />
          </label>
        </div>
      )}
    </div>
  );
}

export default CamposCotizacion;
