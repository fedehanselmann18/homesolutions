import { Sparkles, FileText, CircleAlert } from "lucide-react";

import "./PiezasIA.css";

/**
 * Piezas del flujo "IA primero" (dirección 5c del rediseño, ver
 * claudedesign/): en Compra/Gasto/Cobro el comprobante es el protagonista —
 * el modal abre con la zona de carga grande y leer el archivo es la acción
 * principal; el formulario aparece después, ya prellenado y con cada campo
 * marcado como leído del comprobante.
 */

export function BotonIA({ onClick, disabled, leyendo, atenuado = false, children }) {
  return (
    <button
      type="button"
      className={`ia-boton${atenuado ? " ia-boton--atenuado" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      <Sparkles size={16} strokeWidth={2.25} />
      {leyendo ? "Leyendo comprobante..." : children}
    </button>
  );
}

/**
 * Estado inicial: la zona de carga ocupa el modal y leer el comprobante es la
 * acción principal. `children` es el uploader de comprobantes.
 */
export function PasoComprobante({ children, hayArchivo, leyendo, onLeer, onCargarAMano }) {
  return (
    <div className="ia-paso">
      {children}
      <BotonIA
        onClick={onLeer}
        disabled={!hayArchivo || leyendo}
        leyendo={leyendo}
        atenuado={!hayArchivo}
      >
        Autocompletar con IA
      </BotonIA>
      <button type="button" className="ia-paso-manual" onClick={onCargarAMano}>
        Cargar los datos a mano
      </button>
    </div>
  );
}

/** Banner del comprobante ya leído, con la opción de volver a pasarlo por la IA. */
export function BannerIA({ nombreArchivo, resumen, onVolverALeer, leyendo, disabled }) {
  return (
    <div className="ia-banner">
      <span className="ia-banner-icono">
        <FileText size={22} strokeWidth={2} />
      </span>
      <div className="ia-banner-texto">
        <span className="ia-banner-archivo">{nombreArchivo}</span>
        <span className="ia-banner-resumen">{resumen}</span>
      </div>
      <span className="ia-banner-espaciador" />
      {onVolverALeer && (
        <BotonIA onClick={onVolverALeer} disabled={disabled || leyendo} leyendo={leyendo}>
          Volver a leer
        </BotonIA>
      )}
    </div>
  );
}

/** Resumen de lo que falta completar, arriba del formulario. */
export function ResumenValidacion({ faltantes }) {
  if (faltantes.length === 0) return null;

  return (
    <div className="ia-validacion">
      <CircleAlert size={16} strokeWidth={2.25} className="ia-validacion-icono" />
      <div className="ia-validacion-texto">
        <span className="ia-validacion-titulo">
          {faltantes.length === 1
            ? "Falta completar 1 campo antes de guardar"
            : `Faltan completar ${faltantes.length} campos antes de guardar`}
        </span>
        <span className="ia-validacion-detalle">{faltantes.join(" · ")}</span>
      </div>
    </div>
  );
}

/** Marca de "este campo lo leyó la IA", debajo del input correspondiente. */
export function MarcaIA() {
  return (
    <span className="ia-marca">
      <Sparkles size={12} strokeWidth={2.25} />
      leído del comprobante
    </span>
  );
}
