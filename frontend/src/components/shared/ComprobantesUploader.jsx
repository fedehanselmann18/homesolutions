import { useEffect, useRef, useState } from "react";
import { Paperclip, Plus, X } from "lucide-react";
import {
  describirArchivo,
  extensionDeArchivo,
  iconoParaArchivo,
  nombreDeArchivo as nombreDeArchivoExistente,
} from "../../utils/archivos";
import { obtenerMensajeError } from "../../utils/errorHandling";
import "./ComprobantesUploader.css";

const EXTENSIONES_PERMITIDAS = [".pdf", ".jpg", ".jpeg", ".png"];
const TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB, espejo de backend/app/files/storage.py

let contadorLocalId = 0;
const nuevoLocalId = () => `pendiente-${++contadorLocalId}`;

/**
 * Zona de carga vacía — DESIGN.md §14, "Comprobante primero": 52px, borde
 * punteado en oliva claro y el clip en oliva. Se puede soltar un archivo
 * encima o elegirlo con el link. `extra` va a la derecha (el "IA al subir").
 * La comparten los comprobantes de un movimiento y la importación de
 * catálogo.
 */
export function ZonaArchivo({
  texto = "Arrastrá el comprobante o",
  textoLink = "elegí un archivo",
  extra,
  arrastrando = false,
  disabled = false,
  onElegir,
  onSoltar,
  onArrastrando,
}) {
  return (
    <div
      className={`zona-archivo${arrastrando ? " zona-archivo--activa" : ""}${disabled ? " zona-archivo--deshabilitada" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) onArrastrando?.(true);
      }}
      onDragLeave={() => onArrastrando?.(false)}
      onDrop={(e) => {
        e.preventDefault();
        onArrastrando?.(false);
        if (!disabled && e.dataTransfer.files?.length) onSoltar(e.dataTransfer.files);
      }}
    >
      <Paperclip className="zona-archivo__clip" size={17} strokeWidth={1.75} aria-hidden="true" />
      <span className="zona-archivo__texto">
        {texto}{" "}
        <button type="button" className="zona-archivo__link" onClick={onElegir} disabled={disabled}>
          {textoLink}
        </button>
      </span>
      {extra && <span className="zona-archivo__extra">{extra}</span>}
    </div>
  );
}

/**
 * Un archivo ya elegido: ícono en un cuadradito blanco, nombre + tipo/peso,
 * una acción opcional (el "Autocompletar con IA", que va AL LADO del archivo
 * porque lo necesita para funcionar) y la × para sacarlo.
 */
export function FilaArchivo({ nombre, meta, onVer, viendo = false, accion, onQuitar, disabled }) {
  const Icono = iconoParaArchivo(nombre);
  return (
    <li className="fila-archivo">
      <span className="fila-archivo__icono" aria-hidden="true">
        <Icono size={16} strokeWidth={1.75} />
      </span>
      <span className="fila-archivo__texto">
        {onVer ? (
          <button
            type="button"
            className="fila-archivo__nombre fila-archivo__nombre--link"
            onClick={onVer}
            title={`Ver ${nombre}`}
            disabled={viendo}
          >
            {viendo ? "Abriendo…" : nombre}
          </button>
        ) : (
          <span className="fila-archivo__nombre" title={nombre}>
            {nombre}
          </span>
        )}
        {meta && <span className="fila-archivo__meta">{meta}</span>}
      </span>
      {accion}
      {onQuitar && (
        <button
          type="button"
          className="btn-icono btn-icono--sm"
          onClick={onQuitar}
          disabled={disabled}
          aria-label={`Quitar ${nombre}`}
          title="Quitar"
        >
          <X aria-hidden="true" />
        </button>
      )}
    </li>
  );
}

/**
 * Comprobantes de un movimiento (Compra/Gasto/Cobro), arriba de todo en el
 * modal (DESIGN.md §14).
 *
 * No pega directo contra el backend: junta un "borrador" (archivos nuevos +
 * ids de existentes marcados para eliminar) y se lo reporta al padre vía
 * onCambio. El padre recién lo aplica (subir/eliminar) cuando se confirma el
 * submit del formulario -- así "Cancelar" descarta todo, y funciona igual al
 * crear (sin id todavía) que al editar.
 *
 * `accionArchivo(file)` dibuja la acción del PRIMER archivo nuevo (el botón
 * de IA: lee uno solo). `extraVacio` va a la derecha de la zona vacía.
 *
 * Solo maneja comprobantes "normales" (factura, remito...). Las notas de
 * crédito/débito son otra cosa -- tienen su propio modal (ver ModalNota).
 */
export function ComprobantesUploader({
  existentes = [],
  onVerExistente,
  onCambio,
  disabled = false,
  textoVacio,
  extraVacio,
  accionArchivo,
}) {
  const inputRef = useRef(null);
  const [pendientes, setPendientes] = useState([]);
  const [marcadosEliminar, setMarcadosEliminar] = useState(new Set());
  const [arrastrando, setArrastrando] = useState(false);
  const [errores, setErrores] = useState([]);
  const [viendoId, setViendoId] = useState(null);

  // Un único efecto reporta el borrador al padre cada vez que cambia
  // cualquiera de las dos piezas de estado -- evitar emitir manualmente
  // desde cada setter, porque dos actualizaciones batcheadas por React en
  // el mismo tick pueden pisarse entre sí con un closure desactualizado.
  useEffect(() => {
    onCambio?.({
      archivos: pendientes.map((p) => p.file),
      eliminarIds: Array.from(marcadosEliminar),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientes, marcadosEliminar]);

  const agregarArchivos = (fileList) => {
    const validos = [];
    const nuevosErrores = [];

    for (const file of Array.from(fileList)) {
      const ext = extensionDeArchivo(file.name);
      if (!EXTENSIONES_PERMITIDAS.includes(ext)) {
        nuevosErrores.push(`${file.name}: extensión no permitida`);
        continue;
      }
      if (file.size > TAMANIO_MAXIMO_BYTES) {
        nuevosErrores.push(`${file.name}: supera los 10MB`);
        continue;
      }
      validos.push({ localId: nuevoLocalId(), file });
    }

    setErrores(nuevosErrores);
    if (validos.length > 0) setPendientes((prev) => [...prev, ...validos]);
  };

  const elegir = () => !disabled && inputRef.current?.click();

  const handleVer = async (comprobante) => {
    setViendoId(comprobante.id);
    try {
      const blob = await onVerExistente(comprobante);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setErrores([obtenerMensajeError(err)]);
    } finally {
      setViendoId(null);
    }
  };

  const existentesVisibles = existentes.filter((c) => !marcadosEliminar.has(c.id));
  const hayItems = existentesVisibles.length > 0 || pendientes.length > 0;

  return (
    <div className="comprobantes-uploader">
      <input
        ref={inputRef}
        type="file"
        accept={EXTENSIONES_PERMITIDAS.join(",")}
        multiple
        hidden
        disabled={disabled}
        onChange={(e) => {
          if (e.target.files?.length) agregarArchivos(e.target.files);
          e.target.value = "";
        }}
      />

      {hayItems ? (
        <div
          className={`comprobantes-uploader__lista${arrastrando ? " comprobantes-uploader__lista--activa" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={(e) => {
            e.preventDefault();
            setArrastrando(false);
            if (!disabled && e.dataTransfer.files?.length) agregarArchivos(e.dataTransfer.files);
          }}
        >
          <ul className="filas-archivo">
            {existentesVisibles.map((c) => (
              <FilaArchivo
                key={c.id}
                nombre={nombreDeArchivoExistente(c.archivo_path)}
                meta="Ya cargado"
                onVer={onVerExistente ? () => handleVer(c) : undefined}
                viendo={viendoId === c.id}
                onQuitar={() => setMarcadosEliminar((prev) => new Set(prev).add(c.id))}
                disabled={disabled}
              />
            ))}
            {pendientes.map((p, i) => (
              <FilaArchivo
                key={p.localId}
                nombre={p.file.name}
                meta={describirArchivo(p.file)}
                accion={i === 0 ? accionArchivo?.(p.file) : null}
                onQuitar={() =>
                  setPendientes((prev) => prev.filter((x) => x.localId !== p.localId))
                }
                disabled={disabled}
              />
            ))}
          </ul>
          <button
            type="button"
            className="comprobantes-uploader__agregar"
            onClick={elegir}
            disabled={disabled}
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            Agregar otro archivo
          </button>
        </div>
      ) : (
        <ZonaArchivo
          texto={textoVacio}
          extra={extraVacio}
          arrastrando={arrastrando}
          disabled={disabled}
          onElegir={elegir}
          onSoltar={agregarArchivos}
          onArrastrando={setArrastrando}
        />
      )}

      {errores.length > 0 && (
        <ul className="comprobantes-errores" role="alert">
          {errores.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ComprobantesUploader;
