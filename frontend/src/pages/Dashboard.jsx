import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronRight, Clock, Paperclip, Truck, Wallet } from "lucide-react";
import {
  useProyectos,
  useFases,
  useGastos,
  useCobros,
  useCompras,
  useProveedores,
  useUltimaCotizacion,
} from "../hooks/queries";
import { useMonedaAnalisis } from "../hooks/useMonedaAnalisis";
import useAuth from "../context/useAuth";
import { SelectorMoneda } from "../components/shared/SelectorMoneda";
import { usePageTitle } from "../hooks/usePageTitle";

import { TarjetaKpi } from "../components/shared/TarjetaKpi";
import { calcularPanel } from "../utils/panel";
import { formatFecha, formatMoneda, formatMonedaCorta } from "../utils/formato";
import { getTipoMovimiento, signoTexto, TINTE_PASTILLA } from "../constants/tipoMovimiento";
import {
  OLIVA,
  ERROR,
  ERROR_TEXTO,
  ERROR_TINT,
  ATENCION_TINT,
  ATENCION_TEXTO,
  TINTA_TENUE,
  LINEA_SUAVE,
  GRIS_CLARO,
} from "../constants/colores";
import { EstadoVacio } from "../components/shared/EstadoVacio";
import { PageHeader } from "../components/shared/PageHeader";
import { EstadoError } from "../components/shared/EstadoError";
import "./Dashboard.css";

// Panel — variante 4i de HS General.dc.html ("Números
// + gráfico + dos listas"): lo primero que se ve al entrar es cuánta plata
// hay, qué falta cobrar, qué se debe y qué hay que resolver.

// Cada pendiente de "Para resolver": ícono del cuadradito y qué dice el badge.
const PENDIENTE = {
  pago: { icono: Wallet, etiqueta: (item) => `${item.dias} días` },
  envio: { icono: Truck, etiqueta: () => "Sin entregar" },
  comprobante: { icono: Paperclip, etiqueta: () => "Sin comprobante" },
  fase: { icono: Clock, etiqueta: (item) => `${item.dias} días en curso` },
};

const PAR_NIVEL = {
  problema: { backgroundColor: ERROR_TINT, color: ERROR_TEXTO },
  atencion: { backgroundColor: ATENCION_TINT, color: ATENCION_TEXTO },
};

// Reproduce la estructura real del panel (saludo, KPIs, gráfico, dos listas)
// con bloques placeholder, en vez de tapar todo con un spinner monolítico.
// calcularPanel necesita los 5 recursos juntos (los KPIs salen de cruzarlos
// entre sí), así que no hay una sección que pueda pintarse con datos reales
// antes que las demás. Es la excepción a propósito de DESIGN.md §16: el único
// lugar donde el layout es estable y conocido de antemano.
function DashboardSkeleton() {
  return (
    <div className="panel">
      <div className="skeleton skeleton--titulo" />

      <div className="panel-kpis">
        {[0, 1, 2].map((i) => (
          <div key={i} className="panel-kpi-skeleton">
            <div className="skeleton skeleton--kpi-label" />
            <div className="skeleton skeleton--kpi-valor" />
          </div>
        ))}
      </div>

      <div className="skeleton skeleton--grafico" />

      <div className="panel-listas">
        <div className="panel-columna">
          {[0, 1].map((i) => (
            <section key={i} className="panel-lista">
              <div className="skeleton skeleton--seccion-titulo" />
              {[0, 1, 2].map((j) => (
                <div key={j} className="skeleton skeleton--fila" />
              ))}
            </section>
          ))}
        </div>
        <section className="panel-lista">
          <div className="skeleton skeleton--seccion-titulo" />
          {[0, 1, 2, 3, 4, 5].map((j) => (
            <div key={j} className="skeleton skeleton--fila" />
          ))}
        </section>
      </div>
    </div>
  );
}

function ListaPanel({ titulo, link, className = "", children }) {
  return (
    <section className={`panel-lista ${className}`.trim()}>
      <div className="panel-lista__header">
        <h2 className="panel-lista__titulo">{titulo}</h2>
        {link}
      </div>
      {children}
    </section>
  );
}

function TooltipEvolucion({ active, payload, moneda }) {
  if (!active || !payload?.length) return null;
  const mes = payload[0].payload;
  return (
    <div className="panel-tooltip">
      <strong>{mes.etiquetaCompleta}</strong>
      <span>Cobrado {formatMoneda(mes.cobrado, moneda)}</span>
      <span>Compras y gastos {formatMoneda(mes.gastado, moneda)}</span>
    </div>
  );
}

