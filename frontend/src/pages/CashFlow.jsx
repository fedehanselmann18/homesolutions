import {
  useCobros,
  useCompras,
  useFases,
  useGastos,
  useProveedores,
  useProyectos,
} from "../hooks/queries";
import { usePageTitle } from "../hooks/usePageTitle";
import { PageHeader } from "../components/shared/PageHeader";
import { Cargando } from "../components/shared/Cargando";
import { EstadoError } from "../components/shared/EstadoError";
import { CashFlow as CuerpoCashFlow } from "../components/cashflow/CashFlow";

/**
 * Cash flow de la empresa: todas las obras juntas. Usa las mismas queries
 * globales que el Panel (React Query las comparte). La de una obra sola es
 * una pestaña del proyecto (components/proyectos/CashFlowProyecto.jsx).
 */
export function CashFlow() {
  usePageTitle("Cash flow");
  const queries = {
    compras: useCompras(),
    gastos: useGastos(),
    cobros: useCobros(),
    proyectos: useProyectos(),
    proveedores: useProveedores(),
    fases: useFases(),
  };
  const lista = Object.values(queries);
  const cargando = lista.some((q) => q.isLoading);
  const error = lista.some((q) => q.isError);

  return (
    <div className="pagina-cashflow">
      <PageHeader titulo="Cash flow" />
      {cargando ? (
        <Cargando texto="Cargando el cash flow..." />
      ) : error ? (
        <EstadoError mensaje="No se pudo cargar el cash flow." grande />
      ) : (
        <CuerpoCashFlow
          compras={queries.compras.data}
          gastos={queries.gastos.data}
          cobros={queries.cobros.data}
          proyectos={queries.proyectos.data}
          proveedores={queries.proveedores.data}
          fases={queries.fases.data}
        />
      )}
    </div>
  );
}

export default CashFlow;
