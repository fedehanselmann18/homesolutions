import { useMetricas } from "../hooks/useMetricas";
import { usePageTitle } from "../hooks/usePageTitle";
import { PageHeader } from "../components/shared/PageHeader";
import { EstadoVacio } from "../components/shared/EstadoVacio";
import { EstadoError } from "../components/shared/EstadoError";
import { FiltrosMetricas } from "../components/metricas/FiltrosMetricas";
import { TarjetaVariacion } from "../components/metricas/TarjetaVariacion";
import { GraficoMesAMes } from "../components/metricas/GraficoMesAMes";
import { ObrasContraContrato } from "../components/metricas/ObrasContraContrato";
import { RankingRentabilidad } from "../components/metricas/RankingRentabilidad";
import { EgresosPorCategoria } from "../components/metricas/EgresosPorCategoria";
import { TablaObras } from "../components/metricas/TablaObras";
import { ETIQUETAS_METRICAS } from "../constants/metricas";
import { formatMoneda, formatNumero } from "../utils/formato";
import "./Metricas.css";

// Métricas: ingresos, egresos, resultado y rentabilidad de las obras en un
// período. Los números salen de utils/metricas.js; esta página sólo dibuja.
// Arriba, tres preguntas: cuánto cambió (KPIs contra el período anterior),
// cómo viene la caja (mes a mes) y cómo está cada obra contra su contrato.
// Es lo que la separa del Panel, que muestra la foto de hoy. Abajo, la
// comparación entre obras.

const E = ETIQUETAS_METRICAS;

// La estructura real de la página (4 KPIs, dos gráficos, tres bloques y la
// tabla de obras) con bloques placeholder: el layout es fijo, así que no salta
// cuando llegan los datos (DESIGN.md §16). Los filtros quedan arriba, vivos.
function MetricasSkeleton() {
  return (
    <div className="metricas-cuerpo" aria-hidden="true">
      <div className="metricas-kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="metricas-kpi-skeleton">
            <div className="skeleton skeleton--kpi-label" />
            <div className="skeleton skeleton--kpi-valor" />
            <div className="skeleton skeleton--kpi-label" />
          </div>
        ))}
      </div>
      <div className="metricas-graficos">
        <div className="skeleton skeleton--grafico" />
        <div className="skeleton skeleton--grafico" />
      </div>
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
  const { kpis, kpisAnterior, variacion, moneda } = metricas;
  const fm = (monto) => formatMoneda(monto, moneda);
  const tarjetas = [
    { clave: "ingresos", formato: fm },
    { clave: "egresos", formato: fm, neutro: true },
    { clave: "resultado", formato: fm },
    { clave: "rentabilidad", formato: formatPct, pp: true },
  ];
  return (
    <div className="metricas-cuerpo">
      <div className="metricas-kpis">
        {tarjetas.map((t) => (
          <TarjetaVariacion
            key={t.clave}
            titulo={E[t.clave]}
            valor={t.formato(kpis[t.clave])}
            negativo={kpis[t.clave] < 0}
            variacion={variacion?.[t.clave] ?? null}
            enPuntos={t.pp}
            favorableSiSube={!t.neutro}
            anterior={kpisAnterior ? t.formato(kpisAnterior[t.clave]) : null}
          />
        ))}
      </div>

      <div className="metricas-graficos">
        <GraficoMesAMes meses={metricas.evolucionMensual} moneda={moneda} />
        <ObrasContraContrato obras={metricas.obrasContrato} />
      </div>

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
  const { metricas, cargando, error, filtros } = useMetricas();

  let cuerpo;
  if (cargando) cuerpo = <MetricasSkeleton />;
  else if (error || !metricas) cuerpo = <EstadoError mensaje={E.errorCarga} grande />;
  else if (metricas.filasObras.length === 0) cuerpo = <EstadoVacio mensaje={E.sinDatos} grande />;
  else cuerpo = <CuerpoMetricas metricas={metricas} />;

  return (
    <div className="metricas">
      <PageHeader titulo={E.titulo} />
      <FiltrosMetricas filtros={filtros} />
      {cuerpo}
    </div>
  );
}

export default Metricas;
