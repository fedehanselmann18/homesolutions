import { useId, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";

import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import {
  FILTRO_NOTAS,
  FILTRO_ESTADO_PAGO,
  FILTRO_ESTADO_ENVIO,
  FILTRO_COMPROBANTE,
  FILTROS_VACIOS,
} from "../../utils/filtros";
import { formatFecha } from "../../utils/formato";

import "./FiltrosLista.css";

const OPCIONES_TIPO_FACTURA = [{ value: "", label: "Todos" }, ...TIPOS_FACTURA];

/**
 * Filtros de una lista de Compras / Cobros / Gastos (Movimientos v2).
 * Componente controlado: recibe `filtros` + `onCambiar` y no guarda más
 * estado que si el panel está abierto, así el padre decide qué hacer con el
 * resultado (filtrarCompras/filtrarCobros/filtrarGastos de utils/filtros.js).
 *
 * Es una barra: a la izquierda va lo que el padre pase como `children` (los
 * chips de tipo, normalmente) y a la derecha el botón "Filtrar", que abre un
 * panel con los campos. Los filtros aplicados quedan a la vista abajo, como
 * chips que se sacan con su ×: con el panel cerrado, la lista nunca filtra
 * por algo que no se ve.
 *
 * `mostrarNotas` sólo aplica a Compras/Cobros (Gasto no tiene notas).
 * `mostrarEstadoPago`/`mostrarEstadoEnvio` sólo aplican a Compras.
 * `mostrarComprobante` aplica a los tres.
 * `mostrarFechas` se apaga donde la lista ya está ordenada y agrupada por día
 * (el libro de obra), que es donde el rango de fechas no agrega nada.
 * `proyectos` sólo se pasa desde la lista de compras de un proveedor, que es
 * la única que cruza varios proyectos (parado adentro de uno no hay nada que
 * elegir); si no viene, el campo ni se dibuja.
 */
export function FiltrosLista({
  filtros,
  onCambiar,
  mostrarNotas = false,
  mostrarEstadoPago = false,
  mostrarEstadoEnvio = false,
  mostrarComprobante = false,
  mostrarFechas = true,
  proyectos = null,
  children,
}) {
  const [abierto, setAbierto] = useState(false);
  const idPanel = useId();

  const cambiarCampo = (campo, valor) => onCambiar({ ...filtros, [campo]: valor });

  const opcionesProyecto = proyectos
    ? [{ value: "", label: "Todos" }, ...proyectos.map((p) => ({ value: p.id, label: p.nombre }))]
    : null;

  // Cada campo que se dibuja: de acá salen los selects del panel y los chips
  // de "aplicado", así no hay dos listas que mantener a mano.
  const campos = [
    opcionesProyecto && { campo: "proyecto", label: "Proyecto", opciones: opcionesProyecto },
    mostrarEstadoPago && { campo: "estadoPago", label: "Pago", opciones: FILTRO_ESTADO_PAGO },
    mostrarEstadoEnvio && { campo: "estadoEnvio", label: "Envío", opciones: FILTRO_ESTADO_ENVIO },
    mostrarNotas && { campo: "notas", label: "Notas", opciones: FILTRO_NOTAS },
    { campo: "tipoFactura", label: "Tipo de factura", opciones: OPCIONES_TIPO_FACTURA },
    mostrarComprobante && {
      campo: "comprobante",
      label: "Comprobante",
      opciones: FILTRO_COMPROBANTE,
    },
  ].filter(Boolean);

  const aplicados = [
    ...campos
      .filter(({ campo }) => filtros[campo] !== FILTROS_VACIOS[campo])
      .map(({ campo, label, opciones }) => ({
        campo,
        texto: `${label}: ${opciones.find((o) => o.value === filtros[campo])?.label ?? filtros[campo]}`,
      })),
    mostrarFechas &&
      filtros.desde && { campo: "desde", texto: `Desde ${formatFecha(filtros.desde)}` },
    mostrarFechas &&
      filtros.hasta && { campo: "hasta", texto: `Hasta ${formatFecha(filtros.hasta)}` },
  ].filter(Boolean);

  return (
    <div className="filtros-lista">
      <div className="filtros-lista__barra">
        <div className="filtros-lista__izquierda">{children}</div>
        <button
          type="button"
          className={`btn btn--sm btn-secondary filtros-lista__toggle${
            abierto ? " filtros-lista__toggle--abierto" : ""
          }`}
          aria-expanded={abierto}
          aria-controls={idPanel}
          onClick={() => setAbierto((v) => !v)}
        >
          <SlidersHorizontal size={14} strokeWidth={1.75} aria-hidden="true" />
          Filtrar
          {aplicados.length > 0 && <span className="chip__contador">{aplicados.length}</span>}
        </button>
      </div>

      {abierto && (
        <div className="filtros-lista__panel" id={idPanel}>
          {campos.map(({ campo, label, opciones }) => (
            <label key={campo} className="filtros-lista__campo">
              <span className="label-campo">{label}</span>
              <select
                className="campo campo--sm"
                value={filtros[campo]}
                onChange={(e) => cambiarCampo(campo, e.target.value)}
              >
                {opciones.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}

          {mostrarFechas && (
            <>
              <label className="filtros-lista__campo">
                <span className="label-campo">Desde</span>
                <input
                  type="date"
                  className="campo campo--sm"
                  value={filtros.desde}
                  onChange={(e) => cambiarCampo("desde", e.target.value)}
                />
              </label>
              <label className="filtros-lista__campo">
                <span className="label-campo">Hasta</span>
                <input
                  type="date"
                  className="campo campo--sm"
                  value={filtros.hasta}
                  onChange={(e) => cambiarCampo("hasta", e.target.value)}
                />
              </label>
            </>
          )}
        </div>
      )}

      {aplicados.length > 0 && (
        <div className="filtros-lista__aplicados" aria-label="Filtros aplicados">
          {aplicados.map(({ campo, texto }) => (
            <span key={campo} className="chip chip--quitable">
              {texto}
              <button
                type="button"
                className="chip__quitar"
                aria-label={`Quitar filtro ${texto}`}
                onClick={() => cambiarCampo(campo, FILTROS_VACIOS[campo])}
              >
                <X aria-hidden="true" />
              </button>
            </span>
          ))}
          {aplicados.length > 1 && (
            <button
              type="button"
              className="filtros-lista__limpiar"
              onClick={() => onCambiar(FILTROS_VACIOS)}
            >
              Limpiar filtros
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default FiltrosLista;
