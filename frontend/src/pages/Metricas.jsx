import { useMetricas } from "../hooks/useMetricas";
import { usePageTitle } from "../hooks/usePageTitle";
import { PageHeader } from "../components/shared/PageHeader";
import { TarjetaKpi } from "../components/shared/TarjetaKpi";
import { EstadoVacio } from "../components/shared/EstadoVacio";
import { EstadoError } from "../components/shared/EstadoError";
import { FiltrosMetricas } from "../components/metricas/FiltrosMetricas";
import { GraficoIngresosEgresos } from "../components/metricas/GraficoIngresosEgresos";
import { RankingRentabilidad } from "../components/metricas/RankingRentabilidad";
import { EgresosPorCategoria } from "../components/metricas/EgresosPorCategoria";
import { TablaObras } from "../components/metricas/TablaObras";
import { ETIQUETAS_METRICAS } from "../constants/metricas";
import { ERROR_TEXTO } from "../constants/colores";
import { formatMoneda, formatNumero } from "../utils/formato";
import "./Metricas.css";

// Métricas: ingresos, egresos, resultado y rentabilidad de las obras en un
// período. Los números salen de utils/metricas.js; esta página sólo dibuja.
// Dirección 1b de docs/PanelMetricas/Metricas.dc.html: grilla de bloques
// separados por reglas y la tabla de obras abajo.

const E = ETIQUETAS_METRICAS;

// La estructura real de la página (4 KPIs, gráfico, tres bloques y la tabla
// de obras) con bloques placeholder: el layout es fijo, así que no salta
// cuando llegan los datos (DESIGN.md §16). Los filtros quedan arriba, vivos.
function MetricasSkeleton() {
  return (
    <div className="metricas-cuerpo" aria-hidden="true">
      <div className="metricas-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="metricas-kpi-skeleton">
            <div className="skeleton skeleton--kpi-label" />
            <div className="skeleton skeleton--kpi-valor" />
          </div>
        ))}
      </div>
      <div className="skeleton skeleton--grafico" />
      <div className="metricas-bloques">
        {[0, 1, 2].map((i) => (
          <div key={i} className="metricas-bloque">
            <div className="skeleton skeleton--seccion-titulo" />
            {[0, 1, 2, 3].map((j) => (
              <div key={j} className="skeleton skeleton--barra" />
            ))}
          </div>
        ))}
      </div>
      <div>
        <div className="skeleton skeleton--seccion-titulo" />
        {[0, 1, 2, 3].map((j) => (
          <div key={j} className="skeleton skeleton--fila" />
        ))}
      </div>
    </div>
  );
}

const formatPct = (valor) => (valor == null ? E.sinValor : `${formatNumero(valor, 1)} %`);

function CuerpoMetricas({ metricas }) {
  const { kpis, moneda } = metricas;
  return (
    <div className="metricas-cuerpo">
      <div className="metricas-kpis">
        <TarjetaKpi titulo={E.ingresos} valor={formatMoneda(kpis.ingresos, moneda)} />
        <TarjetaKpi titulo={E.egresos} valor={formatMoneda(kpis.egresos, moneda)} />
        <TarjetaKpi
          titulo={E.resultado}
          valor={formatMoneda(kpis.resultado, moneda)}
          color={ERROR_TEXTO}
          destacado={kpis.resultado < 0}
        />
        <TarjetaKpi
          titulo={E.rentabilidad}
          valor={formatPct(kpis.rentabilidad)}
          color={ERROR_TEXTO}
          destacado={kpis.rentabilidad < 0}
        />
      </div>

      <GraficoIngresosEgresos datos={metricas.evolucionMensual} moneda={moneda} />

      <div className="metricas-bloques">
        <RankingRentabilidad obras={metricas.rentabilidadPorObra} />
        <EgresosPorCategoria
          titulo={E.egresosPorCategoria}
          filas={metricas.egresosPorCategoria}
          moneda={moneda}
          vacio={E.sinEgresos}
        />
        <EgresosPorCategoria
          titulo={E.proveedores}
          filas={metricas.topProveedores}
          moneda={moneda}
          vacio={E.sinCompras}
        />
      </div>

      <TablaObras filas={metricas.filasObras} moneda={moneda} />
    </div>
  );
}

export function Metricas() {
  usePageTitle(E.titulo);
  const { metricas, proyectos, cargando, error, filtros } = useMetricas();

  let cuerpo;
  if (cargando) cuerpo = <MetricasSkeleton />;
  else if (error || !metricas) cuerpo = <EstadoError mensaje={E.errorCarga} grande />;
  else if (metricas.filasObras.length === 0) cuerpo = <EstadoVacio mensaje={E.sinDatos} grande />;
  else cuerpo = <CuerpoMetricas metricas={metricas} />;

  return (
    <div className="metricas">
      <PageHeader titulo={E.titulo} />
      <FiltrosMetricas filtros={filtros} proyectos={proyectos} />
      {cuerpo}
    </div>
  );
}

export default Metricas;
