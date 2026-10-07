import { useRef, useState } from "react";
import { AlertTriangle, CalendarDays, Download, Pencil, Plus, Trash2, X } from "lucide-react";

import { formatMoneda, formatFechaLarga } from "../../utils/formato";
import { extensionDeArchivo, iconoParaArchivo, nombreDeArchivo } from "../../utils/archivos";
import { obtenerMensajeError } from "../../utils/errorHandling";
import { ModalShell } from "./ModalShell";

import "./ModalDetalle.css";

/**
 * Piezas compartidas por los tres modales de detalle (Compra / Gasto / Cobro).
 * Geometría de HS Modales (DESIGN.md §14) y estructura de contenido de
 * docs/GENERALUIUXChange/Movimientos v2.dc.html: cabecera con el importe,
 * banda si falta el comprobante, detalles en grilla, productos con su total,
 * archivos y, al pie, Borrar a la izquierda y Editar / la acción a la derecha.
 */

/**
 * El shell del detalle es el mismo `ModalShell` de los modales de carga: header
 * claro con el ícono del tipo y la fecha como contexto. `accionRapida` va en
 * el pie antes de Editar (ej. el interruptor de "Pagado" de una compra).
 */
export function DetalleShell({
  tipo,
  icono,
  fecha,
  titulo,
  onCerrar,
  onEditar,
  onEliminar,
  accionRapida,
  children,
}) {
  return (
    <ModalShell
      titulo={tipo}
      etiqueta={`${tipo}: ${titulo}`}
      icono={icono}
      contexto={formatFechaLarga(fecha)}
      iconoContexto={CalendarDays}
      clase="detalle"
      onCerrar={onCerrar}
      accionesIzquierda={
        onEliminar && (
          <button type="button" className="detalle__borrar" onClick={onEliminar}>
            <Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
            Borrar
          </button>
        )
      }
      acciones={
        <>
          {accionRapida}
          {onEditar ? (
            <button type="button" className="btn btn--lg btn-secondary" onClick={onEditar}>
              <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
              Editar
            </button>
          ) : (
            <button type="button" className="btn btn--lg btn-secondary" onClick={onCerrar}>
              Cerrar
            </button>
          )}
        </>
      }
    >
      {children}
    </ModalShell>
  );
}

/**
 * Título del movimiento con sus badges debajo, y a la derecha el importe en la
 * moneda en que se cargó, el equivalente y la cotización usada
 * (`secundario`, ya formateado: "US$ 1.702 · dólar blue $ 1.250,00").
 */
export function CabeceraMovimiento({ titulo, badges, monto, moneda = "ars", secundario }) {
  return (
    <div className="detalle__cabecera">
      <div className="detalle__cabecera-texto">
        <h3 className="detalle__titulo">{titulo}</h3>
        {badges && <div className="detalle__badges">{badges}</div>}
      </div>
      <div className="detalle__total">
        <span className="detalle__total-monto cifra">{formatMoneda(monto, moneda)}</span>
        {secundario && <span className="detalle__total-secundario cifra">{secundario}</span>}
      </div>
    </div>
  );
}

// El input de archivo y su manejo de errores, compartido por la banda de
// "falta el comprobante" y la lista de archivos: los dos suben al mismo lado.
function useAdjuntar(onAgregar) {
  const inputRef = useRef(null);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);

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

  const input = onAgregar ? (
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
  ) : null;

  return { input, abrir: () => inputRef.current?.click(), ejecutar, ocupado, error, setError };
}

/** Banda ámbar arriba del detalle cuando el movimiento no tiene comprobante. */
export function BandaFaltante({ texto = "Falta adjuntar el comprobante", onAgregar }) {
  const { input, abrir, ocupado, error } = useAdjuntar(onAgregar);
  return (
    <div className="detalle__faltante" role="status">
      <span className="detalle__faltante-texto">
        <AlertTriangle size={16} strokeWidth={1.75} aria-hidden="true" />
        {texto}
      </span>
      {onAgregar && (
        <>
          {input}
          <button
            type="button"
            className="btn btn--sm btn-secondary"
            disabled={ocupado}
            onClick={abrir}
          >
            <Plus size={14} strokeWidth={1.75} aria-hidden="true" />
            Adjuntar
          </button>
        </>
      )}
      {error && <p className="detalle__error">{error}</p>}
    </div>
  );
}

