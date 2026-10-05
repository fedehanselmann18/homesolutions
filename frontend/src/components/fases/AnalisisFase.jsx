import { useMemo } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

import { calcularAnalisis } from "../../utils/analisis";
import { formatMoneda, formatMonedaDual } from "../../utils/formato";
import { montoCobroNeto, precioAcordado as precioAcordadoEn } from "../../utils/moneda";
import { useCotizacionActual } from "../../hooks/queries";
import { useMonedaAnalisis } from "../../hooks/useMonedaAnalisis";
import { SelectorMoneda } from "../shared/SelectorMoneda";
import { ROJO, NARANJA } from "../../constants/colores";
import { TarjetaKpi } from "../shared/TarjetaKpi";
import {
  Seccion,
  TooltipMoneda,
  ContenidoTreemap,
  Torta,
  COLORES_TORTA,
} from "../proyectos/AnalisisGraficos";

/**
 * Tab "Análisis de la fase" de FaseDetalle.jsx -- reusa calcularAnalisis
 * (utils/analisis.js) scopeado a compras/gastos de esta fase, con `proyecto`
 * completo (hace falta precio_acordado_usd) y `cobros: []` (una fase no tiene
 * cobros propios). No renderiza la cascada de rentabilidad ni el resto de
 * secciones a nivel proyecto -- ver docs/redesign/11_fase_detalle_tabs.md.
 *
 * Moneda: la misma elección global que el análisis del proyecto
 * (useMonedaAnalisis). Los % salen siempre de los dólares (caveat 6.3) y lo
 * que se debe va con los pesos primero (caveat 6.2).
 */
