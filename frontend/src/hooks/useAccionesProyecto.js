// Datos y mutaciones de la pestaña Acciones (compras/gastos/cobros de UN
// proyecto), sobre React Query en vez de useState+useEffect manual. Las
// listas de apoyo (fases, categorías, proveedores, productos, impuestos)
// vienen de hooks/queries.js -- las mismas keys que usan AnalisisGeneral y
// Seguimiento, así React Query las dedupea al cambiar de pestaña.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getComprasPorProyecto,
    crearCompra,
    actualizarCompra,
    eliminarCompra,
    subirComprobanteCompra,
    eliminarComprobanteCompra,
    crearNotaCompra,
    eliminarNotaCompra,
} from "../services/compraService";
import {
    getGastosPorProyecto,
    crearGasto,
    actualizarGasto,
    eliminarGasto,
    subirComprobanteGasto,
    eliminarComprobanteGasto,
} from "../services/gastoService";
import {
    getCobrosPorProyecto,
    crearCobro,
    actualizarCobro,
    eliminarCobro,
    subirComprobanteCobro,
    eliminarComprobanteCobro,
    crearNotaCobro,
    eliminarNotaCobro,
} from "../services/cobroService";
import { useFasesPorProyecto, useCategoriasGasto, useProveedores, useProductos, useImpuestos } from "./queries";
import { queryKeys } from "../lib/queryKeys";
import { useToast } from "../context/useToast";
import { obtenerDetalleBackend } from "../utils/errorHandling";

