import { useMemo, useState } from "react";

import FiltrosLista from "../shared/FiltrosLista";
import LibroDeObra from "../proyectos/LibroDeObra";
import { FILTROS_VACIOS, filtrarCompras, filtrarGastos } from "../../utils/filtros";

import "../proyectos/Acciones.css";

// Una fase no tiene cobros (el cobro es del proyecto), así que acá el libro de
// obra sólo lleva compras y gastos.
const FILTROS_TIPO = [
  { key: "todo", label: "Todo" },
  { key: "compras", label: "Compras" },
  { key: "gastos", label: "Gastos" },
];

/**
 * Tab "Acciones de la fase" de FaseDetalle.jsx: la misma planilla que el
 * proyecto (ver LibroDeObra), acotada a los movimientos de esta fase. Los
 * estados de pago/envío se togglean desde la fila y el click abre el modal de
 * detalle de lectura.
 */
export function AccionesFase({
  faseNombre,
  canManage,
  nombreProveedor,
  compras,
  gastos,
  onEditarCompra,
  onEliminarCompra,
  onTogglePagoCompra,
  onToggleEnvioCompra,
  onVerComprobanteCompra,
  onAbrirDetalleCompra,
  onAgregarNotaCompra,
  onEditarGasto,
  onEliminarGasto,
  onVerComprobanteGasto,
  onAbrirDetalleGasto,
}) {
  const [filtroTipo, setFiltroTipo] = useState("todo");
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);

  const comprasFiltradas = useMemo(() => filtrarCompras(compras, filtros), [compras, filtros]);
  const gastosFiltrados = useMemo(() => filtrarGastos(gastos, filtros), [gastos, filtros]);

  if (compras.length === 0 && gastos.length === 0) {
    return <p>No hay compras ni gastos registrados para esta fase.</p>;
  }

  const comprasVisibles = filtroTipo === "gastos" ? [] : comprasFiltradas;
  const gastosVisibles = filtroTipo === "compras" ? [] : gastosFiltrados;

  const contadorPorFiltro = {
    todo: comprasFiltradas.length + gastosFiltrados.length,
    compras: comprasFiltradas.length,
    gastos: gastosFiltrados.length,
  };

  return (
    <div>
      <div className="acciones-filtros-tipo">
        {FILTROS_TIPO.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`acciones-filtro-tipo${filtroTipo === f.key ? " acciones-filtro-tipo--activo" : ""}`}
            onClick={() => {
              setFiltroTipo(f.key);
              if (f.key !== "compras") setFiltros(FILTROS_VACIOS);
            }}
          >
            {f.label}
            <span className="acciones-filtro-tipo-contador">{contadorPorFiltro[f.key]}</span>
          </button>
        ))}
      </div>

      {filtroTipo === "compras" && (
        <FiltrosLista
          filtros={filtros}
          onCambiar={setFiltros}
          mostrarNotas
          mostrarEstadoPago
          mostrarEstadoEnvio
          mostrarFechas={false}
        />
      )}

      <LibroDeObra
        titulo={`Movimientos — ${faseNombre}`}
        compras={comprasVisibles}
        gastos={gastosVisibles}
        nombreProveedor={nombreProveedor}
        canManage={canManage}
        // Sin cobros el acumulado nunca sube: lo que muestra es cuánto lleva
        // consumido la fase, no un saldo.
        saldoLabel="Acumulado"
        onAbrirDetalle={(tipo, entidad) =>
          tipo === "compra" ? onAbrirDetalleCompra(entidad) : onAbrirDetalleGasto(entidad)
        }
        onTogglePagoCompra={onTogglePagoCompra}
        onToggleEnvioCompra={onToggleEnvioCompra}
        onEditar={(tipo, entidad) =>
          tipo === "compra" ? onEditarCompra(entidad) : onEditarGasto(entidad)
        }
        onEliminar={(tipo, id) => (tipo === "compra" ? onEliminarCompra(id) : onEliminarGasto(id))}
        onAgregarNota={(_tipo, entidad) => onAgregarNotaCompra(entidad)}
        onVerComprobante={(tipo, entidadId, comprobanteId) =>
          tipo === "compra"
            ? onVerComprobanteCompra(entidadId, comprobanteId)
            : onVerComprobanteGasto(entidadId, comprobanteId)
        }
      />
    </div>
  );
}

export default AccionesFase;
