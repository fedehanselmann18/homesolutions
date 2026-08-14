import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CircleDollarSign, Truck, ClockAlert } from "lucide-react";
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
import {
  useProyectos,
  useFases,
  useGastos,
  useCobros,
  useCompras,
  useProductos,
  useProveedores,
} from "../hooks/queries";

import { TarjetaKpi, BarraProgreso } from "../components/shared/TarjetaKpi";
import { TarjetaAlerta } from "../components/shared/TarjetaAlerta";
import { calcularPanel } from "../utils/panel";
import { formatMoneda, formatMonedaCorta, formatFecha } from "../utils/formato";
import { VERDE, ROJO, NARANJA, AZUL } from "../constants/colores";
import "./Dashboard.css";

// Ícono + color por tipo de ítem de "Para resolver hoy" (dirección 1c,
// injertada en el Panel de 1a) -- mismos 3 criterios que kpis.requiereAccion.
const TIPOS_RESOLVER = {
  compra_impaga: { icono: CircleDollarSign, color: ROJO },
  compra_sin_entregar: { icono: Truck, color: NARANJA },
  fase_estancada: { icono: ClockAlert, color: AZUL },
};

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

// Color de cada segmento de la barra de fases (dirección 1a "Planilla" del
// rediseño): mismo criterio de "cerrada" que ESTADOS_FASE_CERRADA en
// utils/panel.js, más "en_curso" en naranja y el resto (por_empezar) en gris
// de línea.
function colorSegmentoFase(estado) {
  if (estado === "terminada" || estado === "auditada") return VERDE;
  if (estado === "en_curso") return NARANJA;
  return "#e4e4e7"; // --color-linea (hex plano: los segmentos van por style inline, no CSS var)
}

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

// Barra de segmentos de fases: un rectángulo por fase (dirección 1a) en vez
// de la barra de progreso continua de antes -- se ve de un vistazo cuál fase
// puntual está trabada, no sólo "cuántas" van.
function SegmentosFases({ fases }) {
  if (fases.length === 0) {
    return <span className="panel-tabla-fases-vacio">Sin fases</span>;
  }
  return (
    <div className="panel-fases-segmentos">
      {fases.map((fase) => (
        <span
          key={fase.id}
          className="panel-fases-segmento"
          style={{ backgroundColor: colorSegmentoFase(fase.estado) }}
        />
      ))}
    </div>
  );
}

