import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useProyectos, useFases, useGastos, useCobros, useCompras } from "../hooks/queries";

import { TarjetaKpi, BarraProgreso } from "../components/shared/TarjetaKpi";
import { Cargando } from "../components/shared/Cargando";
import { calcularPanel } from "../utils/panel";
import { formatMoneda, formatMonedaCorta, formatFecha } from "../utils/formato";
import { VERDE, ROJO, NARANJA, AZUL } from "../constants/colores";
import "./Dashboard.css";

const TIPOS_MOVIMIENTO = {
  cobro: { label: "Cobro", color: VERDE, signo: "+" },
  gasto: { label: "Gasto", color: NARANJA, signo: "−" },
  compra: { label: "Compra", color: AZUL, signo: "−" },
  // Nota de crédito resta (a favor nuestro/del cliente), nota de débito suma.
  nota_credito: { label: "Nota de crédito", color: "#dc2626", signo: "−" },
  nota_debito: { label: "Nota de débito", color: NARANJA, signo: "+" },
};

function Seccion({ titulo, descripcion, children }) {
  return (
    <section className="panel-seccion">
      <h2 className="panel-seccion-titulo">{titulo}</h2>
      {descripcion && <p className="panel-seccion-descripcion">{descripcion}</p>}
      {children}
    </section>
  );
}

function TooltipEvolucion({ active, payload }) {
  if (!active || !payload?.length) return null;
  const mes = payload[0].payload;
  return (
    <div className="panel-tooltip">
      <strong>{mes.etiquetaCompleta}</strong>
      <span style={{ color: VERDE }}>Cobrado: {formatMoneda(mes.cobrado)}</span>
      <span style={{ color: NARANJA }}>Gastado: {formatMoneda(mes.gastado)}</span>
    </div>
  );
}

