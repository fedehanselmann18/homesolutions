import {
  useCobrosPorProyecto,
  useComprasPorProyecto,
  useFasesPorProyecto,
  useGastosPorProyecto,
  useProveedores,
  useProyecto,
} from "../../hooks/queries";
import { Cargando } from "../shared/Cargando";
import { EstadoError } from "../shared/EstadoError";
import { CashFlow } from "../cashflow/CashFlow";

/** Pestaña «Cash flow» de un proyecto: el mismo cálculo que el general, sólo con esta obra. */
export function CashFlowProyecto({ proyectoId }) {
  const queries = {
    compras: useComprasPorProyecto(proyectoId),
    gastos: useGastosPorProyecto(proyectoId),
    cobros: useCobrosPorProyecto(proyectoId),
    proyecto: useProyecto(proyectoId),
    proveedores: useProveedores(),
    fases: useFasesPorProyecto(proyectoId),
  };
  const lista = Object.values(queries);
  if (lista.some((q) => q.isLoading)) return <Cargando texto="Cargando el cash flow..." />;
  if (lista.some((q) => q.isError))
    return <EstadoError mensaje="No se pudo cargar el cash flow de la obra." grande />;

  return (
    <CashFlow
      compras={queries.compras.data}
      gastos={queries.gastos.data}
      cobros={queries.cobros.data}
      proyectos={queries.proyecto.data ? [queries.proyecto.data] : []}
      proveedores={queries.proveedores.data}
      fases={queries.fases.data}
      mostrarObra={false}
    />
  );
}

export default CashFlowProyecto;
