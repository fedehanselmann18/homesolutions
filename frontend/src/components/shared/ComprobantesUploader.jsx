import { useEffect, useRef, useState } from "react";
import { extensionDeArchivo, iconoParaArchivo, nombreDeArchivo as nombreDeArchivoExistente } from "../../utils/archivos";
import "./ComprobantesUploader.css";

const EXTENSIONES_PERMITIDAS = [".pdf", ".jpg", ".jpeg", ".png"];
const TAMANIO_MAXIMO_BYTES = 10 * 1024 * 1024; // 10MB, espejo de backend/app/files/storage.py

let contadorLocalId = 0;
const nuevoLocalId = () => `pendiente-${++contadorLocalId}`;

const formatearTamanio = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/**
 * Drag & drop de comprobantes para los modales de Compra/Gasto/Cobro.
 *
 * No pega directo contra el backend: junta un "borrador" (archivos nuevos +
 * ids de existentes marcados para eliminar) y se lo reporta al padre vía
 * onCambio. El padre recién lo aplica (subir/eliminar) cuando se confirma el
 * submit del formulario -- así "Cancelar" descarta todo, y funciona igual al
 * crear (sin id todavía) que al editar.
 */
export function ComprobantesUploader({ existentes = [], onVerExistente, onCambio, disabled = false }) {
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
        const candidatos = Array.from(fileList);
        const validos = [];
        const nuevosErrores = [];

        for (const file of candidatos) {
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
        if (validos.length > 0) {
            setPendientes((prev) => [...prev, ...validos]);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setArrastrando(false);
        if (disabled) return;
        if (e.dataTransfer.files?.length) agregarArchivos(e.dataTransfer.files);
    };

    const handleSeleccionarArchivo = (e) => {
        if (e.target.files?.length) agregarArchivos(e.target.files);
        e.target.value = "";
    };

    const quitarPendiente = (localId) => {
        setPendientes((prev) => prev.filter((p) => p.localId !== localId));
    };

    const marcarParaEliminar = (comprobanteId) => {
        setMarcadosEliminar((prev) => {
            const actualizado = new Set(prev);
            actualizado.add(comprobanteId);
            return actualizado;
        });
    };

    const handleVer = async (comprobante) => {
        if (!onVerExistente) return;
        setViendoId(comprobante.id);
        try {
            const blob = await onVerExistente(comprobante);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank", "noopener,noreferrer");
            setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } catch (err) {
            setErrores([err?.message ?? "No se pudo abrir el comprobante"]);
        } finally {
            setViendoId(null);
        }
    };

    const existentesVisibles = existentes.filter((c) => !marcadosEliminar.has(c.id));
    const hayItems = existentesVisibles.length > 0 || pendientes.length > 0;

    return (
        <div className="comprobantes-uploader">
            <div
                className={`comprobantes-dropzone ${arrastrando ? "comprobantes-dropzone--activo" : ""} ${disabled ? "comprobantes-dropzone--disabled" : ""}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    if (!disabled) setArrastrando(true);
                }}
                onDragLeave={() => setArrastrando(false)}
                onDrop={handleDrop}
                onClick={() => !disabled && inputRef.current?.click()}
                role="button"
                tabIndex={0}
            >
                <span className="comprobantes-dropzone-icono">📎</span>
                <span className="comprobantes-dropzone-texto">
                    Arrastrá tus comprobantes acá o hacé click para elegir archivos
                </span>
                <span className="comprobantes-dropzone-subtexto">PDF, JPG o PNG · máx. 10MB por archivo</span>
                <input
                    ref={inputRef}
                    type="file"
                    accept={EXTENSIONES_PERMITIDAS.join(",")}
                    multiple
                    hidden
                    disabled={disabled}
                    onChange={handleSeleccionarArchivo}
                />
            </div>

            {errores.length > 0 && (
                <ul className="comprobantes-errores">
                    {errores.map((err, i) => (
                        <li key={i}>{err}</li>
                    ))}
                </ul>
            )}

            {hayItems ? (
                <ul className="comprobantes-lista">
                    {existentesVisibles.map((c) => (
                        <li key={c.id} className="comprobantes-chip">
                            <span className="comprobantes-chip-icono">{iconoParaArchivo(c.archivo_path)}</span>
                            <button
                                type="button"
                                className="comprobantes-chip-nombre comprobantes-chip-nombre--link"
                                onClick={() => handleVer(c)}
                                title={nombreDeArchivoExistente(c.archivo_path)}
                                disabled={viendoId === c.id}
                            >
                                {viendoId === c.id ? "Abriendo..." : nombreDeArchivoExistente(c.archivo_path)}
                            </button>
                            <button
                                type="button"
                                className="comprobantes-chip-quitar"
                                onClick={() => marcarParaEliminar(c.id)}
                                disabled={disabled}
                                title="Eliminar"
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                    {pendientes.map((p) => (
                        <li key={p.localId} className="comprobantes-chip comprobantes-chip--pendiente">
                            <span className="comprobantes-chip-icono">{iconoParaArchivo(p.file.name)}</span>
                            <span className="comprobantes-chip-nombre" title={p.file.name}>
                                {p.file.name}
                            </span>
                            <span className="comprobantes-chip-tamanio">{formatearTamanio(p.file.size)}</span>
                            <span className="comprobantes-chip-badge">nuevo</span>
                            <button
                                type="button"
                                className="comprobantes-chip-quitar"
                                onClick={() => quitarPendiente(p.localId)}
                                disabled={disabled}
                                title="Quitar"
                            >
                                ✕
                            </button>
                        </li>
                    ))}
                </ul>
            ) : (
                <p className="comprobantes-vacio">Sin comprobantes cargados todavía.</p>
            )}
        </div>
    );
}

export default ComprobantesUploader;