// Fila de la tabla de "Proyectos en curso" (reemplaza la tarjeta de antes):
// mismos datos, pero como planilla real -- ver claudedesign/, dirección 1a.
function FilaProyecto({ proyecto, onClick }) {
  const excedido = proyecto.pctPresupuesto > 100;
  const positivo = proyecto.disponible >= 0;

  return (
    <div
      className="panel-tabla-fila"
      style={{
        borderLeftColor: positivo ? VERDE : ROJO,
        "--fila-hover": positivo
          ? "var(--color-terracota-tint-fila)"
          : "var(--color-oxido-tint-fila)",
      }}
      onClick={onClick}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
      role="button"
      tabIndex={0}
    >
      <div className="panel-tabla-col panel-tabla-col--proyecto">
        <span className="panel-tabla-nombre">{proyecto.nombre}</span>
        <span className="panel-tabla-direccion">{proyecto.direccion}</span>
      </div>

      <div className="panel-tabla-col panel-tabla-col--disponible">
        <span style={{ color: positivo ? VERDE : ROJO }}>{formatMoneda(proyecto.disponible)}</span>
      </div>

      <div className="panel-tabla-col panel-tabla-col--presupuesto">
        <div className="panel-tabla-presupuesto-header">
          <span className={excedido ? "panel-proyecto-excedido" : ""}>
            {proyecto.pctPresupuesto.toFixed(0)}%
          </span>
        </div>
        <BarraProgreso porcentaje={proyecto.pctPresupuesto} color={excedido ? ROJO : NARANJA} />
        <span className="panel-tabla-presupuesto-detalle">
          {formatMonedaCorta(proyecto.egresos)} / {formatMonedaCorta(proyecto.precioAcordado)}
        </span>
      </div>

      <div className="panel-tabla-col panel-tabla-col--fases">
        <SegmentosFases fases={proyecto.fasesResumen} />
        <span className="panel-tabla-fases-contador">
          {proyecto.fasesCerradas}/{proyecto.fasesTotales}
        </span>
      </div>

      <div className="panel-tabla-col panel-tabla-col--pendientes">
        {proyecto.comprasImpagas === 0 && proyecto.comprasSinEntregar === 0 ? (
          <span className="panel-proyecto-compras-ok">Sin pendientes</span>
        ) : (
          <>
            {proyecto.comprasImpagas > 0 && (
              <span
                className="panel-proyecto-chip"
                style={{ color: ROJO, backgroundColor: `${ROJO}14` }}
              >
                {proyecto.comprasImpagas} {proyecto.comprasImpagas === 1 ? "sin pagar" : "sin pagar"}
              </span>
            )}
            {proyecto.comprasSinEntregar > 0 && (
              <span
                className="panel-proyecto-chip"
                style={{ color: NARANJA, backgroundColor: `${NARANJA}14` }}
              >
                {proyecto.comprasSinEntregar}{" "}
                {proyecto.comprasSinEntregar === 1 ? "envío" : "envíos"}
              </span>
            )}
          </>
        )}
      </div>

      <div className="panel-tabla-col panel-tabla-col--accion">
        <ChevronRight size={18} strokeWidth={2} className="panel-tabla-chevron" aria-hidden="true" />
      </div>
    </div>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const [filtroEstado, setFiltroEstado] = useState("en_curso");

  // Los endpoints globales traen todo de una: el Panel agrupa por proyecto
  // en el front, así no hacen falta N requests por proyecto. productos/
  // proveedores se suman para poder describir los ítems de "Para resolver
  // hoy" (nombre de producto + proveedor de cada compra impaga/sin
  // entregar) -- son catálogos livianos, ya los pide el resto de la app.
  const proyectosQuery = useProyectos();
  const fasesQuery = useFases();
  const gastosQuery = useGastos();
  const cobrosQuery = useCobros();
  const comprasQuery = useCompras();
  const productosQuery = useProductos();
  const proveedoresQuery = useProveedores();

  const cargando =
    proyectosQuery.isLoading ||
    fasesQuery.isLoading ||
    gastosQuery.isLoading ||
    cobrosQuery.isLoading ||
    comprasQuery.isLoading ||
    productosQuery.isLoading ||
    proveedoresQuery.isLoading;
  const error =
    proyectosQuery.error ||
    fasesQuery.error ||
    gastosQuery.error ||
    cobrosQuery.error ||
    comprasQuery.error ||
    productosQuery.error ||
    proveedoresQuery.error;

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
            productos: productosQuery.data,
            proveedores: proveedoresQuery.data,
          },
    [
      cargando,
      error,
      proyectosQuery.data,
      fasesQuery.data,
      gastosQuery.data,
      cobrosQuery.data,
      comprasQuery.data,
      productosQuery.data,
      proveedoresQuery.data,
    ]
  );

  const panel = useMemo(() => (datos ? calcularPanel(datos) : null), [datos]);

  if (cargando) return <DashboardSkeleton />;
  if (error || !panel)
    return <p className="panel-vacio">No se pudieron cargar los datos del panel.</p>;

  const { kpis, proyectosResumen, paraResolverHoy, actividad, evolucion } = panel;
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

      {paraResolverHoy.length > 0 && (
        <Seccion
          titulo="Para resolver hoy"
          descripcion="Compras sin pagar, envíos pendientes y fases sin movimiento, de todos los proyectos en curso"
        >
          <div className="panel-resolver-lista">
            {paraResolverHoy.map((item) => {
              const tipo = TIPOS_RESOLVER[item.tipo];
              return (
                <TarjetaAlerta
                  key={item.id}
                  icono={tipo.icono}
                  color={tipo.color}
                  titulo={item.titulo}
                  detalle={`${item.proyectoNombre} · ${item.detalle}`}
                  monto={item.monto ? formatMoneda(item.monto) : undefined}
                  extra={`hace ${item.dias} ${item.dias === 1 ? "día" : "días"}`}
                  onClick={() => navigate(`/proyectos/${item.proyectoId}`)}
                />
              );
            })}
          </div>
        </Seccion>
      )}

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
          <div className="panel-tabla">
            <div className="panel-tabla-header">
              <span className="label-ficha">Proyecto</span>
              <span className="label-ficha">Disponible</span>
              <span className="label-ficha">Presupuesto ejecutado</span>
              <span className="label-ficha">Fases</span>
              <span className="label-ficha">Pendientes</span>
              <span />
            </div>
            {proyectosFiltrados.map((proyecto) => (
              <FilaProyecto
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
