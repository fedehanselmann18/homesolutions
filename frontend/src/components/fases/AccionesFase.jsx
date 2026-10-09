import { useMemo, useState } from "react";
import { Check } from "lucide-react";

import FiltrosLista from "../shared/FiltrosLista";
import { FiltrosSegmentados } from "../shared/FiltrosSegmentados";
import { BotonMovimiento } from "../shared/BotonMovimiento";
import { EstadoVacio } from "../shared/EstadoVacio";
import LibroDeObra from "../proyectos/LibroDeObra";
import {
  FILTROS_VACIOS,
  CAMPOS_FILTRO_POR_TIPO,
  filtrosParaTipo,
  filtrarCompras,
  filtrarGastos,
  tieneAlerta,
  tieneNotas,
} from "../../utils/filtros";
import { calcularSeguimiento, armarBandeja } from "../../utils/seguimiento";
import { montoGasto, precioTotalCompra } from "../../utils/moneda";
import { formatMoneda, formatNumero } from "../../utils/formato";

import "../proyectos/Acciones.css";
import "./AccionesFase.css";

// Cuántos pendientes entran en el panel antes del "y N más".
const PENDIENTES_EN_PANEL = 5;

function textoPendiente(item) {
  if (item.estado === "impaga") {
    return item.diasVencida
      ? `vencida hace ${item.diasVencida === 1 ? "1 día" : `${item.diasVencida} días`}`
      : "a pagar";
  }
  if (item.estado === "sinEntregar") return "sin entregar";
  return "falta comprobante";
}

/**
 * El panel de la derecha de 4h: cuánto lleva la fase y qué le falta. Los
 * pendientes salen de la misma bandeja que el Seguimiento del proyecto
 * (armarBandeja), acotada a esta fase y ya ordenada por urgencia.
 */
