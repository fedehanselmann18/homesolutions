import { useMemo, useState } from "react";
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

import { TarjetaKpi } from "../components/shared/TarjetaKpi";
import { TablaProyectos } from "../components/proyectos/TablaProyectos";
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

// Filtro de estado de la tabla "Proyectos en curso" (dirección 1a) -- client
// side, sobre los datos que ya trajo el Panel (sin pedir nada nuevo al
// backend). "titulo"/"descripcion" cambian el encabezado de la sección para
// que no diga "Proyectos en curso" mientras se está mirando Terminados.
const FILTROS_PROYECTO = [
  {
    key: "en_curso",
    label: "En curso",
    titulo: "Proyectos en curso",
    vacio: "No hay proyectos en curso.",
  },
  {
    key: "a_iniciar",
    label: "A iniciar",
    titulo: "Proyectos a iniciar",
    vacio: "No hay proyectos a iniciar.",
  },
  {
    key: "terminado",
    label: "Terminados",
    titulo: "Proyectos terminados",
    vacio: "No hay proyectos terminados.",
  },
];

// Reproduce la estructura real del panel (header, KPIs, proyectos, gráfico)
// con bloques placeholder, en vez de tapar todo con un spinner monolítico.
// calcularPanel necesita los 5 recursos juntos (los KPIs salen de cruzarlos
// entre sí), así que aunque cada useQuery resuelve por separado, no hay una
// sección que pueda pintarse con datos reales antes que las demás -- el
// skeleton cubre esa espera combinada en vez de fingir progreso por KPI.
function DashboardSkeleton() {
  return (
    <div className="panel">
      <div className="panel-header">
        <div className="skeleton skeleton--titulo" />
        <div className="skeleton skeleton--subtitulo" />
      </div>

      <div className="panel-kpis">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="panel-kpi-skeleton">
            <div className="skeleton skeleton--kpi-label" />
            <div className="skeleton skeleton--kpi-valor" />
            <div className="skeleton skeleton--kpi-detalle" />
          </div>
        ))}
      </div>

      <section className="panel-seccion">
        <div className="skeleton skeleton--seccion-titulo" />
        <div className="panel-tabla">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton skeleton--proyecto-fila" />
          ))}
        </div>
      </section>

      <div className="panel-fila">
        <section className="panel-seccion">
          <div className="skeleton skeleton--seccion-titulo" />
          <div className="skeleton skeleton--grafico" />
        </section>
        <section className="panel-seccion">
          <div className="skeleton skeleton--seccion-titulo" />
          <div className="skeleton skeleton--actividad" />
        </section>
      </div>
    </div>
  );
}

// `accion` es opcional: contenido a la derecha del título (ver los filtros
// En curso/A iniciar/Terminados de "Proyectos en curso" más abajo). Sin
// `accion` se ve exactamente igual que antes.
function Seccion({ titulo, descripcion, accion, children }) {
  return (
    <section className="panel-seccion">
      <div className="panel-seccion-header">
        <div>
          <h2 className="panel-seccion-titulo">{titulo}</h2>
          {descripcion && <p className="panel-seccion-descripcion">{descripcion}</p>}
        </div>
        {accion}
      </div>
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

export function Dashboard() {
  const navigate = useNavigate();
  const [filtroEstado, setFiltroEstado] = useState("en_curso");

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

  if (cargando) return <DashboardSkeleton />;
  if (error || !panel)
    return <p className="panel-vacio">No se pudieron cargar los datos del panel.</p>;

  const { kpis, proyectosResumen, actividad, evolucion } = panel;
  const totalProyectos = kpis.enCurso + kpis.terminados + kpis.aIniciar;

  const filtro = FILTROS_PROYECTO.find((f) => f.key === filtroEstado);
  const contadorPorFiltro = { en_curso: kpis.enCurso, a_iniciar: kpis.aIniciar, terminado: kpis.terminados };
  const proyectosFiltrados = proyectosResumen.filter((p) => p.estado === filtroEstado);

  // Detalle del KPI "Requiere acción": junta los 3 subtotales que vengan en
  // > 0, en vez de mostrar siempre los 3 (la mayoría de los meses alguno da
  // cero). Ver kpis.comprasImpagasEnCurso/comprasSinEntregarEnCurso/
  // fasesEstancadasEnCurso en utils/panel.js.
  const detalleAccion = [
    kpis.comprasImpagasEnCurso > 0 &&
      `${kpis.comprasImpagasEnCurso} ${kpis.comprasImpagasEnCurso === 1 ? "compra" : "compras"} sin pagar`,
    kpis.comprasSinEntregarEnCurso > 0 &&
      `${kpis.comprasSinEntregarEnCurso} ${kpis.comprasSinEntregarEnCurso === 1 ? "envío" : "envíos"} sin entregar`,
    kpis.fasesEstancadasEnCurso > 0 &&
      `${kpis.fasesEstancadasEnCurso} ${kpis.fasesEstancadasEnCurso === 1 ? "fase parada" : "fases paradas"}`,
  ]
    .filter(Boolean)
    .join(" · ");

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
        {/* Envuelto en .panel-kpi-realce (dirección 1a): mismo TarjetaKpi de
            siempre, sólo se le agrega un fondo que ocupa toda la celda para
            destacarlo sin agrandar la tipografía (ver DESIGN.md/handoff). */}
        <div className="panel-kpi-realce">
          <TarjetaKpi
            titulo="Dinero disponible"
            valor={formatMoneda(kpis.disponibleTotal)}
            detalle="Cobros − gastos − compras (proyectos en curso)"
            color={kpis.disponibleTotal >= 0 ? VERDE : ROJO}
            destacado
          />
        </div>
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
        <TarjetaKpi
          titulo="Requiere acción"
          valor={kpis.requiereAccion}
          detalle={kpis.requiereAccion === 0 ? "Todo al día" : detalleAccion}
          color={kpis.requiereAccion > 0 ? ROJO : VERDE}
          destacado
        />
      </div>

      <Seccion
        titulo={filtro.titulo}
        descripcion="Tocá una fila para ir al detalle del proyecto"
        accion={
          <div className="panel-filtro-estado" role="tablist" aria-label="Filtrar proyectos por estado">
            {FILTROS_PROYECTO.map((f) => (
              <button
                key={f.key}
                type="button"
                role="tab"
                aria-selected={f.key === filtroEstado}
                className={
                  f.key === filtroEstado
                    ? "panel-filtro-estado-btn panel-filtro-estado-btn--activo"
                    : "panel-filtro-estado-btn"
                }
                onClick={() => setFiltroEstado(f.key)}
              >
                {f.label} <span className="panel-filtro-estado-contador">{contadorPorFiltro[f.key]}</span>
              </button>
            ))}
          </div>
        }
      >
        {proyectosFiltrados.length === 0 ? (
          <p className="panel-vacio">{filtro.vacio}</p>
        ) : (
          <TablaProyectos
            proyectos={proyectosFiltrados}
            onFilaClick={(proyecto) => navigate(`/proyectos/${proyecto.id}`)}
          />
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
    </div>
  );
}

export default Dashboard;