export function useAccionesProyecto(proyectoId) {
    const queryClient = useQueryClient();
    const toast = useToast();

    const comprasQuery = useQuery({
        queryKey: queryKeys.compras.byProyecto(proyectoId),
        queryFn: () => getComprasPorProyecto(proyectoId),
        enabled: Boolean(proyectoId),
    });
    const gastosQuery = useQuery({
        queryKey: queryKeys.gastos.byProyecto(proyectoId),
        queryFn: () => getGastosPorProyecto(proyectoId),
        enabled: Boolean(proyectoId),
    });
    const cobrosQuery = useQuery({
        queryKey: queryKeys.cobros.byProyecto(proyectoId),
        queryFn: () => getCobrosPorProyecto(proyectoId),
        enabled: Boolean(proyectoId),
    });

    const fasesQuery = useFasesPorProyecto(proyectoId);
    const categoriasGastoQuery = useCategoriasGasto();
    const proveedoresQuery = useProveedores();
    const productosQuery = useProductos();
    const impuestosQuery = useImpuestos();

    // Invalidar por el prefijo del recurso alcanza tanto esta key ("por
    // proyecto") como la global de Dashboard y la "por fase" de FaseDetalle
    // -- ver queryKeys.js.
    const invalidar = (recurso) => queryClient.invalidateQueries({ queryKey: [recurso] });

    const conToast = async (mensajeError, accion) => {
        try {
            return await accion();
        } catch (error) {
            console.error(mensajeError, error);
            toast.error(obtenerDetalleBackend(error) ?? mensajeError);
            throw error;
        }
    };

    // --- Gastos ---
    const guardarGasto = (gastoEditando, datosForm, comprobantesCambios = { archivos: [], eliminarIds: [] }) =>
        conToast("No se pudo guardar el gasto.", async () => {
            const gasto = gastoEditando
                ? await actualizarGasto(gastoEditando.id, datosForm)
                : await crearGasto({ ...datosForm, proyecto_id: proyectoId });
            await Promise.all([
                ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteGasto(gasto.id, id)),
                ...comprobantesCambios.archivos.map((archivo) => subirComprobanteGasto(gasto.id, archivo)),
            ]);
            invalidar("gastos");
            return gasto;
        });

    const eliminarGastoAccion = (gastoId) =>
        conToast("No se pudo eliminar el gasto.", async () => {
            await eliminarGasto(gastoId);
            invalidar("gastos");
        });

    const agregarComprobantesGasto = async (gastoId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteGasto(gastoId, archivo)));
        invalidar("gastos");
    };

    const eliminarComprobanteGastoAccion = async (gastoId, comprobanteId) => {
        await eliminarComprobanteGasto(gastoId, comprobanteId);
        invalidar("gastos");
    };

    // --- Cobros ---
    const guardarCobro = (cobroEditando, datosForm, comprobantesCambios = { archivos: [], eliminarIds: [] }) =>
        conToast("No se pudo guardar el cobro.", async () => {
            const cobro = cobroEditando
                ? await actualizarCobro(cobroEditando.id, datosForm)
                : await crearCobro({ ...datosForm, proyecto_id: proyectoId });
            await Promise.all([
                ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteCobro(cobro.id, id)),
                ...comprobantesCambios.archivos.map((archivo) => subirComprobanteCobro(cobro.id, archivo)),
            ]);
            invalidar("cobros");
            return cobro;
        });

    const eliminarCobroAccion = (cobroId) =>
        conToast("No se pudo eliminar el cobro.", async () => {
            await eliminarCobro(cobroId);
            invalidar("cobros");
        });

    const agregarComprobantesCobro = async (cobroId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteCobro(cobroId, archivo)));
        invalidar("cobros");
    };

    const eliminarComprobanteCobroAccion = async (cobroId, comprobanteId) => {
        await eliminarComprobanteCobro(cobroId, comprobanteId);
        invalidar("cobros");
    };

    // --- Compras ---
    const guardarCompra = (compraEditando, datosForm, comprobantesCambios = { archivos: [], eliminarIds: [] }) =>
        conToast("No se pudo guardar la compra.", async () => {
            const compra = compraEditando ? await actualizarCompra(compraEditando.id, datosForm) : await crearCompra(datosForm);
            await Promise.all([
                ...comprobantesCambios.eliminarIds.map((id) => eliminarComprobanteCompra(compra.id, id)),
                ...comprobantesCambios.archivos.map((archivo) => subirComprobanteCompra(compra.id, archivo)),
            ]);
            invalidar("compras");
            return compra;
        });

    const eliminarCompraAccion = (compraId) =>
        conToast("No se pudo eliminar la compra.", async () => {
            await eliminarCompra(compraId);
            invalidar("compras");
        });

    const toggleEstadoPagoCompra = (compra) =>
        conToast("No se pudo actualizar el estado de pago.", async () => {
            const estado_pago = compra.estado_pago === "pagado" ? "pendiente" : "pagado";
            await actualizarCompra(compra.id, { estado_pago });
            invalidar("compras");
        });

    const toggleEstadoEnvioCompra = (compra) =>
        conToast("No se pudo actualizar el estado de envío.", async () => {
            const estado_envio = compra.estado_envio === "entregado" ? "pedido" : "entregado";
            await actualizarCompra(compra.id, { estado_envio });
            invalidar("compras");
        });

    const agregarComprobantesCompra = async (compraId, files) => {
        await Promise.all(Array.from(files).map((archivo) => subirComprobanteCompra(compraId, archivo)));
        invalidar("compras");
    };

    const eliminarComprobanteCompraAccion = async (compraId, comprobanteId) => {
        await eliminarComprobanteCompra(compraId, comprobanteId);
        invalidar("compras");
    };

    // --- Notas (cuenta corriente: nota de crédito / débito) ---
    const guardarNota = async (contexto, entidad, payload) => {
        if (contexto === "compra") {
            await crearNotaCompra(entidad.id, payload);
            invalidar("compras");
        } else {
            await crearNotaCobro(entidad.id, payload);
            invalidar("cobros");
        }
    };

    const eliminarNotaCompraAccion = async (compraId, notaId) => {
        await eliminarNotaCompra(compraId, notaId);
        invalidar("compras");
    };

    const eliminarNotaCobroAccion = async (cobroId, notaId) => {
        await eliminarNotaCobro(cobroId, notaId);
        invalidar("cobros");
    };

    return {
        compras: comprasQuery.data ?? [],
        gastos: gastosQuery.data ?? [],
        cobros: cobrosQuery.data ?? [],
        fases: fasesQuery.data ?? [],
        categoriasGasto: categoriasGastoQuery.data ?? [],
        proveedores: proveedoresQuery.data ?? [],
        productos: productosQuery.data ?? [],
        impuestos: impuestosQuery.data ?? [],
        isLoading: comprasQuery.isLoading || gastosQuery.isLoading || cobrosQuery.isLoading,

        guardarGasto,
        eliminarGasto: eliminarGastoAccion,
        agregarComprobantesGasto,
        eliminarComprobanteGasto: eliminarComprobanteGastoAccion,

        guardarCobro,
        eliminarCobro: eliminarCobroAccion,
        agregarComprobantesCobro,
        eliminarComprobanteCobro: eliminarComprobanteCobroAccion,

        guardarCompra,
        eliminarCompra: eliminarCompraAccion,
        toggleEstadoPagoCompra,
        toggleEstadoEnvioCompra,
        agregarComprobantesCompra,
        eliminarComprobanteCompra: eliminarComprobanteCompraAccion,

        guardarNota,
        eliminarNotaCompra: eliminarNotaCompraAccion,
        eliminarNotaCobro: eliminarNotaCobroAccion,
    };
}

export default useAccionesProyecto;