function PanelFase({
  kpis,
  compras,
  gastos,
  productos,
  proveedores,
  onAbrirPendiente,
  onVerTodos,
  onTerminar,
}) {
  const pendientes = useMemo(
    () =>
      armarBandeja(calcularSeguimiento({ compras, gastos, productos, proveedores })).flatMap(
        (grupo) => grupo.items.map((item) => ({ ...item, grupo: grupo.clave }))
      ),
    [compras, gastos, productos, proveedores]
  );
  const visibles = pendientes.slice(0, PENDIENTES_EN_PANEL);
  const resto = pendientes.length - visibles.length;

  const pct = kpis?.pctPresupuesto ?? 0;
  const totalCompras = compras.reduce((acc, c) => acc + precioTotalCompra(c, "ars"), 0);
  const totalGastos = gastos.reduce((acc, g) => acc + montoGasto(g, "ars"), 0);

  return (
    <aside className="panel-fase" aria-label="Resumen de la fase">
      <div className="panel-fase__gastado">
        <span className="panel-fase__label">Gastado en la fase</span>
        <span className="panel-fase__monto">{formatMoneda(kpis?.gastadoFase.usd ?? 0, "usd")}</span>
        <div className="panel-fase__barra">
          <span
            className={pct > 100 ? "panel-fase__relleno--excedido" : undefined}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <span className="panel-fase__label">
          {formatNumero(pct, 1)}% del presupuesto del proyecto
        </span>
      </div>

      <dl className="panel-fase__totales">
        <div>
          <dt>Compras</dt>
          <dd>{formatMoneda(totalCompras)}</dd>
        </div>
        <div>
          <dt>Gastos</dt>
          <dd>{formatMoneda(totalGastos)}</dd>
        </div>
      </dl>

      <div className="panel-fase__pendientes">
        <h3 className="panel-fase__titulo">Pendientes</h3>
        {visibles.length === 0 ? (
          <p className="panel-fase__vacio">Nada pendiente en esta fase.</p>
        ) : (
          <ul>
            {visibles.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  className={`panel-fase__pendiente panel-fase__pendiente--${item.grupo}`}
                  onClick={() => onAbrirPendiente(item.tipo, item.id)}
                >
                  <span className="panel-fase__punto" aria-hidden="true" />
                  <span>
                    {item.titulo} · {textoPendiente(item)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {resto > 0 && (
          <button type="button" className="panel-fase__mas" onClick={onVerTodos}>
            Ver {resto === 1 ? "1 más" : `${resto} más`}
          </button>
        )}
      </div>

      {onTerminar && (
        <button
          type="button"
          className="btn btn-secondary panel-fase__terminar"
          onClick={onTerminar}
        >
          <Check size={15} strokeWidth={2} aria-hidden="true" />
          Terminar fase
        </button>
      )}
    </aside>
  );
}

// Una fase no tiene cobros (el cobro es del proyecto), así que acá el libro de
// obra sólo lleva compras y gastos.
const FILTROS_TIPO = [
  { key: "todo", label: "Todo" },
  { key: "compras", label: "Compras" },
  { key: "gastos", label: "Gastos" },
  { key: "alertas", label: "Con alertas" },
  { key: "conNotas", label: "Con nota de crédito/débito" },
];

/**
 * Tab "Acciones de la fase" de FaseDetalle.jsx (variante 4h): a la izquierda
 * el mismo libro de obra que el proyecto (LibroDeObra, en su versión
 * compacta), acotado a los movimientos de esta fase; a la derecha un panel
 * fijo con lo gastado y los pendientes. Los estados de pago/envío se togglean
 * desde la fila y el click abre el modal de detalle de lectura.
 */
export function AccionesFase({
  canManage,
  onNuevoGasto,
  onNuevaCompra,
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
  kpis,
  productos = [],
  proveedores = [],
  onVerSeguimiento,
  onTerminarFase,
}) {
  const [filtroTipo, setFiltroTipo] = useState("todo");
  const camposFiltro = CAMPOS_FILTRO_POR_TIPO[filtroTipo];
  const [filtros, setFiltros] = useState(FILTROS_VACIOS);

  const comprasFiltradas = useMemo(() => filtrarCompras(compras, filtros), [compras, filtros]);
  const gastosFiltrados = useMemo(() => filtrarGastos(gastos, filtros), [gastos, filtros]);

  // "Con alertas": mismo criterio que la lista del proyecto (utils/filtros.js).
  const comprasConAlerta = comprasFiltradas.filter((c) => tieneAlerta("compra", c));
  const gastosConAlerta = gastosFiltrados.filter((g) => tieneAlerta("gasto", g));
  // "Con nota de crédito/débito": sólo compras, un gasto no lleva notas.
  const comprasConNotas = comprasFiltradas.filter(tieneNotas);

  const visiblesPorFiltro = {
    todo: [comprasFiltradas, gastosFiltrados],
    compras: [comprasFiltradas, []],
    gastos: [[], gastosFiltrados],
    alertas: [comprasConAlerta, gastosConAlerta],
    conNotas: [comprasConNotas, []],
  };
  const [comprasVisibles, gastosVisibles] = visiblesPorFiltro[filtroTipo];

  const contadorPorFiltro = {
    todo: comprasFiltradas.length + gastosFiltrados.length,
    compras: comprasFiltradas.length,
    gastos: gastosFiltrados.length,
    alertas: comprasConAlerta.length + gastosConAlerta.length,
    conNotas: comprasConNotas.length,
  };

  // Pegados a la lista (no en el header de la página): es donde se mira lo que
  // se acaba de cargar.
  const botonesNuevo = canManage && (
    <div className="acciones-nuevo">
      <BotonMovimiento tipo="gasto" onClick={onNuevoGasto} />
      <BotonMovimiento tipo="compra" principal onClick={onNuevaCompra}>
        Nueva compra
      </BotonMovimiento>
    </div>
  );

  const abrirPendiente = (tipo, id) => {
    if (tipo === "compra") onAbrirDetalleCompra(compras.find((c) => c.id === id));
    else onAbrirDetalleGasto(gastos.find((g) => g.id === id));
  };

  const panel = (
    <PanelFase
      kpis={kpis}
      compras={compras}
      gastos={gastos}
      productos={productos}
      proveedores={proveedores}
      onAbrirPendiente={abrirPendiente}
      onVerTodos={onVerSeguimiento}
      onTerminar={onTerminarFase}
    />
  );

  if (compras.length === 0 && gastos.length === 0) {
    return (
      <div className="acciones-fase">
        <div className="acciones-fase__lista">
          {botonesNuevo}
          <EstadoVacio mensaje="No hay compras ni gastos registrados para esta fase." />
        </div>
        {panel}
      </div>
    );
  }

  return (
    <div className="acciones-fase">
      <div className="acciones-fase__lista">
        {botonesNuevo}
        <FiltrosLista
          filtros={filtros}
          onCambiar={setFiltros}
          mostrarEstadoPago={camposFiltro.includes("estadoPago")}
          mostrarEstadoEnvio={camposFiltro.includes("estadoEnvio")}
          mostrarNotas={camposFiltro.includes("notas")}
          mostrarComprobante={camposFiltro.includes("comprobante")}
          mostrarFechas={false}
        >
          <FiltrosSegmentados
            opciones={FILTROS_TIPO}
            activa={filtroTipo}
            contadores={contadorPorFiltro}
            etiqueta="Filtrar movimientos por tipo"
            onCambiar={(key) => {
              setFiltroTipo(key);
              setFiltros((actuales) => filtrosParaTipo(actuales, key));
            }}
          />
        </FiltrosLista>

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
          onEliminar={(tipo, id) =>
            tipo === "compra" ? onEliminarCompra(id) : onEliminarGasto(id)
          }
          onAgregarNota={(_tipo, entidad) => onAgregarNotaCompra(entidad)}
          onVerComprobante={(tipo, entidadId, comprobanteId) =>
            tipo === "compra"
              ? onVerComprobanteCompra(entidadId, comprobanteId)
              : onVerComprobanteGasto(entidadId, comprobanteId)
          }
        />
      </div>
      {panel}
    </div>
  );
}

export default AccionesFase;
