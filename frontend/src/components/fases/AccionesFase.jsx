import { useMemo, useState } from "react";
import { FileText, FileSignature, Pencil, Trash2 } from "lucide-react";
import { formatMoneda, formatFecha } from "../../utils/formato";
import { getEstadoPago, getEstadoEnvio } from "../../constants/estadoCompra";
import { esCompraImpaga, diasDesde } from "../../utils/seguimiento";
import "./AccionesFase.css";

const FILTROS_TIPO = [
  { key: "todo", label: "Todo" },
  { key: "compras", label: "Compras" },
  { key: "gastos", label: "Gastos" },
  { key: "sin_pagar", label: "Sin pagar" },
];

function categoriaCompra(compra, productos) {
  const primerDetalle = compra.detalle?.[0];
  if (!primerDetalle) return "—";
  const producto = productos.find((p) => p.id === primerDetalle.producto_id);
  return producto?.categorias?.[0]?.nombre ?? "—";
}

/**
 * Tab "Acciones de la fase" de FaseDetalle.jsx (mock 2c, claudedesign/):
 * compras y gastos, que antes vivían en sub-tabs separadas con tarjetas,
 * ahora comparten una sola planilla con filtro por tipo. Estado de pago y
 * de envío togglean desde la fila, comprobantes se ven como contador con
 * acceso directo (abre el primero sin pasar por un modal). Editar/eliminar
 * y agregar nota de crédito/débito (sólo compras) quedan como iconos que
 * aparecen en hover -- comprobantes se siguen agregando/quitando desde el
 * modal de edición, no inline.
 */
