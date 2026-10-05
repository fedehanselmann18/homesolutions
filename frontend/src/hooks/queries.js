// Hooks de lectura compartidos: cada uno mapea 1 a 1 a un endpoint, con la
// query key central de queryKeys.js. Dashboard, AnalisisGeneral, Acciones,
// FaseDetalle y Seguimiento usan estos mismos hooks para el mismo recurso,
// así React Query dedupea el fetch al navegar entre pestañas de un proyecto
// en vez de volver a pedirlo cada vez.
import { useQuery } from "@tanstack/react-query";
import { getProyectos, getProyectoPorId } from "../services/proyectoService";
import { getFases, getFasesPorProyecto, getFasePorId } from "../services/faseService";
import { getGastos, getGastosPorProyecto, getGastosPorFase } from "../services/gastoService";
import { getCobros, getCobrosPorProyecto } from "../services/cobroService";
import { getCompras, getComprasPorProyecto, getComprasPorFase } from "../services/compraService";
import { getProductos } from "../services/productoService";
import { getProveedores } from "../services/proveedorService";
import { getCategorias } from "../services/categoriaService";
import { getCategoriasGasto } from "../services/categoriaGastoService";
import { getImpuestos } from "../services/impuestosService";
import { getCotizaciones, getUltimaCotizacion } from "../services/cotizacionService";
import { queryKeys } from "../lib/queryKeys";

export const useProyectos = () =>
  useQuery({ queryKey: queryKeys.proyectos.all, queryFn: getProyectos });

export const useProyecto = (proyectoId) =>
  useQuery({
    queryKey: queryKeys.proyectos.detail(proyectoId),
    queryFn: () => getProyectoPorId(proyectoId),
    enabled: Boolean(proyectoId),
  });

export const useFases = () => useQuery({ queryKey: queryKeys.fases.all, queryFn: getFases });

export const useFasesPorProyecto = (proyectoId) =>
  useQuery({
    queryKey: queryKeys.fases.byProyecto(proyectoId),
    queryFn: () => getFasesPorProyecto(proyectoId),
    enabled: Boolean(proyectoId),
  });

export const useFase = (faseId) =>
  useQuery({
    queryKey: queryKeys.fases.detail(faseId),
    queryFn: () => getFasePorId(faseId),
    enabled: Boolean(faseId),
  });

export const useGastos = () => useQuery({ queryKey: queryKeys.gastos.all, queryFn: getGastos });

export const useGastosPorProyecto = (proyectoId) =>
  useQuery({
    queryKey: queryKeys.gastos.byProyecto(proyectoId),
    queryFn: () => getGastosPorProyecto(proyectoId),
    enabled: Boolean(proyectoId),
  });

export const useGastosPorFase = (faseId) =>
  useQuery({
    queryKey: queryKeys.gastos.byFase(faseId),
    queryFn: () => getGastosPorFase(faseId),
    enabled: Boolean(faseId),
  });

export const useCobros = () => useQuery({ queryKey: queryKeys.cobros.all, queryFn: getCobros });

export const useCobrosPorProyecto = (proyectoId) =>
  useQuery({
    queryKey: queryKeys.cobros.byProyecto(proyectoId),
    queryFn: () => getCobrosPorProyecto(proyectoId),
    enabled: Boolean(proyectoId),
  });

export const useCompras = () => useQuery({ queryKey: queryKeys.compras.all, queryFn: getCompras });

export const useComprasPorProyecto = (proyectoId) =>
  useQuery({
    queryKey: queryKeys.compras.byProyecto(proyectoId),
    queryFn: () => getComprasPorProyecto(proyectoId),
    enabled: Boolean(proyectoId),
  });

export const useComprasPorFase = (faseId) =>
  useQuery({
    queryKey: queryKeys.compras.byFase(faseId),
    queryFn: () => getComprasPorFase(faseId),
    enabled: Boolean(faseId),
  });

export const useProductos = () =>
  useQuery({ queryKey: queryKeys.productos.all, queryFn: getProductos });

export const useProveedores = () =>
  useQuery({ queryKey: queryKeys.proveedores.all, queryFn: getProveedores });

export const useCategorias = () =>
  useQuery({ queryKey: queryKeys.categorias.all, queryFn: getCategorias });

export const useCategoriasGasto = () =>
  useQuery({ queryKey: queryKeys.categoriasGasto.all, queryFn: getCategoriasGasto });

export const useImpuestos = () =>
  useQuery({ queryKey: queryKeys.impuestos.all, queryFn: getImpuestos });

export const useCotizaciones = () =>
  useQuery({ queryKey: queryKeys.cotizaciones.all, queryFn: getCotizaciones });

/**
 * La última cotización cargada hasta `fecha` (hoy si no viene). `tipo` es
 * opcional. Sirve para dos cosas: precargar el dólar del día en los forms
 * (ver useCotizacionDia) y pasar a pesos el precio acordado ("cuánto vale hoy
 * el contrato", decisión #8 de PLAN_TIPO_CAMBIO.md).
 */
export const useUltimaCotizacion = ({ tipo, fecha } = {}) =>
  useQuery({
    queryKey: queryKeys.cotizaciones.ultima({ tipo, fecha }),
    queryFn: () => getUltimaCotizacion({ tipo, fecha }),
  });

/**
 * Cotización de referencia para mostrar el precio acordado de un proyecto en
 * pesos: la última del tipo de dólar con que se acordó (si se registró y hay
 * alguna), si no la última de cualquier tipo. Mismo criterio que el PDF
 * (routes/proyectos.py), así la app y el reporte muestran el mismo número.
 */
export function useCotizacionActual(proyecto) {
  const tipo = proyecto?.tipo_cambio_acordado ?? null;
  const delTipo = useUltimaCotizacion({ tipo });
  const cualquiera = useUltimaCotizacion();
  return (tipo ? delTipo.data : null) ?? cualquiera.data ?? null;
}
