// Datos y mutaciones de la página de detalle de una fase, sobre React
// Query. Las queries "por proyecto" (gastos, compras, proveedores,
// productos...) usan las mismas keys que Acciones/AnalisisGeneral/
// Seguimiento, así React Query las dedupea si ya se pidieron desde otra
// pestaña del mismo proyecto.
import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { actualizarFase } from "../services/faseService";
import {
  crearGasto,
  actualizarGasto,
  eliminarGasto,
  subirComprobanteGasto,
  eliminarComprobanteGasto,
} from "../services/gastoService";
import {
  crearCompra,
  actualizarCompra,
  eliminarCompra,
  subirComprobanteCompra,
  eliminarComprobanteCompra,
  crearNotaCompra,
} from "../services/compraService";
import { notasDeCompras, totalNotasCredito, totalNotasDebito } from "../utils/notas";
import { useToast } from "../context/useToast";
import {
  useFase,
  useProyecto,
  useGastosPorFase,
  useComprasPorFase,
  useGastosPorProyecto,
  useComprasPorProyecto,
  useCobrosPorProyecto,
  useProveedores,
  useProductos,
  useCategoriasGasto,
  useImpuestos,
} from "./queries";

const sumar = (items, obtenerMonto) =>
  items.reduce((acc, item) => acc + (obtenerMonto(item) || 0), 0);

