import { useMemo } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

import { calcularAnalisis } from "../../utils/analisis";
import { formatMoneda } from "../../utils/formato";
import { TarjetaKpi } from "../shared/TarjetaKpi";
import {
  Seccion,
  TooltipMoneda,
  ContenidoTreemap,
  Torta,
  COLORES_TORTA,
} from "../proyectos/AnalisisGraficos";

const ROJO = "#dc2626";
const NARANJA = "#d97706";

/**
 * Tab "Análisis de la fase" de FaseDetalle.jsx -- reusa calcularAnalisis
 * (utils/analisis.js) scopeado a compras/gastos de esta fase, con `proyecto`
 * completo (hace falta precio_acordado) y `cobros: []` (una fase no tiene
 * cobros propios). No renderiza la cascada de rentabilidad ni el resto de
 * secciones a nivel proyecto -- ver docs/redesign/11_fase_detalle_tabs.md.
 */
export function AnalisisFase({
  proyecto,
  gastosFase,
  comprasFase,
  productos,
  proveedores,
  cobrosProyecto,
  kpisFase,
}) {
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
      }),
    [proyecto, gastosFase, comprasFase, productos, proveedores]
  );

  const { gastosPorCategoria, comprasPorTipoYProducto, topProveedores, totales } = analisis;

  // % cobrado del proyecto -- mismo cálculo que totales.pctCobrado de
  // AnalisisGeneral.jsx, pero sobre los cobros del proyecto entero (una fase
  // no tiene cobros propios), no sobre `cobros: []` de este análisis.
  const precioAcordado = Number(proyecto?.precio_acordado ?? 0);
  const totalCobradoProyecto = cobrosProyecto.reduce(
    (acc, c) => acc + (c.monto_neto ?? c.monto ?? 0),
    0
  );
  const pctCobradoProyecto = precioAcordado > 0 ? (totalCobradoProyecto / precioAcordado) * 100 : 0;

  return (
    <div className="analisis">
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
              <strong>{formatMoneda(tipo.monto)}</strong>
            </span>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <Treemap
            data={comprasPorTipoYProducto}
            dataKey="monto"
            nameKey="name"
            isAnimationActive={false}
            content={<ContenidoTreemap />}
          >
            <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.monto ?? d.value} />} />
          </Treemap>
        </ResponsiveContainer>
      </Seccion>

      <Seccion
        titulo="Gastos por categoría"
        descripcion={`Total de gastos: ${formatMoneda(totales.gastos)}`}
        vacio={gastosPorCategoria.length === 0}
        mensajeVacio="No hay gastos cargados."
      >
        <Torta datos={gastosPorCategoria} colores={COLORES_TORTA} />
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
              <span className="analisis-ranking-monto">{formatMoneda(proveedor.monto)}</span>
            </li>
          ))}
        </ul>
      </Seccion>

      {kpisFase.cantidadNotasFase > 0 && (
        <div className="analisis-kpis--notas">
          <TarjetaKpi
            titulo="Notas de crédito (fase)"
            valor={formatMoneda(kpisFase.notasCreditoFase)}
            detalle="A favor nuestro, ya restado del gastado en esta fase"
            color={ROJO}
            destacado
            plano
          />
          <TarjetaKpi
            titulo="Notas de débito (fase)"
            valor={formatMoneda(kpisFase.notasDebitoFase)}
            detalle="En contra nuestro, ya sumado al gastado en esta fase"
            color={NARANJA}
            destacado
            plano
          />
        </div>
      )}

      <Seccion
        titulo="Cobrado del proyecto"
        descripcion="Cuánto lleva cobrado el proyecto en total, sobre el mismo presupuesto acordado que ves arriba."
      >
        <TarjetaKpi
          valor={`${pctCobradoProyecto.toFixed(1)}%`}
          porcentaje={pctCobradoProyecto}
          detalle={`${formatMoneda(totalCobradoProyecto)} cobrados en todo el proyecto`}
        />
      </Seccion>
    </div>
  );
}

export default AnalisisFase;
