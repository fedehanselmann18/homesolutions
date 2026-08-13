import { useState } from "react";
import { X, FileMinus, FilePlus, ChevronDown } from "lucide-react";
import { getOrigenNotaLabel } from "../../constants/notas";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { formatMoneda, formatFecha } from "../../utils/formato";
import { obtenerMensajeError } from "../../utils/errorHandling";
import "./SeccionNotas.css";

/**
 * Lista las notas de crédito/débito (cuenta corriente) de una Compra o un
 * Cobro puntual, con un botón dedicado para agregar una nueva -- separado de
 * SeccionComprobantes (que es solo para factura/remito, sin plata propia).
 *
 * No maneja el modal de alta: onAgregar() avisa al padre (la página, que es
 * quien tiene ModalNota montado, mismo criterio que onEditar en las demás cards).
 *
 * Props:
 * - notas: [{ id, tipo, origen, tipo_factura, monto, descripcion, fecha, archivo_path, detalles?: [{detalle_compra_id, cantidad}] }]
 * - contexto: "compra" | "cobro" (para las etiquetas de origen)
 * - variant: "detallada" (default, todo el detalle siempre visible) | "compacta"
 *   (cada nota colapsada muestra solo motivo + monto; el detalle -- fecha,
 *   productos, comprobante -- aparece al hacer click. Pensada para la columna
 *   angosta de CompraCard; el resto de los usos no pasan esta prop y no cambian)
 * - resolverProducto(detalleCompraId) => string | null (solo compra)
 * - onVer(nota) => Promise<Blob>
 * - onAgregar: () => void
 * - onEliminar(notaId) => Promise
 * - canManage: bool
 */
