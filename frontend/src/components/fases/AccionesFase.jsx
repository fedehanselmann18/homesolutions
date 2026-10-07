import { useMemo, useState } from "react";

import FiltrosLista from "../shared/FiltrosLista";
import { FiltrosSegmentados } from "../shared/FiltrosSegmentados";
import { EstadoVacio } from "../shared/EstadoVacio";
import LibroDeObra from "../proyectos/LibroDeObra";
import { FILTROS_VACIOS, filtrarCompras, filtrarGastos, tieneAlerta } from "../../utils/filtros";

import "../proyectos/Acciones.css";

// Una fase no tiene cobros (el cobro es del proyecto), así que acá el libro de
// obra sólo lleva compras y gastos.
const FILTROS_TIPO = [
  { key: "todo", label: "Todo" },
  { key: "compras", label: "Compras" },
  { key: "gastos", label: "Gastos" },
  { key: "alertas", label: "Con alertas" },
];

/**
 * Tab "Acciones de la fase" de FaseDetalle.jsx: la misma planilla que el
 * proyecto (ver LibroDeObra), acotada a los movimientos de esta fase. Los
 * estados de pago/envío se togglean desde la fila y el click abre el modal de
 * detalle de lectura.
 */
export function AccionesFase({
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
    return <EstadoVacio mensaje="No hay compras ni gastos registrados para esta fase." />;
  }

  // "Con alertas": mismo criterio que la lista del proyecto (utils/filtros.js).
  const comprasConAlerta = comprasFiltradas.filter((c) => tieneAlerta("compra", c));
  const gastosConAlerta = gastosFiltrados.filter((g) => tieneAlerta("gasto", g));

  const visiblesPorFiltro = {
    todo: [comprasFiltradas, gastosFiltrados],
    compras: [comprasFiltradas, []],
    gastos: [[], gastosFiltrados],
    alertas: [comprasConAlerta, gastosConAlerta],
  };
  const [comprasVisibles, gastosVisibles] = visiblesPorFiltro[filtroTipo];

  const contadorPorFiltro = {
    todo: comprasFiltradas.length + gastosFiltrados.length,
    compras: comprasFiltradas.length,
    gastos: gastosFiltrados.length,
    alertas: comprasConAlerta.length + gastosConAlerta.length,
  };

  return (
    <div>
      <FiltrosSegmentados
        opciones={FILTROS_TIPO}
        activa={filtroTipo}
        contadores={contadorPorFiltro}
        etiqueta="Filtrar movimientos por tipo"
        onCambiar={(key) => {
          setFiltroTipo(key);
          if (key !== "compras") setFiltros(FILTROS_VACIOS);
        }}
      />

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
