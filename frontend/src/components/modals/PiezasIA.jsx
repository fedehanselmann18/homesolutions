import { Sparkles, FileText, CircleAlert } from "lucide-react";

import logoIsoBlanco from "../../assets/HS_iso_blanco.png";
import logoIsoOliva from "../../assets/HS_iso_oliva.png";

import "./PiezasIA.css";

/**
 * Piezas del flujo "IA primero" (dirección 5c del rediseño, ver
 * claudedesign/): en Compra/Gasto/Cobro el comprobante es el protagonista —
 * el modal abre con la zona de carga grande y leer el archivo es la acción
 * principal; el formulario aparece después, ya prellenado y con cada campo
 * marcado como leído del comprobante.
 */

/**
 * Indicador de "la IA está pensando": el isotipo de la casita pulsando
 * despacio (escala + opacidad, sin girar ni rebotar -- ver PiezasIA.css). Es
 * la marca del producto haciendo de spinner en vez de un spinner genérico.
 *
 * La variante importa: el isotipo oliva es EXACTAMENTE el mismo color que
 * --color-terracota (#6f7f45), así que sobre el fondo sólido de .ia-boton
 * queda invisible (contraste 1:1). Ahí va el blanco, que además acompaña al
 * texto blanco del botón; el oliva queda para fondos claros.
 */
export function LogoCargando({ size = 18, variante = "oliva" }) {
  return (
    <img
      src={variante === "blanco" ? logoIsoBlanco : logoIsoOliva}
      alt=""
      className="logo-cargando"
      style={{ width: size, height: size }}
    />
  );
}

export function BotonIA({
  onClick,
  disabled,
  leyendo,
  atenuado = false,
  textoLeyendo = "Leyendo comprobante...",
  children,
}) {
  return (
    <button
      type="button"
      className={`ia-boton${atenuado ? " ia-boton--atenuado" : ""}`}
      onClick={onClick}
      disabled={disabled}
    >
      {leyendo ? (
        <LogoCargando size={16} variante="blanco" />
      ) : (
        <Sparkles size={16} strokeWidth={2.25} />
      )}
      {leyendo ? textoLeyendo : children}
    </button>
  );
}

/**
 * Estado inicial: la zona de carga ocupa el modal y leer el comprobante es la
 * acción principal. `children` es el uploader de comprobantes.
 *
 * textoBoton/textoLeyendo/textoManual son opcionales -- por default queda el
 * texto de comprobantes (Compra/Gasto/Cobro); ModalImportarCatalogo los pisa
 * porque acá no se "autocompleta" un formulario, se lee un catálogo entero.
 */
export function PasoComprobante({
  children,
  hayArchivo,
  leyendo,
  onLeer,
  onCargarAMano,
  textoBoton = "Autocompletar con IA",
  textoLeyendo = "Leyendo comprobante...",
  textoManual = "Cargar los datos a mano",
}) {
  return (
    <div className="ia-paso">
      {children}
      <BotonIA
        onClick={onLeer}
        disabled={!hayArchivo || leyendo}
        leyendo={leyendo}
        atenuado={!hayArchivo}
        textoLeyendo={textoLeyendo}
      >
        {textoBoton}
      </BotonIA>
      <button type="button" className="ia-paso-manual" onClick={onCargarAMano}>
        {textoManual}
      </button>
    </div>
  );
}

/** Banner del comprobante ya leído, con la opción de volver a pasarlo por la IA. */
export function BannerIA({
  nombreArchivo,
  resumen,
  onVolverALeer,
  leyendo,
  disabled,
  textoLeyendo = "Leyendo comprobante...",
}) {
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
        <BotonIA
          onClick={onVolverALeer}
          disabled={disabled || leyendo}
          leyendo={leyendo}
          textoLeyendo={textoLeyendo}
        >
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