// Cuántos movimientos recientes entran en el Panel.
const MOVIMIENTOS_EN_PANEL = 5;

const capitalizar = (texto = "") => texto.charAt(0).toUpperCase() + texto.slice(1);

export function Dashboard() {
  usePageTitle("Panel");
  const navigate = useNavigate();
  const { usuario } = useAuth() ?? {};

  // Los endpoints globales traen todo de una: el Panel agrupa por proyecto
  // en el front, así no hacen falta N requests por proyecto.
  const proyectosQuery = useProyectos();
  const fasesQuery = useFases();
  const gastosQuery = useGastos();
  const cobrosQuery = useCobros();
  const comprasQuery = useCompras();
  // Sólo para nombrar al proveedor en "Para resolver": si no llegó, la lista
  // sale igual sin ese dato.
  const proveedores = useProveedores()?.data;
  // Moneda del panel (la misma elección que los análisis) y la última
  // cotización, para el precio acordado en pesos (decisión #8 del plan).
  const [moneda] = useMonedaAnalisis();
  const cotizacionActual = useUltimaCotizacion().data ?? null;

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

  const panel = useMemo(
    () =>
      datos
        ? calcularPanel({ ...datos, moneda, cotizacionActual, proveedores: proveedores ?? [] })
        : null,
    [datos, moneda, cotizacionActual, proveedores]
  );
  const fm = (monto) => (monto == null ? "sin cotización" : formatMoneda(monto, moneda));

  if (cargando) return <DashboardSkeleton />;
  if (error || !panel)
    return <EstadoError mensaje="No se pudieron cargar los datos del panel." grande />;

  const { kpis, proyectosActivos, paraResolver, totalParaResolver, evolucion } = panel;
  // calcularPanel trae 8; en el Panel entran 5 (los últimos movimientos son
  // un vistazo, el listado completo está en cada proyecto).
  const ultimosMovimientos = panel.actividad.slice(0, MOVIMIENTOS_EN_PANEL);
  const totalProyectos = kpis.enCurso + kpis.terminados + kpis.aIniciar;
  const saludo = usuario?.nombre_usuario ? `Hola, ${capitalizar(usuario.nombre_usuario)}` : "Panel";
  const { deudaProveedores: deuda } = kpis;

  if (totalProyectos === 0) {
    return (
      <div className="panel">
        <PageHeader titulo={saludo} />
        <EstadoVacio
          mensaje="Todavía no hay proyectos cargados. Creá el primero desde la sección Proyectos."
          grande
        />
      </div>
    );
  }

  return (
    <div className="panel">
      <PageHeader titulo={saludo} acciones={<SelectorMoneda />} />

      <div className="panel-kpis">
        <TarjetaKpi
          titulo="Disponible en obras"
          valor={fm(kpis.disponibleTotal)}
          color={ERROR_TEXTO}
          destacado={kpis.disponibleTotal < 0}
        />
        <TarjetaKpi titulo="Falta cobrar" valor={fm(kpis.pendienteDeCobrar)} />
        <TarjetaKpi titulo="Deuda con proveedores" valor={formatMoneda(deuda.monto)} />
      </div>

      <section className="panel-grafico" aria-label="Cobrado y gastado, últimos 6 meses">
        <div className="panel-grafico__header">
          <h2 className="panel-lista__titulo">Últimos 6 meses</h2>
          <div className="panel-leyenda">
            <span className="panel-leyenda__item">
              <span className="panel-leyenda__cuadro" style={{ background: OLIVA }} />
              Cobros
            </span>
            <span className="panel-leyenda__item">
              <span className="panel-leyenda__cuadro" style={{ background: GRIS_CLARO }} />
              Compras y gastos
            </span>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={evolucion} margin={{ top: 8, right: 0, left: 0, bottom: 0 }} barGap={5}>
            <CartesianGrid vertical={false} stroke={LINEA_SUAVE} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={{ stroke: GRIS_CLARO }}
              tick={{ fontSize: 12, fill: TINTA_TENUE }}
            />
            <YAxis
              tickFormatter={(v) => formatMonedaCorta(v, moneda)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: TINTA_TENUE }}
              width={72}
            />
            <Tooltip
              content={<TooltipEvolucion moneda={moneda} />}
              cursor={{ fill: LINEA_SUAVE }}
            />
            <Bar
              dataKey="cobrado"
              name="Cobros"
              fill={OLIVA}
              barSize={22}
              isAnimationActive={false}
              radius={[3, 3, 0, 0]}
            />
            <Bar
              dataKey="gastado"
              name="Compras y gastos"
              fill={GRIS_CLARO}
              barSize={22}
              isAnimationActive={false}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </section>

      {/* Dos columnas que terminan juntas: a la izquierda los proyectos y
          abajo los últimos movimientos; a la derecha "Para resolver", que
          scrollea adentro de su caja en vez de estirar la página de un solo
          lado (antes la columna más larga dejaba el hueco blanco al lado). */}
      <div className="panel-listas">
        <div className="panel-columna">
          <ListaPanel
            titulo="Proyectos en curso"
            link={
              <Link to="/proyectos" className="panel-lista__link">
                Ver todos
                <ChevronRight size={14} strokeWidth={1.75} aria-hidden="true" />
              </Link>
            }
          >
            {proyectosActivos.length === 0 ? (
              <EstadoVacio mensaje="No hay proyectos en curso." />
            ) : (
              <ul className="panel-lista__items">
                {proyectosActivos.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className="panel-proyecto"
                      onClick={() => navigate(`/proyectos/${p.id}`)}
                    >
                      <span className="panel-proyecto__nombre">
                        <span
                          className="panel-proyecto__punto"
                          style={{ background: p.disponible >= 0 ? OLIVA : ERROR }}
                        />
                        {p.nombre}
                      </span>
                      <span
                        className="panel-proyecto__monto cifra"
                        style={p.disponible < 0 ? { color: ERROR_TEXTO } : undefined}
                      >
                        {fm(p.disponible)}
                      </span>
                      <span className="panel-proyecto__fase">
                        {p.faseActual?.texto ?? "Sin fases cargadas"}
                      </span>
                      <span className="panel-proyecto__rotulo">disponible</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ListaPanel>

          <ListaPanel titulo="Últimos movimientos">
            {ultimosMovimientos.length === 0 ? (
              <EstadoVacio mensaje="Todavía no hay movimientos cargados." />
            ) : (
              <ul className="panel-lista__items">
                {ultimosMovimientos.map((m) => {
                  const tipo = getTipoMovimiento(m.tipo);
                  const Icono = tipo.icono;
                  return (
                    <li key={`${m.tipo}-${m.id}`}>
                      <button
                        type="button"
                        className="panel-movimiento"
                        onClick={() =>
                          navigate(
                            `/proyectos/${m.proyectoId}?tab=acciones&foco=${m.foco ?? `${m.tipo}-${m.id}`}`
                          )
                        }
                      >
                        <span
                          className="panel-movimiento__icono"
                          style={{
                            color: tipo.color,
                            background: `${tipo.color}${TINTE_PASTILLA}`,
                          }}
                        >
                          {Icono && <Icono size={15} strokeWidth={1.75} aria-hidden="true" />}
                        </span>
                        <span className="panel-movimiento__titulo">
                          {m.descripcion || tipo.singular}
                        </span>
                        <span className="panel-movimiento__monto cifra">
                          {signoTexto(m.signo ?? tipo.signo)}
                          {formatMoneda(Math.abs(m.monto), moneda)}
                        </span>
                        <span className="panel-movimiento__contexto">{m.proyectoNombre}</span>
                        <span className="panel-movimiento__fecha">{formatFecha(m.fecha)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ListaPanel>
        </div>

        <ListaPanel
          titulo="Para resolver"
          className="panel-lista--scroll"
          link={
            totalParaResolver > paraResolver.length && (
              <span className="panel-lista__resto">
                y {totalParaResolver - paraResolver.length} más en Seguimiento
              </span>
            )
          }
        >
          {paraResolver.length === 0 ? (
            <EstadoVacio mensaje="Nada pendiente en los proyectos en curso." />
          ) : (
            <ul className="panel-lista__items">
              {paraResolver.map((item) => {
                const { icono: Icono, etiqueta } = PENDIENTE[item.tipo];
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className="panel-pendiente"
                      onClick={() =>
                        navigate(`/proyectos/${item.proyectoId}?tab=seguimiento&foco=${item.foco}`)
                      }
                    >
                      <span className="panel-pendiente__icono">
                        <Icono size={15} strokeWidth={1.75} aria-hidden="true" />
                      </span>
                      <span className="panel-pendiente__titulo">{item.titulo}</span>
                      <span className="badge badge--sm" style={PAR_NIVEL[item.nivel]}>
                        {etiqueta(item)}
                      </span>
                      <span className="panel-pendiente__contexto">
                        {[item.proveedor, item.proyectoNombre].filter(Boolean).join(" · ")}
                      </span>
                      <span className="panel-pendiente__monto cifra">
                        {item.monto != null ? formatMoneda(item.monto, item.moneda) : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ListaPanel>
      </div>
    </div>
  );
}

export default Dashboard;
