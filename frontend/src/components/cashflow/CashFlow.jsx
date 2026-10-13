import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { useMonedaAnalisis } from "../../hooks/useMonedaAnalisis";
import { calcularCashFlow } from "../../utils/cashflow";
import {
  formatFecha,
  formatMoneda,
  formatMonedaCorta,
  hoyISO,
  pluralizar,
} from "../../utils/formato";
import { ATENCION, LINEA } from "../../constants/colores";
import { SelectorMoneda } from "../shared/SelectorMoneda";
import { FiltrosSegmentados } from "../shared/FiltrosSegmentados";
import { TarjetaKpi } from "../shared/TarjetaKpi";
import { EstadoVacio } from "../shared/EstadoVacio";
import { Seccion, TooltipMoneda } from "../proyectos/AnalisisGraficos";

import "../proyectos/AnalisisGeneral.css";
import "./CashFlow.css";

const VISTAS = [
  { key: "mes", label: "Por mes" },
  { key: "semana", label: "Por semana" },
];
const VENCIMIENTOS_A_LA_VISTA = 15;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const nombreMes = (mes) => {
  const [a, m] = mes.split("-");
  return `${MESES[Number(m) - 1]} ${a.slice(2)}`;
};

/**
 * Cash flow (general o por obra): ingresos/egresos reales y vencimientos
 * (ver utils/cashflow.js). Un plazo sin pagar no computa como egreso.
 * KPIs arriba; vista por mes (real + proyección) o semana; lista de vencimientos.
 * `mostrarObra=false` oculta la columna Obra (pestaña de proyecto).
 */