/** Bloque con su título subrayado ("Detalles", "4 productos", "Archivos"). */
export function SeccionDetalle({ titulo, accion, children }) {
  return (
    <section className="detalle__seccion">
      <div className="detalle__seccion-titulo">
        <h4>{titulo}</h4>
        {accion}
      </div>
      {children}
    </section>
  );
}

/**
 * Grilla de 3 columnas: label chico arriba y valor abajo. `punto` es el color
 * pleno de un estado (el semáforo de la fila, en chico).
 */
export function GrillaDetalles({ campos }) {
  return (
    <dl className="detalle__grilla">
      {campos.filter(Boolean).map(({ label, valor, punto }) => (
        <div key={label} className="detalle__campo">
          <dt>{label}</dt>
          <dd>
            {punto && <span className="detalle__punto" style={{ background: punto }} />}
            {valor}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Bloque de totales alineado a la derecha: Neto / impuestos / notas / Total.
 * `filas`: [{ label, valor, variante? }] con variante "total" | "resta" | "suma".
 */
export function TotalesDetalle({ filas }) {
  return (
    <div className="detalle__totales cifra">
      {filas.map(({ label, valor, variante }) => (
        <div
          key={label}
          className={`detalle__totales-fila${variante ? ` detalle__totales-fila--${variante}` : ""}`}
        >
          <span>{label}</span>
          <span>{valor}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Los comprobantes (factura, remito...) como filas de archivo. Ver un archivo
 * abre el blob autenticado en una pestaña nueva; agregar y eliminar sólo
 * aparecen si el padre pasó los handlers (es decir, si el usuario es admin).
 *
 * Las notas de crédito/débito NO van acá: tienen plata propia, origen, fecha y
 * el detalle de qué productos se devolvieron -- las muestra SeccionNotas.
 */
export function ArchivosDetalle({ comprobantes = [], onVer, onAgregar, onEliminar }) {
  const { input, abrir, ejecutar, ocupado, error, setError } = useAdjuntar(onAgregar);

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

  return (
    <SeccionDetalle
      titulo="Archivos"
      accion={
        onAgregar && (
          <>
            {input}
            <button type="button" className="chip chip--agregar" disabled={ocupado} onClick={abrir}>
              <Plus aria-hidden="true" />
              Comprobante
            </button>
          </>
        )
      }
    >
      {comprobantes.length === 0 ? (
        <p className="detalle__vacio">Sin comprobantes cargados.</p>
      ) : (
        <ul className="detalle__archivos">
          {comprobantes.map((c) => {
            const nombre = nombreDeArchivo(c.archivo_path);
            const Icono = iconoParaArchivo(nombre);
            return (
              <li key={c.id} className="detalle__archivo">
                <span className="detalle__archivo-icono">
                  <Icono size={16} strokeWidth={1.75} aria-hidden="true" />
                </span>
                <span className="detalle__archivo-texto">
                  <span className="detalle__archivo-nombre">{nombre}</span>
                  <span className="detalle__archivo-tipo">
                    {extensionDeArchivo(nombre).slice(1).toUpperCase() || "Archivo"}
                  </span>
                </span>
                {onVer && (
                  <button
                    type="button"
                    className="btn-icono"
                    title="Ver comprobante"
                    aria-label={`Ver ${nombre}`}
                    onClick={() => abrirArchivo(c)}
                  >
                    <Download aria-hidden="true" />
                  </button>
                )}
                {onEliminar && (
                  <button
                    type="button"
                    className="btn-icono btn-icono--peligro"
                    title="Eliminar comprobante"
                    aria-label={`Eliminar ${nombre}`}
                    disabled={ocupado}
                    onClick={() => ejecutar(() => onEliminar(c.id))}
                  >
                    <X aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && <p className="detalle__error">{error}</p>}
    </SeccionDetalle>
  );
}
