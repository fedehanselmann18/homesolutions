import { useRef, useState } from "react";
import { X, Plus, Pencil } from "lucide-react";

import { formatMoneda } from "../../utils/formato";
import { iconoParaArchivo, nombreDeArchivo } from "../../utils/archivos";
import { obtenerMensajeError } from "../../utils/errorHandling";

import "./modal-base.css";
import "./ModalDetalle.css";
import { TINTE_PASTILLA } from "../../constants/tipoMovimiento";

/**
 * Piezas compartidas por los tres modales de detalle (Compra / Gasto / Cobro),
 * con el lenguaje visual de la dirección 3a del rediseño (ver claudedesign/).
 */

export function DetalleShell({
  tipo,
  icono: Icono,
  contexto,
  fecha,
  titulo,
  subtitulo,
  totalLabel = "Total",
  total,
  totalColor,
  onCerrar,
  // Opcional: pasar de "ver" a "editar" sin volver a la lista. Es una prop y
  // no algo fijo del shell porque Gasto/Cobro todavía no tienen su modal de
  // edición rediseñado -- sin el handler, el footer queda igual que antes.
  onEditar,
  children,
}) {
  return (
    <div className="modal-overlay" onClick={onCerrar}>
      <div className="modal-contenido detalle" onClick={(e) => e.stopPropagation()}>
        <div className="detalle__header">
          <span className="detalle__tipo">
            {Icono && <Icono size={13} strokeWidth={2.25} />}
            {tipo}
          </span>
          {contexto && <span className="detalle__separador" />}
          {contexto && <span className="detalle__contexto">{contexto}</span>}
          <span className="detalle__espaciador" />
          <span className="detalle__fecha">{fecha}</span>
          <button type="button" className="detalle__cerrar" onClick={onCerrar} title="Cerrar">
            <X size={17} strokeWidth={2} />
          </button>
        </div>

        <div className="detalle__cuerpo">
          <div className="detalle__titular">
            <div className="detalle__titular-texto">
              <h2>{titulo}</h2>
              {subtitulo && <span className="detalle__subtitulo">{subtitulo}</span>}
            </div>
            <div className="detalle__total">
              <span className="detalle__total-label">{totalLabel}</span>
              <span
                className="detalle__total-monto"
                style={totalColor ? { color: totalColor } : undefined}
              >
                {formatMoneda(total)}
              </span>
            </div>
          </div>

          {children}
        </div>

        <div className="detalle__footer">
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>
            Cerrar
          </button>
          {onEditar && (
            <button type="button" className="btn btn-primary detalle__editar" onClick={onEditar}>
              <Pencil size={14} strokeWidth={2} />
              Editar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Barra que descompone el total en sus partes, con la leyenda de importes
 * debajo. `segmentos`: [{ label, monto, color, signo }] -- signo -1 pinta el
 * importe en rojo con el menos adelante (notas de crédito), +1 en naranja con
 * el más (notas de débito), y sin signo queda neutro (neto, impuestos).
 */
export function BarraComposicion({ segmentos }) {
  const visibles = segmentos.filter((s) => Math.abs(s.monto) > 0);
  if (visibles.length === 0) return null;

  const suma = visibles.reduce((acc, s) => acc + Math.abs(s.monto), 0);

  return (
    <div className="detalle__composicion">
      <div className="detalle__barra">
        {visibles.map((s) => (
          <span
            key={s.label}
            style={{ width: `${(Math.abs(s.monto) / suma) * 100}%`, background: s.color }}
            title={`${s.label} ${formatMoneda(s.monto)}`}
          />
        ))}
      </div>
      <div className="detalle__leyenda">
        {visibles.map((s) => (
          <span key={s.label} className="detalle__leyenda-item">
            <span className="detalle__leyenda-punto" style={{ background: s.color }} />
            {s.label}{" "}
            <strong
              className={`detalle__leyenda-monto${
                s.signo === -1
                  ? " detalle__leyenda-monto--resta"
                  : s.signo === 1
                    ? " detalle__leyenda-monto--suma"
                    : ""
              }`}
            >
              {s.signo === -1 ? "-" : s.signo === 1 ? "+" : ""}
              {formatMoneda(Math.abs(s.monto))}
            </strong>
          </span>
        ))}
      </div>
    </div>
  );
}

export function SeccionDetalle({ titulo, children }) {
  return (
    <div className="detalle__seccion">
      <div className="detalle__seccion-titulo">
        <span>{titulo}</span>
        <span className="detalle__seccion-linea" />
      </div>
      {children}
    </div>
  );
}

/**
 * Chips de los comprobantes (factura, remito...). Ver un archivo abre el blob
 * autenticado en una pestaña nueva; agregar/eliminar sólo aparecen si el
 * componente padre pasó los handlers (es decir, si el usuario es admin).
 *
 * Las notas de crédito/débito NO van acá: tienen plata propia, origen,
 * fecha y el detalle de qué productos se devolvieron, y eso no entra en un
 * chip -- las muestra SeccionNotas.
 */
export function ChipsComprobantes({ comprobantes = [], onVer, onAgregar, onEliminar }) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const abrirArchivo = async (comprobante) => {
    setError("");
    try {
      const blob = await onVer(comprobante);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(obtenerMensajeError(err));
    }
  };

  const ejecutar = async (accion) => {
    setError("");
    setOcupado(true);
    try {
      await accion();
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="detalle__chips">
      {comprobantes.length === 0 && !onAgregar && (
        <span className="detalle__cargado-por">Sin comprobantes cargados.</span>
      )}

      {comprobantes.map((c) => {
        const nombre = nombreDeArchivo(c.archivo_path);
        const Icono = iconoParaArchivo(nombre);
        return (
          <span key={c.id} className="detalle__chip">
            <button
              type="button"
              className="detalle__chip-boton"
              disabled={!onVer}
              onClick={() => abrirArchivo(c)}
            >
              <Icono size={13} strokeWidth={2} />
              {nombre}
            </button>
            {onEliminar && (
              <button
                type="button"
                className="detalle__chip-quitar"
                title="Eliminar comprobante"
                disabled={ocupado}
                onClick={() => ejecutar(() => onEliminar(c.id))}
              >
                <X size={13} strokeWidth={2.25} />
              </button>
            )}
          </span>
        );
      })}

      {onAgregar && (
        <>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) ejecutar(() => onAgregar(files));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className="detalle__chip detalle__chip--agregar"
            disabled={ocupado}
            onClick={() => inputRef.current?.click()}
          >
            <Plus size={13} strokeWidth={2.25} />
            Comprobante
          </button>
        </>
      )}

      {error && <p className="detalle__error">{error}</p>}
    </div>
  );
}

/**
 * Tile de estado (pago / envío) con switch. Sin `onToggle` queda de sólo
 * lectura, que es lo que ve un usuario que no es admin.
 */
export function TileEstado({ label, estado, activo, onToggle, titulo }) {
  const Icono = estado.icono;
  return (
    <div className={`detalle__estado${activo ? " detalle__estado--activo" : ""}`}>
      <span
        className="detalle__estado-icono"
        style={{ background: `${estado.color}${TINTE_PASTILLA}`, color: estado.color }}
      >
        {Icono && <Icono size={15} strokeWidth={2.25} />}
      </span>
      <span className="detalle__estado-texto">
        <span className="detalle__estado-label">{label}</span>
        <span className="detalle__estado-valor" style={{ color: estado.color }}>
          {estado.label}
        </span>
      </span>
      <span className="detalle__estado-espaciador" />
      {onToggle && (
        <button
          type="button"
          role="switch"
          aria-checked={activo}
          aria-label={titulo}
          title={titulo}
          className={`detalle__switch${activo ? " detalle__switch--on" : ""}`}
          onClick={onToggle}
        >
          <span className="detalle__switch-perilla" />
        </button>
      )}
    </div>
  );
}