export function useFaseDetalle(faseId) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const faseQuery = useFase(faseId);
  const proyectoId = faseQuery.data?.proyecto_id;

  const proyectoQuery = useProyecto(proyectoId);
  const gastosFaseQuery = useGastosPorFase(faseId);
  const comprasFaseQuery = useComprasPorFase(faseId);
  const gastosProyectoQuery = useGastosPorProyecto(proyectoId);
  const comprasProyectoQuery = useComprasPorProyecto(proyectoId);
  const cobrosProyectoQuery = useCobrosPorProyecto(proyectoId);
  const proveedoresQuery = useProveedores();
  const productosQuery = useProductos();
  const categoriasGastoQuery = useCategoriasGasto();
  const impuestosQuery = useImpuestos();

  const fase = faseQuery.data ?? null;
  const proyecto = proyectoQuery.data ?? null;
  const gastosFase = gastosFaseQuery.data ?? [];
  const comprasFase = comprasFaseQuery.data ?? [];
  const gastosProyecto = gastosProyectoQuery.data ?? [];
  const comprasProyecto = comprasProyectoQuery.data ?? [];
  const cobrosProyecto = cobrosProyectoQuery.data ?? [];

  const kpis = useMemo(() => {
    if (!proyecto) return null;
    // precio_total ya incluye impuestos + notas de crédito/débito (ver
    // Compra.precio_total en el backend) -- "gastado en esta fase" ya
    // sale bien sin tocar nada acá.
    const gastadoFase =
      sumar(gastosFase, (g) => g.monto) + sumar(comprasFase, (c) => c.precio_total);
    const totalGastoProyecto =
      sumar(gastosProyecto, (g) => g.monto) + sumar(comprasProyecto, (c) => c.precio_total);
    const precioAcordado = Number(proyecto.precio_acordado ?? 0);

    const notasFase = notasDeCompras(comprasFase);

    return {
      gastadoFase,
      pctPresupuesto: precioAcordado > 0 ? (gastadoFase / precioAcordado) * 100 : 0,
      pctGastoTotal: totalGastoProyecto > 0 ? (gastadoFase / totalGastoProyecto) * 100 : 0,
      notasCreditoFase: totalNotasCredito(notasFase),
      notasDebitoFase: totalNotasDebito(notasFase),
      cantidadNotasFase: notasFase.length,
    };
    // Las dependencias usan los datos crudos de cada query (en vez de
    // gastosFase/comprasFase/etc, que son un `?? []` nuevo en cada
    // render) para que el memo no se recalcule de más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    proyecto,
    gastosFaseQuery.data,
    comprasFaseQuery.data,
    gastosProyectoQuery.data,
    comprasProyectoQuery.data,
  ]);

  const invalidar = (recurso) => queryClient.invalidateQueries({ queryKey: [recurso] });

  // --- Marcar como terminada ---
  const marcarTerminada = async () => {
    try {
      await actualizarFase(fase.id, { estado: "terminada" });
      invalidar("fases");
    } catch (error) {
      console.error("Error marcando la fase como terminada:", error);
      toast.error("No se pudo marcar la fase como terminada.");
    }
  };

  // --- Gastos ---
  const guardarGasto = async (
    gastoEditando,
    datosForm,
    comprobantesCambios = { archivos: [], eliminarIds: [] }
  ) => {
    try {
      const gasto = gastoEditando
        ? await actualizarGasto(gastoEditando.id, datosForm)
        : await crearGasto({ ...datosForm, proyecto_id: proyecto.id });
      await Promise.all([
        ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteGasto(gasto.id, id)),
        ...comprobantesCambios.archivos.map((archivo) => subirComprobanteGasto(gasto.id, archivo)),
      ]);
      invalidar("gastos");
      return gasto;
    } catch (error) {
      console.error("Error guardando gasto:", error);
      toast.error("No se pudo guardar el gasto.");
      throw error;
    }
  };

  const eliminarGastoAccion = async (gastoId) => {
    try {
      await eliminarGasto(gastoId);
      invalidar("gastos");
    } catch (error) {
      console.error("Error eliminando gasto:", error);
      toast.error("No se pudo eliminar el gasto.");
      throw error;
    }
  };

  // --- Compras ---
  const guardarCompra = async (
    compraEditando,
    datosForm,
    comprobantesCambios = { archivos: [], eliminarIds: [] }
  ) => {
    try {
      const compra = compraEditando
        ? await actualizarCompra(compraEditando.id, datosForm)
        : await crearCompra(datosForm);
      await Promise.all([
        ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteCompra(compra.id, id)),
        ...comprobantesCambios.archivos.map((archivo) =>
          subirComprobanteCompra(compra.id, archivo)
        ),
      ]);
      invalidar("compras");
      return compra;
    } catch (error) {
      console.error("Error guardando compra:", error);
      toast.error("No se pudo guardar la compra.");
      throw error;
    }
  };

  const eliminarCompraAccion = async (compraId) => {
    try {
      await eliminarCompra(compraId);
      invalidar("compras");
    } catch (error) {
      console.error("Error eliminando compra:", error);
      toast.error("No se pudo eliminar la compra.");
      throw error;
    }
  };

  const toggleEstadoPagoCompra = async (compra) => {
    try {
      const estado_pago = compra.estado_pago === "pagado" ? "pendiente" : "pagado";
      await actualizarCompra(compra.id, { estado_pago });
      invalidar("compras");
    } catch (error) {
      console.error("Error actualizando el estado de pago de la compra:", error);
      toast.error("No se pudo actualizar el estado de pago.");
      throw error;
    }
  };

  const toggleEstadoEnvioCompra = async (compra) => {
    try {
      const estado_envio = compra.estado_envio === "entregado" ? "pedido" : "entregado";
      await actualizarCompra(compra.id, { estado_envio });
      invalidar("compras");
    } catch (error) {
      console.error("Error actualizando el estado de envío de la compra:", error);
      toast.error("No se pudo actualizar el estado de envío.");
      throw error;
    }
  };

  // --- Notas (cuenta corriente: nota de crédito / débito de compras) ---
  // Sólo alta -- borrar una nota existente se sigue haciendo desde la
  // pestaña Acciones a nivel proyecto (components/proyectos/Acciones.jsx),
  // que conserva la card completa con la lista de notas.
  const guardarNota = async (compra, payload) => {
    await crearNotaCompra(compra.id, payload);
    invalidar("compras");
  };

  return {
    fase,
    proyecto,
    gastosFase,
    comprasFase,
    gastosProyecto,
    comprasProyecto,
    cobrosProyecto,
    proveedores: proveedoresQuery.data ?? [],
    productos: productosQuery.data ?? [],
    categoriasGasto: categoriasGastoQuery.data ?? [],
    impuestos: impuestosQuery.data ?? [],
    kpis,
    cargando: faseQuery.isLoading || (Boolean(proyectoId) && proyectoQuery.isLoading),
    error: faseQuery.error ?? proyectoQuery.error ?? null,

    marcarTerminada,
    guardarGasto,
    eliminarGasto: eliminarGastoAccion,
    guardarCompra,
    eliminarCompra: eliminarCompraAccion,
    toggleEstadoPagoCompra,
    toggleEstadoEnvioCompra,
    guardarNota,
  };
}

export default useFaseDetalle;