export function AccionesFase({
  canManage,
  nombreProveedor,
  productos,
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

  const movimientos = useMemo(() => {
    const deCompras = compras.map((compra) => ({ tipo: "compra", fecha: compra.fecha, compra }));
    const deGastos = gastos.map((gasto) => ({ tipo: "gasto", fecha: gasto.fecha, gasto }));
    return [...deCompras, ...deGastos].sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [compras, gastos]);

  const sinPagarCount = compras.filter(esCompraImpaga).length;

  const visibles = movimientos.filter((m) => {
    if (filtroTipo === "compras") return m.tipo === "compra";
    if (filtroTipo === "gastos") return m.tipo === "gasto";
    if (filtroTipo === "sin_pagar") return m.tipo === "compra" && esCompraImpaga(m.compra);
    return true;
  });

  // Los totales del pie reflejan lo que está visible con el filtro actual,
  // no siempre el total de la fase -- para que la fila de total nunca
  // contradiga a las filas que tiene arriba.
  const totalVisible = visibles.reduce(
    (acc, m) => acc + (m.tipo === "compra" ? m.compra.precio_total : m.gasto.monto),
    0
  );
  const totalSinPagarVisible = visibles
    .filter((m) => m.tipo === "compra" && esCompraImpaga(m.compra))
    .reduce((acc, m) => acc + m.compra.precio_total, 0);

  if (movimientos.length === 0) {
    return <p>No hay compras ni gastos registrados para esta fase.</p>;
  }

  return (
    <div>
      <div className="acciones-fase-filtros">
        {FILTROS_TIPO.map((f) => {
          const cantidad =
            f.key === "todo"
              ? movimientos.length
              : f.key === "compras"
                ? compras.length
                : f.key === "gastos"
                  ? gastos.length
                  : sinPagarCount;
          return (
            <button
              key={f.key}
              type="button"
              className={`acciones-fase-filtro${filtroTipo === f.key ? " acciones-fase-filtro--activo" : ""}${f.key === "sin_pagar" ? " acciones-fase-filtro--alerta" : ""}`}
              onClick={() => setFiltroTipo(f.key)}
            >
              {f.label}
              <span className="acciones-fase-filtro-contador">{cantidad}</span>
            </button>
          );
        })}
      </div>

      {visibles.length === 0 ? (
        <p>Ningún movimiento coincide con el filtro.</p>
      ) : (
        <div className="acciones-fase-tabla">
          <div className="acciones-fase-tabla-header">
            <span className="label-ficha">Tipo</span>
            <span className="label-ficha">Detalle</span>
            <span className="label-ficha">Proveedor / Categoría</span>
            <span className="label-ficha acciones-fase-col--num">Monto</span>
            <span className="label-ficha">Pago</span>
            <span className="label-ficha">Envío</span>
            <span />
          </div>

          {visibles.map((m) => {
            const esCompra = m.tipo === "compra";
            const item = esCompra ? m.compra : m.gasto;
            const impaga = esCompra && esCompraImpaga(item);
            const estadoPago = esCompra ? getEstadoPago(item.estado_pago) : null;
            const estadoEnvio = esCompra ? getEstadoEnvio(item.estado_envio) : null;
            const comprobantes = item.comprobantes ?? [];
            const tieneNotaCredito = esCompra && (item.notas ?? []).some((n) => n.tipo === "nota_credito");
            const tieneNotaDebito = esCompra && (item.notas ?? []).some((n) => n.tipo === "nota_debito");

            return (
              <div
                key={`${m.tipo}-${item.id}`}
                className={`acciones-fase-fila${impaga ? " acciones-fase-fila--impaga" : ""}`}
                onClick={() => (esCompra ? onAbrirDetalleCompra(item) : onAbrirDetalleGasto(item))}
              >
                <span className={`acciones-fase-tipo ${esCompra ? "acciones-fase-tipo--compra" : "acciones-fase-tipo--gasto"}`}>
                  {esCompra ? "Compra" : "Gasto"}
                </span>

                <span className="acciones-fase-col--detalle">
                  <span className="acciones-fase-descripcion">{item.descripcion}</span>
                  <span className={impaga ? "acciones-fase-subtexto acciones-fase-subtexto--alerta" : "acciones-fase-subtexto"}>
                    {impaga
                      ? `${diasDesde(item.fecha, new Date())} días sin pagar`
                      : formatFecha(item.fecha)}
                  </span>
                </span>

                <span className="acciones-fase-col--detalle">
                  <span className="acciones-fase-proveedor">
                    {esCompra ? nombreProveedor(item.proveedor_id) : "—"}
                  </span>
                  <span className="acciones-fase-subtexto">
                    {esCompra ? categoriaCompra(item, productos) : (item.categorias?.[0]?.nombre ?? "—")}
                  </span>
                </span>

                <span className="acciones-fase-col--num">
                  {formatMoneda(esCompra ? item.precio_total : item.monto)}
                </span>

                {esCompra ? (
                  <button
                    type="button"
                    className="acciones-fase-chip"
                    style={{
                      color: estadoPago.color,
                      backgroundColor: `${estadoPago.color}14`,
                      borderColor: `${estadoPago.color}55`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePagoCompra(item);
                    }}
                  >
                    {estadoPago.label}
                  </button>
                ) : (
                  <span className="acciones-fase-sin-dato">—</span>
                )}

                {esCompra ? (
                  <button
                    type="button"
                    className="acciones-fase-chip"
                    style={{
                      color: estadoEnvio.color,
                      backgroundColor: `${estadoEnvio.color}14`,
                      borderColor: `${estadoEnvio.color}55`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleEnvioCompra(item);
                    }}
                  >
                    {estadoEnvio.label}
                  </button>
                ) : (
                  <span className="acciones-fase-sin-dato">—</span>
                )}

                <span className="acciones-fase-col--accion">
                  <button
                    type="button"
                    className={`acciones-fase-comprobantes${comprobantes.length === 0 ? " acciones-fase-comprobantes--vacio" : ""}`}
                    title={
                      comprobantes.length > 0
                        ? "Ver el primer comprobante"
                        : "Sin comprobantes cargados"
                    }
                    disabled={comprobantes.length === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      const verComprobante = esCompra ? onVerComprobanteCompra : onVerComprobanteGasto;
                      verComprobante(item.id, comprobantes[0].id)
                        .then((blob) => {
                          const url = URL.createObjectURL(blob);
                          window.open(url, "_blank", "noopener,noreferrer");
                          setTimeout(() => URL.revokeObjectURL(url), 60_000);
                        })
                        .catch((error) => console.error("Error abriendo el comprobante:", error));
                    }}
                  >
                    <FileText size={13} strokeWidth={2} />
                    {comprobantes.length}
                  </button>
                  {(tieneNotaCredito || tieneNotaDebito) && (
                    <span
                      className="acciones-fase-nota"
                      title={tieneNotaCredito ? "Tiene nota de crédito" : "Tiene nota de débito"}
                    >
                      {tieneNotaCredito ? "NC" : "ND"}
                    </span>
                  )}
                  {canManage && (
                    <span className="acciones-fase-acciones">
                      {esCompra && (
                        <button
                          type="button"
                          className="acciones-fase-accion-btn"
                          title="Agregar nota de crédito/débito"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAgregarNotaCompra(item);
                          }}
                        >
                          <FileSignature size={13} strokeWidth={2} />
                        </button>
                      )}
                      <button
                        type="button"
                        className="acciones-fase-accion-btn"
                        title={esCompra ? "Editar compra" : "Editar gasto"}
                        onClick={(e) => {
                          e.stopPropagation();
                          esCompra ? onEditarCompra(item) : onEditarGasto(item);
                        }}
                      >
                        <Pencil size={13} strokeWidth={2} />
                      </button>
                      <button
                        type="button"
                        className="acciones-fase-accion-btn acciones-fase-accion-btn--eliminar"
                        title={esCompra ? "Eliminar compra" : "Eliminar gasto"}
                        onClick={(e) => {
                          e.stopPropagation();
                          esCompra ? onEliminarCompra(item.id) : onEliminarGasto(item.id);
                        }}
                      >
                        <Trash2 size={13} strokeWidth={2} />
                      </button>
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          <div className="acciones-fase-total">
            <span />
            <span>
              {visibles.length} {visibles.length === 1 ? "MOVIMIENTO" : "MOVIMIENTOS"}
              {filtroTipo === "todo" ? " EN LA FASE" : " CON ESTE FILTRO"}
            </span>
            <span />
            <span className="acciones-fase-col--num">{formatMoneda(totalVisible)}</span>
            <span className="acciones-fase-total-sinpagar">
              {totalSinPagarVisible > 0 ? `${formatMoneda(totalSinPagarVisible)} sin pagar` : ""}
            </span>
            <span />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}

export default AccionesFase;