export function SeccionNotas({
  notas = [],
  contexto = "compra",
  variant = "detallada",
  resolverProducto,
  onVer,
  onAgregar,
  onEliminar,
  canManage = false,
}) {
  const [eliminandoId, setEliminandoId] = useState(null);
  const [viendoId, setViendoId] = useState(null);
  const [abiertaIds, setAbiertaIds] = useState(() => new Set());
  const [error, setError] = useState("");

  const compacta = variant === "compacta";

  const toggleAbierta = (notaId) => {
    setAbiertaIds((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(notaId)) {
        siguiente.delete(notaId);
      } else {
        siguiente.add(notaId);
      }
      return siguiente;
    });
  };

  const handleEliminar = async (notaId) => {
    setError("");
    setEliminandoId(notaId);
    try {
      await onEliminar(notaId);
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setEliminandoId(null);
    }
  };

  const handleVer = async (nota) => {
    if (!onVer) return;
    setError("");
    setViendoId(nota.id);
    try {
      const blob = await onVer(nota);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setViendoId(null);
    }
  };

  return (
    <div className="seccion-notas">
      <div className="seccion-notas-header">
        <span className="seccion-notas-titulo">
          Notas de crédito / débito
          {notas.length > 0 && <span className="seccion-notas-contador">{notas.length}</span>}
        </span>
        {canManage && onAgregar && (
          <button type="button" className="seccion-notas-btn-agregar" onClick={onAgregar}>
            {compacta ? "+ Nota" : "+ Agregar nota de crédito"}
          </button>
        )}
      </div>

      {notas.length === 0 ? (
        <p className="seccion-notas-vacio">Sin notas cargadas.</p>
      ) : (
        <ul className="seccion-notas-lista">
          {notas.map((n) => {
            const esCredito = n.tipo === "nota_credito";
            const productos = (n.detalles ?? [])
              .map((d) => {
                const nombre = d.detalle_compra_id ? resolverProducto?.(d.detalle_compra_id) : null;
                return nombre ? `${nombre} x${d.cantidad}` : null;
              })
              .filter(Boolean);
            const Icono = esCredito ? FileMinus : FilePlus;

            if (!compacta) {
              return (
                <li
                  key={n.id}
                  className={`seccion-notas-item ${esCredito ? "seccion-notas-item--credito" : "seccion-notas-item--debito"}`}
                >
                  <div className="seccion-notas-item-header">
                    <span className="seccion-notas-item-tipo">
                      <Icono size={13} strokeWidth={2.25} />
                      {esCredito ? "Nota de crédito" : "Nota de débito"}
                    </span>
                    <span className="seccion-notas-item-monto">
                      {esCredito ? "-" : "+"}
                      {formatMoneda(n.monto)}
                    </span>
                  </div>
                  <p className="seccion-notas-item-motivo">{n.descripcion}</p>
                  <div className="seccion-notas-item-meta">
                    {n.origen && <span>{getOrigenNotaLabel(n.origen, contexto)}</span>}
                    {n.tipo_factura && <span>{getTipoFacturaLabel(n.tipo_factura)}</span>}
                    {n.fecha && <span>{formatFecha(n.fecha)}</span>}
                  </div>
                  {productos.length > 0 && (
                    <p className="seccion-notas-item-productos">
                      {n.origen === "reposicion_producto"
                        ? "Productos de reposición"
                        : "Productos devueltos"}
                      : {productos.join(", ")}
                    </p>
                  )}
                  <div className="seccion-notas-item-acciones">
                    <button
                      type="button"
                      className="seccion-notas-link"
                      onClick={() => handleVer(n)}
                      disabled={viendoId === n.id}
                    >
                      {viendoId === n.id ? "Abriendo..." : "Ver comprobante"}
                    </button>
                    {canManage && onEliminar && (
                      <button
                        type="button"
                        className="seccion-notas-btn-eliminar"
                        onClick={() => handleEliminar(n.id)}
                        disabled={eliminandoId === n.id}
                        title="Eliminar"
                      >
                        {eliminandoId === n.id ? "..." : <X size={13} strokeWidth={2.25} />}
                      </button>
                    )}
                  </div>
                </li>
              );
            }

            const abierta = abiertaIds.has(n.id);
            return (
              <li
                key={n.id}
                className={`seccion-notas-item seccion-notas-item--compacta ${esCredito ? "seccion-notas-item--credito" : "seccion-notas-item--debito"}`}
              >
                <button
                  type="button"
                  className="seccion-notas-item-toggle"
                  onClick={() => toggleAbierta(n.id)}
                >
                  <span className="seccion-notas-item-tipo">
                    <Icono size={12} strokeWidth={2.25} />
                    {esCredito ? "Nota de crédito" : "Nota de débito"}
                    {n.descripcion && (
                      <span className="seccion-notas-item-motivo-inline"> · {n.descripcion}</span>
                    )}
                  </span>
                  <span className="seccion-notas-item-toggle-derecha">
                    <span className="seccion-notas-item-monto">
                      {esCredito ? "-" : "+"}
                      {formatMoneda(n.monto)}
                    </span>
                    <ChevronDown
                      size={13}
                      strokeWidth={2.25}
                      className={`seccion-notas-chevron${abierta ? " seccion-notas-chevron--abierta" : ""}`}
                    />
                  </span>
                </button>

                {abierta && (
                  <div className="seccion-notas-item-detalle">
                    <div className="seccion-notas-item-meta">
                      {n.origen && <span>{getOrigenNotaLabel(n.origen, contexto)}</span>}
                      {n.tipo_factura && <span>{getTipoFacturaLabel(n.tipo_factura)}</span>}
                      {n.fecha && <span>{formatFecha(n.fecha)}</span>}
                    </div>
                    {productos.length > 0 && (
                      <p className="seccion-notas-item-productos">
                        {n.origen === "reposicion_producto"
                          ? "Productos de reposición"
                          : "Productos devueltos"}
                        : {productos.join(", ")}
                      </p>
                    )}
                    <div className="seccion-notas-item-acciones">
                      <button
                        type="button"
                        className="seccion-notas-link"
                        onClick={() => handleVer(n)}
                        disabled={viendoId === n.id}
                      >
                        {viendoId === n.id ? "Abriendo..." : "Ver comprobante"}
                      </button>
                      {canManage && onEliminar && (
                        <button
                          type="button"
                          className="seccion-notas-btn-eliminar"
                          onClick={() => handleEliminar(n.id)}
                          disabled={eliminandoId === n.id}
                          title="Eliminar"
                        >
                          {eliminandoId === n.id ? "..." : <X size={13} strokeWidth={2.25} />}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="seccion-notas-error">{error}</p>}
    </div>
  );
}

export default SeccionNotas;
