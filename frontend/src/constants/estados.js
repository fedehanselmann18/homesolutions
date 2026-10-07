// constants/estados.js
//
// El semáforo de estado (proyecto y fase) sale de acá. Los colores se importan
// de colores.js y no se escriben a mano: este archivo tenía los cuatro hex
// literales -- los mismos valores, pero fuera del único lugar que colores.js
// declara como válido para un hex en JS, así que un cambio de paleta los
// dejaba atrás justo en lo que pinta el estado de toda la app.
import { Clock, CirclePlay, CircleCheckBig, Search } from "lucide-react";

// v5: `en_curso` pasa de NARANJA a AZUL y `auditada` de AZUL (que era un gris
// frío) a VIOLETA. El ámbar queda reservado a "requiere atención" (vence pronto,
// sin entregar, sin comprobante) en vez de cargar también "está pasando", que
// eran dos significados en un solo color.
//
// El `icono` de cada estado es ESTRUCTURAL, no decorativo: las luminancias de
// los seis colores del semáforo caen todas entre 0.07 y 0.12, así que los
// estados se distinguen por tono y no por claridad -- para alguien con
// deuteranopia verde y rojo quedan casi iguales. Un badge de estado sin ícono
// pierde la mitad de la información.
import {
  TINTA_MUTED,
  BASE_2,
  VERDE,
  VERDE_TINT,
  VERDE_OSCURO,
  ESTADO_CURSO,
  ESTADO_CURSO_TINT,
  ESTADO_CURSO_TEXTO,
  ESTADO_VERIFICADO,
  ESTADO_VERIFICADO_TINT,
  ESTADO_VERIFICADO_TEXTO,
} from "./colores";

// Cada estado tiene la forma { color, bg, fg, label, icono }:
//   - `color` es el pleno, para lo que necesita UN color sólido: la serie del
//     gráfico de avance (utils/analisis.js), la regla de fila de Fases.jsx.
//   - `bg` / `fg` son el par plano del badge (DESIGN.md §2 y §12). Antes cada
//     consumidor se armaba el fondo a partir de `color` como podía (color-mix,
//     alfa concatenado) y el mismo estado salía con un tint distinto según la
//     pantalla.
const NEUTRO = { color: TINTA_MUTED, bg: BASE_2, fg: TINTA_MUTED };
const CURSO = { color: ESTADO_CURSO, bg: ESTADO_CURSO_TINT, fg: ESTADO_CURSO_TEXTO };
const TERMINADO = { color: VERDE, bg: VERDE_TINT, fg: VERDE_OSCURO };
const VERIFICADO = {
  color: ESTADO_VERIFICADO,
  bg: ESTADO_VERIFICADO_TINT,
  fg: ESTADO_VERIFICADO_TEXTO,
};

const ESTADOS = {
  a_iniciar: { ...NEUTRO, label: "A iniciar", icono: Clock },
  en_curso: { ...CURSO, label: "En curso", icono: CirclePlay },
  terminado: { ...TERMINADO, label: "Terminado", icono: CircleCheckBig },
};

export const ESTADO_LABELS = {
  por_empezar: { ...NEUTRO, label: "Por empezar", icono: Clock },
  en_curso: { ...CURSO, label: "En curso", icono: CirclePlay },
  terminada: { ...TERMINADO, label: "Terminada", icono: CircleCheckBig },
  auditada: { ...VERIFICADO, label: "Auditada", icono: Search },
};

// Un estado que no está en el mapa sale con el par neutro y su clave como
// label, sin ícono: el reloj de "a iniciar" afirmaría algo que no sabemos.
// Siempre la forma completa -- getEstadoLabel devolvía el string pelado, y
// quien leía `.color` o `.icono` recibía undefined.
function estadoDesconocido(estado) {
  return { ...NEUTRO, label: estado, icono: null };
}

export function getEstado(estado) {
  return ESTADOS[estado] || estadoDesconocido(estado);
}

export function getEstadoLabel(estado) {
  return ESTADO_LABELS[estado] || estadoDesconocido(estado);
}
