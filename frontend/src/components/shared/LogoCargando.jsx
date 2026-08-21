import logoIsoBlanco from "../../assets/HS_iso_blanco.png";
import logoIsoOliva from "../../assets/HS_iso_oliva.png";

import "./LogoCargando.css";

/**
 * Indicador de espera de la app: el isotipo de la casita pulsando despacio
 * (escala + opacidad). Es la marca haciendo de spinner en vez de un spinner
 * genérico.
 *
 * Nació en el flujo "IA primero" (PiezasIA) para el "la IA está pensando" y
 * ahora es el único indicador de espera de toda la app: carga de página,
 * guardado de un formulario y lectura de un comprobante se ven igual, porque
 * para el usuario son la misma situación — algo está pasando y hay que
 * esperar.
 *
 * No rota ni rebota a propósito: el pulso lento se lee como "procesando",
 * mientras que girar o rebotar se siente más a "cargando indefinidamente".
 *
 * La variante importa: el isotipo oliva es EXACTAMENTE el mismo color que
 * --color-terracota (#6f7f45), así que sobre un fondo sólido de ese color
 * (un .btn-primary, el .ia-boton) queda invisible (contraste 1:1). Ahí va el
 * blanco, que además acompaña al texto blanco del botón; el oliva queda para
 * fondos claros.
 */
export function LogoCargando({ size = 18, variante = "oliva" }) {
  return (
    <img
      src={variante === "blanco" ? logoIsoBlanco : logoIsoOliva}
      alt=""
      aria-hidden="true"
      className="logo-cargando"
      style={{ width: size, height: size }}
    />
  );
}

export default LogoCargando;
