import { useRef, useState } from "react";
import { X } from "lucide-react";
import { iconoParaArchivo, nombreDeArchivo } from "../../utils/archivos";
import { obtenerMensajeError } from "../../utils/errorHandling";
import "./SeccionComprobantes.css";

/**
 * Pieza reutilizable para mostrar/agregar/eliminar comprobantes ya guardados
 * (se usa en las cards de compra/gasto/cobro, fuera de los modales -- para
 * el flujo de alta/edición con drag & drop ver ComprobantesUploader).
 *
 * Solo maneja comprobantes "normales" (factura, remito...). Las notas de
 * crédito/débito tienen su propia sección aparte (ver SeccionNotas).
 *
 * Props:
 * - comprobantes: [{ id, archivo_path }]
 * - onVer(comprobante) => Promise<Blob>    (trae el archivo autenticado; se abre con URL.createObjectURL)
 * - onAgregar(fileList) => Promise         (opcional; si no viene, no se muestra el botón de subir)
 * - onEliminar(comprobanteId) => Promise   (opcional; si no viene, no se muestra el botón de eliminar)
 * - canManage: bool                        (si es admin; controla si se puede agregar/eliminar)
 */
export function SeccionComprobantes({
  comprobantes = [],
  onVer,
  onAgregar,
  onEliminar,
  canManage = false,
}) {
  const inputRef = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  const [eliminandoId, setEliminandoId] = useState(null);
  const [viendoId, setViendoId] = useState(null);
  const [error, setError] = useState("");

  const handleSeleccionarArchivo = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError("");
    setSubiendo(true);
    try {
      await onAgregar(files);
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setSubiendo(false);
      e.target.value = "";
    }
  };

  const handleEliminar = async (comprobanteId) => {
    setError("");
    setEliminandoId(comprobanteId);
    try {
      await onEliminar(comprobanteId);
    } catch (err) {
      setError(obtenerMensajeError(err));
    } finally {
      setEliminandoId(null);
    }
  };

  const handleVer = async (comprobante) => {
    if (!onVer) return;
    setError("");
    setViendoId(comprobante.id);
    try {
      const blob = await onVer(comprobante);
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
    <div className="seccion-comprobantes">
      <div className="seccion-comprobantes-header">
        <span className="seccion-comprobantes-titulo">
          Comprobantes
          {comprobantes.length > 0 && (
            <span className="seccion-comprobantes-contador">{comprobantes.length}</span>
          )}
        </span>
        {canManage && onAgregar && (
          <>
            <button
              type="button"
              className="seccion-comprobantes-btn-agregar"
              onClick={() => inputRef.current?.click()}
              disabled={subiendo}
            >
              {subiendo ? "Subiendo..." : "+ Agregar comprobante"}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              multiple
              hidden
              onChange={handleSeleccionarArchivo}
            />
          </>
        )}
      </div>

      {comprobantes.length === 0 ? (
        <p className="seccion-comprobantes-vacio">Sin comprobantes cargados.</p>
      ) : (
        <ul className="seccion-comprobantes-lista">
          {comprobantes.map((c) => {
            const IconoArchivo = iconoParaArchivo(c.archivo_path);
            return (
              <li key={c.id} className="seccion-comprobantes-item">
                <IconoArchivo size={14} strokeWidth={2} className="seccion-comprobantes-icono" />
                <button
                  type="button"
                  className="seccion-comprobantes-link"
                  onClick={() => handleVer(c)}
                  disabled={viendoId === c.id}
                  title={nombreDeArchivo(c.archivo_path)}
                >
                  {viendoId === c.id ? "Abriendo..." : nombreDeArchivo(c.archivo_path)}
                </button>
                {canManage && onEliminar && (
                  <button
                    type="button"
                    className="seccion-comprobantes-btn-eliminar"
                    onClick={() => handleEliminar(c.id)}
                    disabled={eliminandoId === c.id}
                    title="Eliminar"
                  >
                    {eliminandoId === c.id ? "..." : <X size={13} strokeWidth={2.25} />}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {error && <p className="seccion-comprobantes-error">{error}</p>}
    </div>
  );
}

export default SeccionComprobantes;
