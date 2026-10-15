import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useProyectos,
  useFases,
  useGastos,
  useCobros,
  useCompras,
  useProveedores,
  useUltimaCotizacion,
} from "./queries";
import { useMonedaAnalisis } from "./useMonedaAnalisis";
import { calcularMetricas } from "../utils/metricas";
import { MONEDAS } from "../utils/moneda";
import { PERIODOS_METRICAS, PERIODO_METRICAS_DEFAULT } from "../constants/metricas";

// Filtros de Métricas en la URL (?periodo=12m&moneda=ars): se pueden
// compartir y sobreviven a recargar. Un valor por default no se escribe, así
// la URL de entrada queda limpia (/metricas).
//
// La moneda es, además, la elección global de la app (useMonedaAnalisis): si
// la URL no la trae, se usa la global, y al cambiarla acá se cambian las dos,
// para que el Panel y el Análisis no queden en otra moneda que Métricas.

const PARAM = { periodo: "periodo", moneda: "moneda" };

const esPeriodo = (valor) => PERIODOS_METRICAS.some((p) => p.value === valor);

export function useFiltrosMetricas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [monedaGlobal, cambiarMonedaGlobal] = useMonedaAnalisis();

  const periodoUrl = searchParams.get(PARAM.periodo);
  const periodo = esPeriodo(periodoUrl) ? periodoUrl : PERIODO_METRICAS_DEFAULT;
  const monedaUrl = searchParams.get(PARAM.moneda);
  const moneda = MONEDAS[monedaUrl] ? monedaUrl : monedaGlobal;

  // `replace`: cambiar un filtro no es navegar, y con push el botón "atrás"
  // recorría cada chip tocado antes de volver a la página anterior.
  const cambiarParam = useCallback(
    (clave, valor, porDefecto) => {
      setSearchParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales);
          if (valor == null || valor === "" || valor === porDefecto) nuevos.delete(clave);
          else nuevos.set(clave, String(valor));
          return nuevos;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const setPeriodo = useCallback(
    (valor) => cambiarParam(PARAM.periodo, valor, PERIODO_METRICAS_DEFAULT),
    [cambiarParam]
  );
  const setMoneda = useCallback(
    (valor) => {
      cambiarMonedaGlobal(valor);
      cambiarParam(PARAM.moneda, valor, null);
    },
    [cambiarMonedaGlobal, cambiarParam]
  );

  return { periodo, moneda, setPeriodo, setMoneda };
}

/**
 * Datos de la página Métricas: los mismos 6 recursos globales que el Panel
 * (React Query los comparte, así que entrar desde el Panel no vuelve a
 * pedirlos) + la última cotización, sólo para el precio acordado en pesos.
 */
export function useMetricas() {
  const filtros = useFiltrosMetricas();
  const proyectosQuery = useProyectos();
  const fasesQuery = useFases();
  const gastosQuery = useGastos();
  const cobrosQuery = useCobros();
  const comprasQuery = useCompras();
  const proveedoresQuery = useProveedores();
  const cotizacionActual = useUltimaCotizacion().data ?? null;

  const queries = [proyectosQuery, fasesQuery, gastosQuery, cobrosQuery, comprasQuery];
  const cargando = queries.some((q) => q.isLoading);
  const error = queries.find((q) => q.isError)?.error ?? null;

  const { periodo, moneda } = filtros;
  const metricas = useMemo(() => {
    if (cargando || error) return null;
    return calcularMetricas({
      proyectos: proyectosQuery.data,
      fases: fasesQuery.data,
      gastos: gastosQuery.data,
      cobros: cobrosQuery.data,
      compras: comprasQuery.data,
      proveedores: proveedoresQuery.data ?? [],
      periodo,
      moneda,
      cotizacionActual,
    });
  }, [
    cargando,
    error,
    proyectosQuery.data,
    fasesQuery.data,
    gastosQuery.data,
    cobrosQuery.data,
    comprasQuery.data,
    proveedoresQuery.data,
    periodo,
    moneda,
    cotizacionActual,
  ]);

  return {
    metricas,
    cargando,
    error,
    filtros,
  };
}

export default useMetricas;