function TarjetaProyecto({ proyecto, onClick }) {
  const excedido = proyecto.pctPresupuesto > 100;

  return (
    <article
      className="panel-proyecto"
      style={{ borderLeftColor: proyecto.disponible >= 0 ? VERDE : ROJO }}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      role="button"
      tabIndex={0}
    >
      <div className="panel-proyecto-header">
        <h3 className="panel-proyecto-nombre">{proyecto.nombre}</h3>
        <span
          className="panel-proyecto-disponible"
          style={{ color: proyecto.disponible >= 0 ? VERDE : ROJO }}
        >
          {formatMoneda(proyecto.disponible)}
        </span>
      </div>
      <p className="panel-proyecto-direccion">{proyecto.direccion}</p>

      <div className="panel-proyecto-barra">
        <div className="panel-proyecto-barra-header">
          <span>Presupuesto</span>
          <span className={excedido ? "panel-proyecto-excedido" : ""}>
            {proyecto.pctPresupuesto.toFixed(0)}%
          </span>
        </div>
        <BarraProgreso porcentaje={proyecto.pctPresupuesto} color={excedido ? ROJO : NARANJA} />
        <span className="panel-proyecto-barra-detalle">
          {formatMoneda(proyecto.egresos)} de {formatMoneda(proyecto.precioAcordado)}
        </span>
      </div>

      <div className="panel-proyecto-barra">
        <div className="panel-proyecto-barra-header">
          <span>Fases terminadas</span>
          <span>
            {proyecto.fasesCerradas} de {proyecto.fasesTotales}
          </span>
        </div>
        <BarraProgreso porcentaje={proyecto.pctFases} color={VERDE} />
      </div>

      <div className="panel-proyecto-compras">
        {proyecto.comprasImpagas === 0 && proyecto.comprasSinEntregar === 0 ? (
          <span className="panel-proyecto-compras-ok">Sin compras pendientes</span>
        ) : (
          <>
            {proyecto.comprasImpagas > 0 && (
              <span
                className="panel-proyecto-chip"
                style={{ color: ROJO, backgroundColor: `${ROJO}14` }}
              >
                {proyecto.comprasImpagas}{" "}
                {proyecto.comprasImpagas === 1 ? "compra sin pagar" : "compras sin pagar"} ·{" "}
                {formatMoneda(proyecto.montoImpago)}
              </span>
            )}
            {proyecto.comprasSinEntregar > 0 && (
              <span
                className="panel-proyecto-chip"
                style={{ color: NARANJA, backgroundColor: `${NARANJA}14` }}
              >
                {proyecto.comprasSinEntregar}{" "}
                {proyecto.comprasSinEntregar === 1 ? "envío no entregado" : "envíos no entregados"}
              </span>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function Dashboard() {
  const navigate = useNavigate();

  // Los endpoints globales traen todo de una: el Panel agrupa por proyecto
  // en el front, así no hacen falta N requests por proyecto.
  const proyectosQuery = useProyectos();
  const fasesQuery = useFases();
  const gastosQuery = useGastos();
  const cobrosQuery = useCobros();
  const comprasQuery = useCompras();

  const cargando =
    proyectosQuery.isLoading ||
    fasesQuery.isLoading ||
    gastosQuery.isLoading ||
    cobrosQuery.isLoading ||
    comprasQuery.isLoading;
  const error =
    proyectosQuery.error ||
    fasesQuery.error ||
    gastosQuery.error ||
    cobrosQuery.error ||
    comprasQuery.error;

  const datos = useMemo(
    () =>
      cargando || error
        ? null
        : {
            proyectos: proyectosQuery.data,
            fases: fasesQuery.data,
            gastos: gastosQuery.data,
            cobros: cobrosQuery.data,
            compras: comprasQuery.data,
          },
    [
      cargando,
      error,
      proyectosQuery.data,
      fasesQuery.data,
      gastosQuery.data,
      cobrosQuery.data,
      comprasQuery.data,
    ]
  );

  const panel = useMemo(() => (datos ? calcularPanel(datos) : null), [datos]);

  if (cargando) return <Cargando texto="Cargando panel..." />;
  if (error || !panel)
    return <p className="panel-vacio">No se pudieron cargar los datos del panel.</p>;

  const { kpis, proyectosActivos, actividad, evolucion } = panel;
  const totalProyectos = kpis.enCurso + kpis.terminados + kpis.aIniciar;

  if (totalProyectos === 0) {
    return (
      <div className="panel">
        <h1 className="panel-titulo">Panel</h1>
        <p className="panel-vacio">
          Todavía no hay proyectos cargados. Creá el primero desde la sección Proyectos.
        </p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <h1 className="panel-titulo">Panel</h1>
        <p className="panel-subtitulo">
          {totalProyectos} {totalProyectos === 1 ? "proyecto" : "proyectos"} en total ·{" "}
          {formatMoneda(kpis.contratadoEnCurso)} contratados en curso
        </p>
      </div>

      <div className="panel-kpis">
        <TarjetaKpi
          titulo="Proyectos en curso"
          valor={kpis.enCurso}
          detalle={`${kpis.terminados} terminados · ${kpis.aIniciar} a iniciar`}
        />
        <TarjetaKpi
          titulo="Dinero disponible"
          valor={formatMoneda(kpis.disponibleTotal)}
          detalle="Cobros − gastos − compras (proyectos en curso)"
          color={kpis.disponibleTotal >= 0 ? VERDE : ROJO}
          destacado
        />
        <TarjetaKpi
          titulo="Cobrado este mes"
          valor={formatMoneda(kpis.cobradoMes)}
          detalle={`${formatMoneda(kpis.pendienteDeCobrar)} pendiente de cobrar`}
        />
        <TarjetaKpi
          titulo="Ganancia neta del mes"
          valor={formatMoneda(kpis.gananciaNetaMes)}
          detalle="Cobrado − gastos − compras − impuestos"
          color={kpis.gananciaNetaMes >= 0 ? VERDE : ROJO}
          destacado
        />
      </div>

      <Seccion
        titulo="Proyectos en curso"
        descripcion="Tocá una tarjeta para ir al detalle del proyecto"
      >
        {proyectosActivos.length === 0 ? (
          <p className="panel-vacio">No hay proyectos en curso.</p>
        ) : (
          <div className="panel-proyectos-grid">
            {proyectosActivos.map((proyecto) => (
              <TarjetaProyecto
                key={proyecto.id}
                proyecto={proyecto}
                onClick={() => navigate(`/proyectos/${proyecto.id}`)}
              />
            ))}
          </div>
        )}
      </Seccion>

      <div className="panel-fila">
        <Seccion titulo="Cobrado vs. gastado" descripcion="Últimos 6 meses, todos los proyectos">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={evolucion} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatMonedaCorta} tick={{ fontSize: 12 }} width={80} />
              <Tooltip content={<TooltipEvolucion />} cursor={{ fill: "#f4f4f5" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar
                dataKey="cobrado"
                name="Cobrado"
                fill={VERDE}
                isAnimationActive={false}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="gastado"
                name="Gastado"
                fill={NARANJA}
                isAnimationActive={false}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Seccion>

        <Seccion titulo="Actividad reciente" descripcion="Últimos movimientos cargados">
          {actividad.length === 0 ? (
            <p className="panel-vacio">Todavía no hay movimientos cargados.</p>
          ) : (
            <ul className="panel-actividad">
              {actividad.map((mov) => {
                const tipo = TIPOS_MOVIMIENTO[mov.tipo];
                return (
                  <li key={`${mov.tipo}-${mov.id}`} className="panel-actividad-item">
                    <span
                      className="panel-actividad-tipo"
                      style={{ color: tipo.color, backgroundColor: `${tipo.color}1c` }}
                    >
                      {tipo.label}
                    </span>
                    <span className="panel-actividad-texto">
                      <span className="panel-actividad-descripcion">{mov.descripcion}</span>
                      <span className="panel-actividad-detalle">
                        {mov.proyectoNombre} · {formatFecha(mov.fecha)}
                      </span>
                    </span>
                    <span className="panel-actividad-monto" style={{ color: tipo.color }}>
                      {tipo.signo} {formatMoneda(mov.monto)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Seccion>
      </div>

      <Seccion
        titulo="Notas de crédito / débito"
        descripcion="Ajustes de cuenta corriente de todos los proyectos en curso, con proveedores (compras) y con clientes (cobros)"
      >
        <div className="panel-kpis--notas">
          <TarjetaKpi
            titulo="Notas de crédito (compras)"
            valor={formatMoneda(kpis.notasCreditoCompras)}
            detalle="A favor nuestro"
            color={ROJO}
            destacado
            plano
          />
          <TarjetaKpi
            titulo="Notas de débito (compras)"
            valor={formatMoneda(kpis.notasDebitoCompras)}
            detalle="En contra nuestro"
            color={NARANJA}
            destacado
            plano
          />
          <TarjetaKpi
            titulo="Notas de crédito (cobros)"
            valor={formatMoneda(kpis.notasCreditoCobros)}
            detalle="A favor del cliente"
            color={ROJO}
            destacado
            plano
          />
          <TarjetaKpi
            titulo="Notas de débito (cobros)"
            valor={formatMoneda(kpis.notasDebitoCobros)}
            detalle="En contra del cliente"
            color={NARANJA}
            destacado
            plano
          />
        </div>
      </Seccion>
    </div>
  );
}

export default Dashboard;
