import { useState } from "react";
import { Trash2 } from "lucide-react";

import "./Manager.css";
import { formatBytes, formatFechaHora } from "../../utils/formato";
import { EstadoVacio } from "../shared/EstadoVacio";

/**
 * Reconciliación de archivos en R2: objetos del
 * bucket sin ninguna fila de comprobante/nota que los referencie
 * (huérfanos, se pueden purgar acá) y el caso inverso -- filas con
 * archivo_path que ya no existe en R2 (rotos, solo para detectarlos: no hay
 * nada que "arreglar" automáticamente, hay que decidir a mano si se
 * resubre el comprobante o se acepta el hueco).
 *
 * La confirmación de la purga vive en el padre (un modal, porque borra de
 * verdad y no se deshace) -- acá "Purgar" solo avisa QUÉ se quiere purgar
 * con `onPedirPurgar`. El padre remonta este componente con una `key` que
 * cambia en cada recarga (ver GestionArchivos.jsx), así que la selección se
 * resetea sola después de una purga exitosa sin que este componente tenga
 * que saber cuándo terminó.
 */
export function SeccionArchivos({ huerfanos, rotos, onPedirPurgar }) {
  const [seleccionados, setSeleccionados] = useState(() => new Set());

  const toggleUno = (key) => {
    setSeleccionados((previos) => {
      const nuevo = new Set(previos);
      if (nuevo.has(key)) nuevo.delete(key);
      else nuevo.add(key);
      return nuevo;
    });
  };

  const toggleTodos = () => {
    setSeleccionados((previos) =>
      previos.size === huerfanos.length ? new Set() : new Set(huerfanos.map((h) => h.key))
    );
  };

  return (
    <div className="manager-archivos">
      <section className="manager-archivos__seccion">
        <div className="manager-archivos__header">
          <h3 className="manager-subtitulo">Huérfanos en R2 ({huerfanos.length})</h3>
          {seleccionados.size > 0 && (
            <button
              type="button"
              className="btn btn--sm btn-peligro"
              onClick={() => onPedirPurgar(Array.from(seleccionados))}
            >
              <Trash2 size={14} strokeWidth={2} />
              Purgar {seleccionados.size} seleccionado{seleccionados.size > 1 ? "s" : ""}
            </button>
          )}
        </div>

        {huerfanos.length === 0 ? (
          <EstadoVacio mensaje="No hay archivos en R2 sin una fila que los referencie." />
        ) : (
          <div className="manager-tabla-scroll">
            <table className="manager-tabla" aria-label="Archivos huérfanos en R2">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={seleccionados.size === huerfanos.length}
                      onChange={toggleTodos}
                      aria-label="Seleccionar todos"
                    />
                  </th>
                  <th>Archivo</th>
                  <th>Tamaño</th>
                  <th>Modificado</th>
                </tr>
              </thead>
              <tbody>
                {huerfanos.map((h) => (
                  <tr key={h.key}>
                    <td>
                      <input
                        type="checkbox"
                        checked={seleccionados.has(h.key)}
                        onChange={() => toggleUno(h.key)}
                        aria-label={`Seleccionar ${h.key}`}
                      />
                    </td>
                    <td className="manager-archivos__key">{h.key}</td>
                    <td>{formatBytes(h.tamanio_bytes)}</td>
                    <td className="manager-auditoria__fecha">{formatFechaHora(h.modificado_en)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="manager-archivos__seccion">
        <h3 className="manager-subtitulo">
          Comprobantes rotos ({rotos.length})
          <span className="manager-archivos__ayuda-inline">
            {" "}
            -- filas que apuntan a un archivo que ya no está en R2
          </span>
        </h3>

        {rotos.length === 0 ? (
          <EstadoVacio mensaje="Ningún comprobante apunta a un archivo faltante." />
        ) : (
          <div className="manager-tabla-scroll">
            <table className="manager-tabla" aria-label="Comprobantes rotos">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Id</th>
                  <th>Archivo esperado</th>
                </tr>
              </thead>
              <tbody>
                {rotos.map((r) => (
                  <tr key={`${r.tipo_recurso}-${r.recurso_id}`}>
                    <td className="manager-tabla__nombre">{r.tipo_recurso}</td>
                    <td className="manager-auditoria__id" title={r.recurso_id}>
                      {r.recurso_id.slice(0, 8)}
                    </td>
                    <td className="manager-archivos__key">{r.archivo_path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default SeccionArchivos;
