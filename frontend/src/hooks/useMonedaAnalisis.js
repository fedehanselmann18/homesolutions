import { useSyncExternalStore } from "react";

import { MONEDA_ANALISIS_DEFAULT } from "../utils/moneda";

// En qué moneda se miran los análisis (proyecto, fase, panel). Es UNA
// elección para toda la app: si Agus pasa a pesos en el análisis de un
// proyecto, el de la fase y el panel también se ven en pesos, sin tener que
// cambiarlo en cada pantalla. Vive en memoria a propósito (no en
// localStorage): al recargar vuelve a dólares, que es la vara de
// rentabilidad.
let monedaActual = MONEDA_ANALISIS_DEFAULT;
const suscriptores = new Set();

function suscribir(callback) {
  suscriptores.add(callback);
  return () => suscriptores.delete(callback);
}

function cambiarMoneda(moneda) {
  monedaActual = moneda;
  suscriptores.forEach((callback) => callback());
}

export function useMonedaAnalisis() {
  const moneda = useSyncExternalStore(suscribir, () => monedaActual);
  return [moneda, cambiarMoneda];
}

export default useMonedaAnalisis;