export function AnalisisFase({
  proyecto,
  gastosFase,
  comprasFase,
  productos,
  proveedores,
  cobrosProyecto,
  kpisFase,
  comprasImpagasFase,
  montoSinPagarFase,
}) {
  const [moneda] = useMonedaAnalisis();
  const cotizacionActual = useCotizacionActual(proyecto);
  const fm = (monto) => formatMoneda(monto, moneda);

  const analisis = useMemo(
    () =>
      calcularAnalisis({
        proyecto,
        fases: [],
        gastos: gastosFase,
        compras: comprasFase,
        cobros: [],
        productos,
        proveedores,
        moneda,
        cotizacionActual,
      }),
    [proyecto, gastosFase, comprasFase, productos, proveedores, moneda, cotizacionActual]
  );

  const { gastosPorCategoria, comprasPorTipoYProducto, topProveedores, totales } = analisis;

  // % cobrado del proyecto -- mismo cálculo que totales.pctCobrado de
  // AnalisisGeneral.jsx, pero sobre los cobros del proyecto entero (una fase
  // no tiene cobros propios), no sobre `cobros: []` de este análisis.
  // El % en USD siempre (caveat 6.3); el monto, en la moneda elegida.
  const precioAcordadoUsd = precioAcordadoEn(proyecto, "usd");
  const cobradoUsd = cobrosProyecto.reduce((acc, c) => acc + montoCobroNeto(c, "usd"), 0);
  const totalCobradoProyecto = cobrosProyecto.reduce(
    (acc, c) => acc + montoCobroNeto(c, moneda),
    0
  );
  const pctCobradoProyecto = precioAcordadoUsd > 0 ? (cobradoUsd / precioAcordadoUsd) * 100 : 0;
  const precioAcordado = precioAcordadoEn(proyecto, moneda, cotizacionActual);

  return (
    <div className="analisis">
      <div className="analisis-header">
        <SelectorMoneda />
      </div>

      <div className="analisis-kpis">
        <TarjetaKpi
          titulo="Gastado en esta fase"
          valor={fm(kpisFase.gastadoFase[moneda])}
          destacado
        />
        <TarjetaKpi
          titulo="% del presupuesto del proyecto"
          valor={`${kpisFase.pctPresupuesto.toFixed(1)}%`}
          porcentaje={kpisFase.pctPresupuesto}
          detalle={
            precioAcordado == null
              ? "Precio acordado sin cotización cargada para pasarlo a pesos"
              : `${fm(precioAcordado)} acordados`
          }
          color={kpisFase.pctPresupuesto > 100 ? ROJO : undefined}
        />
        <TarjetaKpi
          titulo="% del gasto total del proyecto"
          valor={`${kpisFase.pctGastoTotal.toFixed(1)}%`}
          porcentaje={kpisFase.pctGastoTotal}
          detalle="Comparado con las demás fases"
        />
        <TarjetaKpi
          titulo="Sin pagar"
          valor={formatMonedaDual(montoSinPagarFase.ars, montoSinPagarFase.usd, {
            principal: "ars",
          })}
          detalle={
            comprasImpagasFase.length === 0
              ? "Todo al día"
              : `${comprasImpagasFase.length} ${comprasImpagasFase.length === 1 ? "compra" : "compras"}`
          }
          color={montoSinPagarFase.ars > 0 ? ROJO : undefined}
          destacado
        />
      </div>

      <Seccion
        titulo="Compras por tipo de producto"
        descripcion="Cada bloque es un tipo (equipo, materiales, mano de obra) abierto por producto. Se calcula sobre el detalle de las compras."
        vacio={comprasPorTipoYProducto.length === 0}
        mensajeVacio="Las compras de esta fase no tienen detalle de productos cargado."
      >
        <div className="analisis-leyenda-tipos">
          {comprasPorTipoYProducto.map((tipo) => (
            <span key={tipo.name} className="analisis-leyenda-tipo">
              <span className="analisis-leyenda-punto" style={{ backgroundColor: tipo.color }} />
              {tipo.name}
              <strong>{fm(tipo.monto)}</strong>
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <Treemap
            data={comprasPorTipoYProducto}
            dataKey="monto"
            nameKey="name"
            isAnimationActive={false}
            content={<ContenidoTreemap moneda={moneda} />}
          >
            <Tooltip
              content={<TooltipMoneda obtenerValor={(d) => d.monto ?? d.value} moneda={moneda} />}
            />
          </Treemap>
        </ResponsiveContainer>
      </Seccion>

      <Seccion
        titulo="Gastos por categoría"
        descripcion={`Total de gastos: ${fm(totales.gastos)}`}
        vacio={gastosPorCategoria.length === 0}
        mensajeVacio="No hay gastos cargados."
      >
        <Torta datos={gastosPorCategoria} colores={COLORES_TORTA} moneda={moneda} />
      </Seccion>

      <Seccion
        titulo="Top proveedores de la fase"
        vacio={topProveedores.length === 0}
        mensajeVacio="No hay compras cargadas."
      >
        <ul className="analisis-ranking">
          {topProveedores.map((proveedor, i) => (
            <li key={proveedor.nombre} className="analisis-ranking-item">
              <span className="analisis-ranking-puesto">{i + 1}</span>
              <span className="analisis-ranking-nombre">{proveedor.nombre}</span>
              <span className="analisis-ranking-monto">{fm(proveedor.monto)}</span>
            </li>
          ))}
        </ul>
      </Seccion>

      {kpisFase.cantidadNotasFase > 0 && (
        <div className="analisis-kpis--notas">
          <TarjetaKpi
            titulo="Notas de crédito (fase)"
            valor={fm(kpisFase.notasCreditoFase[moneda])}
            detalle="A favor nuestro, ya restado del gastado en esta fase"
            color={ROJO}
            destacado
            plano
          />
          <TarjetaKpi
            titulo="Notas de débito (fase)"
            valor={fm(kpisFase.notasDebitoFase[moneda])}
            detalle="En contra nuestro, ya sumado al gastado en esta fase"
            color={NARANJA}
            destacado
            plano
          />
        </div>
      )}

      <Seccion
        titulo="Cobrado del proyecto"
        descripcion="Cuánto lleva cobrado el proyecto en total, sobre el mismo presupuesto acordado de arriba."
      >
        <TarjetaKpi
          valor={`${pctCobradoProyecto.toFixed(1)}%`}
          porcentaje={pctCobradoProyecto}
          detalle={`${fm(totalCobradoProyecto)} cobrados en todo el proyecto`}
        />
      </Seccion>
    </div>
  );
}

export default AnalisisFase;
