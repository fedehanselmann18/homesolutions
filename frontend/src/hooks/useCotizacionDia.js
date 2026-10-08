import { useEffect, useState } from "react";

import { useUltimaCotizacion } from "./queries";

const TIPO_DEFAULT = "blue";

/**
 * Estado del dólar de un form de carga (compra, gasto, cobro, nota): tipo de
 * cambio + cotización.
 *
 * - Al crear, precarga la cotización de la tabla `cotizaciones`: la del día
 *   del movimiento (`fecha`) o la última cargada antes. Si la fecha o el
 *   tipo cambian, la sugerencia se vuelve a buscar.
 * - En cuanto el usuario tipea un valor, se respeta el suyo: la sugerencia
 *   deja de pisarlo. Cambiar el tipo de dólar vuelve a sugerir.
 * - Al editar (`inicial` = el movimiento), arranca con la cotización que
 *   quedó congelada y NO la reemplaza sola: un movimiento cargado vale lo que
 *   valió. Si se corrige a mano, el backend recongela la otra cifra.
 *
 * El valor de la tabla es solo sugerencia: lo que manda el form es lo que
 * quedó en el input, y la cifra congelada la calcula siempre el backend.
 */
export function useCotizacionDia({ fecha, inicial } = {}) {
  const [tipo, setTipoEstado] = useState(inicial?.tipo_cambio ?? TIPO_DEFAULT);
  const [valor, setValorEstado] = useState(inicial?.cotizacion_dolar ?? "");
  const [manual, setManual] = useState(Boolean(inicial));

  // El modal de edición recibe el movimiento después del primer render (ver
  // el useEffect de precarga de cada modal): se resincroniza acá.
  useEffect(() => {
    if (inicial) {
      setTipoEstado(inicial.tipo_cambio ?? TIPO_DEFAULT);
      setValorEstado(inicial.cotizacion_dolar ?? "");
      setManual(true);
    }
  }, [inicial]);

  const sugerenciaQuery = useUltimaCotizacion({ tipo, fecha: fecha || undefined });
  const sugerencia = sugerenciaQuery.data ?? null;

  useEffect(() => {
    if (!manual && sugerencia) setValorEstado(sugerencia.valor);
  }, [manual, sugerencia]);

  const setValor = (nuevo) => {
    setValorEstado(nuevo);
    setManual(true);
  };

  const setTipo = (nuevo) => {
    setTipoEstado(nuevo);
    if (!inicial) setManual(false);
  };

  const numero = Number(valor);
  let error = null;
  if (valor === "" || valor === null) error = "Cargá la cotización del dólar.";
  else if (!(numero > 0)) error = "La cotización tiene que ser mayor a 0.";

  return {
    tipo,
    setTipo,
    valor,
    setValor,
    sugerencia,
    buscandoSugerencia: sugerenciaQuery.isLoading,
    error,
    // Lo que viaja en el body: la otra cifra NO, la congela el backend.
    payload: { cotizacion_dolar: numero, tipo_cambio: tipo },
  };
}

export default useCotizacionDia;
