import { X } from "lucide-react";

import { formatMoneda } from "../../utils/formato";
import {
  alicuotaDeFila,
  calcularImpuesto,
  elegirImpuesto,
  etiquetaImpuesto,
  formatoAlicuota,
  grupoRepetido,
  montoFila,
  tipearMonto,
  volverAlCalculado,
} from "../../utils/impuestos";
import { ErrorCampo } from "../shared/ErrorCampo";
import "./FilasImpuestos.css";

/**
 * Las filas de impuesto de una compra o de una nota de devolución (ver
 * utils/impuestos.js). Un impuesto con alícuota (IVA 21, IVA 10,5) se
 * calcula solo sobre `base` y sigue al neto; si se tipea otro monto queda
 * fijo, con el calculado a la vista para volver a él. Sin alícuota se tipea.
 *
 * Controlado: `filas` + `onCambiar(filasNuevas)`. El título y el botón de
 * agregar los pone cada modal (cada uno tiene su encabezado).
 */
export function FilasImpuestos({ filas, onCambiar, base, disponibles, disabled = false }) {
  const cambiarFila = (id, transformar) =>
    onCambiar(filas.map((fila) => (fila._id === id ? transformar(fila) : fila)));
  const quitarFila = (id) => onCambiar(filas.filter((fila) => fila._id !== id));
  const repetido = grupoRepetido(filas, disponibles);

  return (
    <>
      {filas.map((fila) => {
        const alicuota = alicuotaDeFila(fila, disponibles);
        const monto = montoFila(fila, base, disponibles);
        return (
          <div key={fila._id} className="filas-impuestos__fila">
            <div className="tabla-form__impuesto">
              <select
                className="campo campo--sm"
                value={fila.impuesto_id}
                onChange={(e) =>
                  cambiarFila(fila._id, (f) => elegirImpuesto(f, e.target.value, disponibles))
                }
                aria-label="Impuesto"
                disabled={disabled}
              >
                <option value="">Impuesto…</option>
                {disponibles.map((imp) => (
                  <option key={imp.id} value={imp.id}>
                    {etiquetaImpuesto(imp)}
                  </option>
                ))}
              </select>
              <div className="campo campo--sm">
                <span className="campo__prefijo">$</span>
                <input
                  type="number"
                  aria-label="Monto del impuesto"
                  value={fila.auto && alicuota ? monto : fila.monto}
                  onChange={(e) => cambiarFila(fila._id, (f) => tipearMonto(f, e.target.value))}
                  min="0"
                  step="0.01"
                  disabled={disabled}
                />
              </div>
              <button
                type="button"
                className="btn-icono btn-icono--sm"
                aria-label="Quitar impuesto"
                onClick={() => quitarFila(fila._id)}
                disabled={disabled}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            {alicuota && (
              <p className="tabla-form__hint filas-impuestos__pista">
                {fila.auto ? (
                  `${formatoAlicuota(alicuota)} sobre ${formatMoneda(base)}`
                ) : (
                  <>
                    A mano. Calculado: {formatMoneda(calcularImpuesto(base, alicuota))}
                    {" · "}
                    <button
                      type="button"
                      className="filas-impuestos__link"
                      onClick={() => cambiarFila(fila._id, volverAlCalculado)}
                      disabled={disabled}
                    >
                      usar el calculado
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        );
      })}
      <ErrorCampo
        texto={
          repetido &&
          `Una factura lleva una sola alícuota de ${repetido}: dejá un solo impuesto de ${repetido}.`
        }
      />
    </>
  );
}

export default FilasImpuestos;