export function CashFlow({
  compras = [],
  gastos = [],
  cobros = [],
  proyectos = [],
  proveedores = [],
  fases = [],
  mostrarObra = true,
}) {
  const [moneda] = useMonedaAnalisis();
  const [vista, setVista] = useState("mes");
  const hoy = hoyISO();

  const datos = useMemo(
    () => calcularCashFlow({ compras, gastos, cobros, proyectos, proveedores, fases, moneda, hoy }),
    [compras, gastos, cobros, proyectos, proveedores, fases, moneda, hoy]
  );
  const { kpis, porMes, porSemana, vencimientos } = datos;
  const fm = (monto) => formatMoneda(monto, moneda);

  return (
    <div className="cashflow">
      <div className="analisis-controles">
        <SelectorMoneda />
        <FiltrosSegmentados
          opciones={VISTAS}
          activa={vista}
          onCambiar={setVista}
          etiqueta="Vista del cash flow"
          variante="segmentado"
        />
      </div>

      <div className="analisis-kpis">
        <TarjetaKpi
          titulo="Saldo de caja hoy"
          valor={fm(kpis.saldoHoy)}
          detalle="Lo cobrado menos lo pagado de verdad"
          plano
        />
        <TarjetaKpi
          titulo="Vencido sin pagar"
          valor={fm(kpis.vencido)}
          detalle={
            kpis.cantidadVencidos
              ? pluralizar(kpis.cantidadVencidos, "plazo vencido", "plazos vencidos")
              : "Nada vencido"
          }
          detalleColor={kpis.cantidadVencidos ? "var(--color-error-texto)" : undefined}
          plano
        />
        <TarjetaKpi titulo="A pagar en 30 días" valor={fm(kpis.aPagar30)} plano />
        <TarjetaKpi
          titulo="Falta cobrar"
          valor={formatMoneda(kpis.faltaCobrarUsd, "usd")}
          detalle="Del precio acordado, en dólares"
          plano
        />
      </div>

      {vista === "mes" ? (
        <Seccion
          titulo="Evolución mensual"
          descripcion="Ingresos y egresos reales + proyección de vencimientos. Meses futuros: vencimientos a su fecha (vencidos al mes actual)."
        >
          <div className="cashflow__tabla-scroll">
            <table className="analisis-tabla cashflow__tabla">
              <thead>
                <tr>
                  <th>Mes</th>
                  <th>Ingreso</th>
                  <th>Egreso</th>
                  <th>A pagar</th>
                  <th>Saldo</th>
                </tr>
              </thead>
              <tbody>
                {porMes.map((m) => (
                  <tr
                    key={m.mes}
                    className={`${m.actual ? "cashflow__mes--actual" : ""}${
                      m.proyectado ? " cashflow__mes--proyectado" : ""
                    }`}
                  >
                    <td>
                      {nombreMes(m.mes)}
                      {m.actual && <span className="cashflow__marca"> · hoy</span>}
                    </td>
                    <td className="cifra">{m.ingreso ? fm(m.ingreso) : "—"}</td>
                    <td className="cifra">{m.egreso ? fm(m.egreso) : "—"}</td>
                    <td className="cifra">{m.aPagar ? fm(m.aPagar) : "—"}</td>
                    <td className={`cifra${m.saldo < 0 ? " cashflow__negativo" : ""}`}>
                      {fm(m.saldo)}
                      {m.proyectado && <span className="cashflow__marca"> (proy.)</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Seccion>
      ) : (
        <Seccion
          titulo="Próximas 8 semanas"
          descripcion="Lo que vence cada semana (de lunes a domingo). Lo vencido va aparte, arriba."
          vacio={porSemana.every((s) => s.aPagar === 0)}
          mensajeVacio="No vence nada en las próximas 8 semanas."
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart
              data={porSemana.map((s) => ({ ...s, name: formatFecha(s.desde).slice(0, 5) }))}
              margin={{ top: 10, right: 10, left: 10, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={LINEA} />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis
                tickFormatter={(v) => formatMonedaCorta(v, moneda)}
                tick={{ fontSize: 12 }}
                width={80}
              />
              <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.aPagar} moneda={moneda} />} />
              <Bar
                dataKey="aPagar"
                fill={ATENCION}
                isAnimationActive={false}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Seccion>
      )}

      <Seccion
        titulo="Vencimientos pendientes"
        descripcion="Plazos sin pagar, del más viejo al más nuevo. Se marcan pagados en la ficha de la compra o el gasto."
      >
        {vencimientos.length === 0 ? (
          <EstadoVacio mensaje="No hay nada pendiente de pago." />
        ) : (
          <ul className="cashflow__vencimientos">
            {vencimientos.slice(0, VENCIMIENTOS_A_LA_VISTA).map((v) => (
              <li
                key={v.id}
                className={`cashflow__vencimiento${v.vencido ? " cashflow__vencimiento--vencido" : ""}`}
              >
                <span className="cashflow__vencimiento-fecha">
                  {formatFecha(v.fecha).slice(0, 5)}
                  {v.vencido && (
                    <span className="cashflow__vencimiento-alerta">
                      Vencido hace {pluralizar(v.diasVencido, "día")}
                    </span>
                  )}
                </span>
                <span className="cashflow__vencimiento-texto">
                  <span className="cashflow__vencimiento-titulo">
                    {[v.quien, v.descripcion].filter(Boolean).join(" · ")}
                  </span>
                  <span className="cashflow__vencimiento-meta">
                    {[
                      mostrarObra && v.proyecto,
                      v.tipo === "compra" ? "Compra" : "Gasto",
                      v.condicion && `${v.condicion}${v.etiqueta ? ` (${v.etiqueta})` : ""}`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="cashflow__vencimiento-monto cifra">{fm(v.monto)}</span>
              </li>
            ))}
          </ul>
        )}
        {vencimientos.length > VENCIMIENTOS_A_LA_VISTA && (
          <p className="analisis-seccion-descripcion">
            Y {pluralizar(vencimientos.length - VENCIMIENTOS_A_LA_VISTA, "plazo más", "plazos más")}
            .
          </p>
        )}
      </Seccion>
    </div>
  );
}

export default CashFlow;
