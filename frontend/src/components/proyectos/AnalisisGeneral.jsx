import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";

import { descargarReportePdfProyecto } from "../../services/proyectoService";
import {
  useProyecto,
  useFasesPorProyecto,
  useGastosPorProyecto,
  useCobrosPorProyecto,
  useComprasPorProyecto,
  useProductos,
  useProveedores,
  useCotizacionActual,
} from "../../hooks/queries";
import { useMonedaAnalisis } from "../../hooks/useMonedaAnalisis";
import { SelectorMoneda } from "../shared/SelectorMoneda";

import { TarjetaKpi } from "../shared/TarjetaKpi";
import { Cargando } from "../shared/Cargando";
import { EstadoVacio } from "../shared/EstadoVacio";
import { EstadoError } from "../shared/EstadoError";
import { calcularAnalisis } from "../../utils/analisis";
import {
  formatCotizacion,
  formatFecha,
  formatMoneda,
  formatMonedaCorta,
  formatNumero,
} from "../../utils/formato";
import { useToast } from "../../context/useToast";
import useAuth from "../../context/useAuth";
import { Seccion, TooltipMoneda, ContenidoTreemap, Torta, COLORES_TORTA } from "./AnalisisGraficos";
import { OLIVA, ERROR, GRIS_CLARO, ATENCION, LINEA } from "../../constants/colores";
import "./AnalisisGeneral.css";

// Variante 4d: lo que suma en oliva, lo que resta en gris claro, los
// subtotales en negro (DESIGN.md §2). Antes eran verde / naranja / gris y el
// naranja de "salida" se confundía con el ámbar de "requiere atención".
// "Notas (compras)" y el total pueden ir para cualquier lado según el signo
// (una devolución de producto sube el margen, una reposición lo baja); una
// ganancia neta negativa es una pérdida y va en óxido.
function claseDePaso(paso) {
  if (paso.tipo === "subtotal") return "subtotal";
  if (paso.tipo === "total") return paso.valor < 0 ? "perdida" : "neto";
  if (paso.tipo === "entrada") return "suma";
  if (paso.tipo === "ajuste") return paso.valor > 0 ? "suma" : "resta";
  return "resta";
}

/**
 * Escala y ticks del eje de la cascada. Hace falta calcularlos a mano: las
 * barras son de rango ([desde, hasta]) y recharts no toma esos extremos para
 * armar el dominio, así que un proyecto en rojo dibujaba barras que se salían
 * del gráfico.
 */
function escalaCascada(pasos) {
  const valores = pasos.flatMap((paso) => paso.rango);
  const minimo = Math.min(0, ...valores);
  const maximo = Math.max(0, ...valores);

  const aproximado = (maximo - minimo) / 4 || 1;
  const magnitud = 10 ** Math.floor(Math.log10(aproximado));
  const paso =
    [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((v) => v >= aproximado) ?? magnitud * 10;

  const desde = Math.floor(minimo / paso) * paso;
  const hasta = Math.ceil(maximo / paso) * paso;

  const ticks = [];
  for (let valor = desde; valor <= hasta + paso / 2; valor += paso) {
    ticks.push(Math.round(valor));
  }
  return { dominio: [desde, hasta], ticks };
}

/**
 * La cascada de rentabilidad en barras horizontales (4d): una fila por paso,
 * con el valor escrito al lado de la barra — no se depende del tooltip para
 * leer el número. Es HTML y no recharts: son siete barras de rango sobre una
 * escala fija, y así el texto usa la tipografía de la app.
 */
function Cascada({ pasos, moneda }) {
  const { dominio, ticks } = escalaCascada(pasos);
  const [desde, hasta] = dominio;
  const pos = (valor) => ((valor - desde) / (hasta - desde || 1)) * 100;
  // Redondeado antes de mirar el signo: un -0,3 se escribe "US$ 0", no "−US$ 0".
  const conSigno = (valor) => {
    const redondeado = Math.round(valor);
    return redondeado < 0
      ? `−${formatMoneda(-redondeado, moneda)}`
      : formatMoneda(Math.abs(redondeado), moneda);
  };

  return (
    <div className="cascada" style={{ "--cascada-divisiones": ticks.length - 1 }}>
      {pasos.map((paso) => {
        const [a, b] = paso.rango;
        const clase = claseDePaso(paso);
        return (
          <div key={paso.nombre} className={`cascada__fila cascada__fila--${clase}`}>
            <span className="cascada__label">{paso.nombre}</span>
            <div className="cascada__pista">
              <span
                className="cascada__barra"
                style={{
                  left: `${pos(Math.min(a, b))}%`,
                  width: `${pos(Math.max(a, b)) - pos(Math.min(a, b))}%`,
                }}
              />
            </div>
            <span className="cascada__valor">{conSigno(paso.valor)}</span>
          </div>
        );
      })}
      <div className="cascada__fila cascada__fila--eje" aria-hidden="true">
        <span />
        <div className="cascada__eje">
          {ticks.map((tick) => (
            <span key={tick} style={{ left: `${pos(tick)}%` }}>
              {formatMonedaCorta(tick, moneda)}
            </span>
          ))}
        </div>
        <span />
      </div>
    </div>
  );
}

export function AnalisisGeneral({ proyectoId }) {
  const toast = useToast();
  const { usuario } = useAuth();
  const esAdmin = usuario?.rol === "admin";
  const [descargandoReporte, setDescargandoReporte] = useState(false);

  const proyectoQuery = useProyecto(proyectoId);
  const fasesQuery = useFasesPorProyecto(proyectoId);
  const gastosQuery = useGastosPorProyecto(proyectoId);
  const cobrosQuery = useCobrosPorProyecto(proyectoId);
  const comprasQuery = useComprasPorProyecto(proyectoId);
  const productosQuery = useProductos();
  const proveedoresQuery = useProveedores();
  const [moneda] = useMonedaAnalisis();
  const cotizacionActual = useCotizacionActual(proyectoQuery.data);

  const cargando =
    proyectoQuery.isLoading ||
    fasesQuery.isLoading ||
    gastosQuery.isLoading ||
    cobrosQuery.isLoading ||
    comprasQuery.isLoading ||
    productosQuery.isLoading ||
    proveedoresQuery.isLoading;

  const datos = useMemo(
    () =>
      cargando
        ? null
        : {
            proyecto: proyectoQuery.data,
            fases: fasesQuery.data,
            gastos: gastosQuery.data,
            cobros: cobrosQuery.data,
            compras: comprasQuery.data,
            productos: productosQuery.data,
            proveedores: proveedoresQuery.data,
          },
    [
      cargando,
      proyectoQuery.data,
      fasesQuery.data,
      gastosQuery.data,
      cobrosQuery.data,
      comprasQuery.data,
      productosQuery.data,
      proveedoresQuery.data,
    ]
  );

  const analisis = useMemo(
    () => (datos ? calcularAnalisis({ ...datos, moneda, cotizacionActual }) : null),
    [datos, moneda, cotizacionActual]
  );
  // Atajos para no repetir la moneda en cada cifra de la pantalla.
  const fm = (monto) => formatMoneda(monto, moneda);
  const fmCorta = (monto) => formatMonedaCorta(monto, moneda);

  const handleDescargarReporte = async () => {
    try {
      setDescargandoReporte(true);
      const blob = await descargarReportePdfProyecto(proyectoId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (error) {
      console.error("Error descargando el reporte PDF:", error);
      toast.error("No se pudo generar el reporte PDF.");
    } finally {
      setDescargandoReporte(false);
    }
  };

  if (cargando) return <Cargando texto="Cargando análisis..." />;
  if (!analisis)
    return <EstadoError mensaje="No se pudo cargar el análisis del proyecto." grande />;

  const {
    totales,
    cascada,
    gastosPorCategoria,
    impuestosPorTipo,
    comprasPorTipoYProducto,
    pagosPorTipoFactura,
    avanceFases,
    egresosPorFase,
    cobradoPorFase,
    gastosSinComprobante,
    topProveedores,
    notas,
  } = analisis;

  const totalFases = avanceFases.reduce((acc, f) => acc + f.cantidad, 0);
  // En pesos el precio acordado no tiene cifra congelada: sale de la última
  // cotización (decisión #8). Sin ninguna cargada no hay número que mostrar.
  const precioTexto =
    totales.precioAcordado == null
      ? "un precio sin cotización cargada"
      : fm(totales.precioAcordado);
  const notaPrecioEnPesos =
    moneda === "ars"
      ? cotizacionActual
        ? `Precio acordado en pesos con el dólar ${cotizacionActual.tipo} de ${formatCotizacion(
            cotizacionActual.valor
          )} (${formatFecha(cotizacionActual.fecha)}). Cobros, gastos y compras en pesos de cuando se cargaron.`
        : "No hay cotizaciones cargadas: el precio acordado no se puede pasar a pesos."
      : null;
  const pctGanancia = totales.cobrado > 0 ? (totales.disponible / totales.cobrado) * 100 : null;
  const faltaCobrar =
    totales.precioAcordado == null ? null : Math.max(totales.precioAcordado - totales.cobrado, 0);
  const sinMovimientos = totales.cobrado === 0 && totales.egresos === 0;

  // "Disponible" siempre va primero y en oliva (lo que queda a favor) -- el
  // resto de las porciones son las fases, con la rampa sin repetir el oliva
  // para no confundirlas con la porción de disponible.
  const coloresFasesSinOliva = COLORES_TORTA.filter((c) => c !== OLIVA);
  const coloresCobradoPorFase =
    cobradoPorFase[0]?.nombre === "Disponible"
      ? [OLIVA, ...coloresFasesSinOliva]
      : coloresFasesSinOliva;

  return (
    <div className="analisis">
      {/* Variante 4d: el resultado primero, y al lado de dónde sale. */}
      <div className="analisis-resultado">
        <div className="analisis-resumen">
          <div className="analisis-ganancia">
            <span className="analisis-ganancia__label">Ganancia neta</span>
            <span
              className={`analisis-ganancia__monto${totales.disponible < 0 ? " analisis-ganancia__monto--perdida" : ""}`}
            >
              {fm(totales.disponible)}
            </span>
            <span className="analisis-ganancia__detalle">
              {pctGanancia == null
                ? "Todavía no hay cobros"
                : `${formatNumero(pctGanancia, 1)}% de lo cobrado`}
            </span>
          </div>

          <dl className="analisis-datos">
            <div>
              <dt>Acordado</dt>
              <dd>
                {totales.precioAcordado == null ? "Sin cotización" : fm(totales.precioAcordado)}
              </dd>
            </div>
            <div>
              <dt>Cobrado</dt>
              <dd title={`${fm(totales.cobrado)} de ${precioTexto}`}>
                {formatNumero(totales.pctCobrado, 1)}%
              </dd>
            </div>
            <div>
              <dt>Gastado</dt>
              <dd
                className={totales.pctGastado > 100 ? "analisis-datos--excedido" : undefined}
                title={`${fm(totales.egresos)} en gastos y compras`}
              >
                {formatNumero(totales.pctGastado, 1)}%
              </dd>
            </div>
            <div>
              <dt>Falta cobrar</dt>
              <dd>{faltaCobrar == null ? "—" : fm(faltaCobrar)}</dd>
            </div>
          </dl>

          {notaPrecioEnPesos && <p className="analisis-nota-moneda">{notaPrecioEnPesos}</p>}

          <div className="analisis-controles">
            <SelectorMoneda />
            {esAdmin && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDescargarReporte}
                disabled={descargandoReporte}
              >
                <Download size={15} strokeWidth={2} aria-hidden="true" />
                {descargandoReporte ? "Generando..." : "Reporte PDF"}
              </button>
            )}
          </div>
        </div>

        <section className="analisis-rentabilidad" aria-labelledby="analisis-rentabilidad-titulo">
          <h3 id="analisis-rentabilidad-titulo" className="analisis-rentabilidad__titulo">
            Rentabilidad
          </h3>
          {sinMovimientos ? (
            <EstadoVacio mensaje="Todavía no hay cobros ni egresos cargados." />
          ) : (
            <Cascada pasos={cascada} moneda={moneda} />
          )}
        </section>
      </div>

      <div className="analisis-fila">
        <Seccion
          titulo="Gastos por categoría"
          descripcion={`Total de gastos: ${fm(totales.gastos)}`}
          vacio={gastosPorCategoria.length === 0}
          mensajeVacio="No hay gastos cargados."
        >
          <Torta datos={gastosPorCategoria} colores={COLORES_TORTA} moneda={moneda} />
        </Seccion>

        <Seccion
          titulo="Impuestos por tipo"
          vacio={impuestosPorTipo.length === 0}
          mensajeVacio="No hay impuestos cargados en las compras."
        >
          <TarjetaKpi titulo="Total de impuestos" valor={fm(totales.impuestos)} plano />
          <Torta datos={impuestosPorTipo} colores={COLORES_TORTA} moneda={moneda} />
        </Seccion>
      </div>

      <Seccion
        titulo="Compras por tipo de producto"
        descripcion="Cada bloque es un tipo (equipo, materiales, mano de obra) abierto por producto. Se calcula sobre el detalle de las compras."
        vacio={comprasPorTipoYProducto.length === 0}
        mensajeVacio="Las compras del proyecto no tienen detalle de productos cargado."
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
            {/* el treemap arma su propio payload, ahí el monto viaja como `value` */}
            <Tooltip
              content={<TooltipMoneda obtenerValor={(d) => d.monto ?? d.value} moneda={moneda} />}
            />
          </Treemap>
        </ResponsiveContainer>
      </Seccion>

      <Seccion
        titulo="Cobrado vs. gastado por fase"
        descripcion={`De ${fm(totales.cobrado)} cobrados: cuánto sigue disponible, lo comprado en cada fase y los gastos.`}
        vacio={totales.cobrado === 0}
        mensajeVacio="Todavía no hay cobros cargados para este proyecto."
      >
        <Torta datos={cobradoPorFase} colores={coloresCobradoPorFase} moneda={moneda} />
      </Seccion>

      <Seccion
        titulo="Pagos por tipo de factura"
        descripcion="Gastos y compras del proyecto agrupados por comprobante fiscal."
        vacio={pagosPorTipoFactura.length === 0}
        mensajeVacio="No hay pagos cargados."
      >
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={pagosPorTipoFactura} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={LINEA} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={fmCorta} tick={{ fontSize: 12 }} width={80} />
            <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.monto} moneda={moneda} />} />
            <Bar
              dataKey="monto"
              fill={GRIS_CLARO}
              isAnimationActive={false}
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        <table className="analisis-tabla">
          <thead>
            <tr>
              <th>Tipo de factura</th>
              <th>Pagos</th>
              <th>Monto</th>
            </tr>
          </thead>
          <tbody>
            {pagosPorTipoFactura.map((fila) => (
              <tr key={fila.tipo}>
                <td>{fila.label}</td>
                <td>{fila.cantidad}</td>
                <td>{fm(fila.monto)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      <Seccion
        titulo="Avance de obra"
        vacio={totalFases === 0}
        mensajeVacio="El proyecto todavía no tiene fases cargadas."
      >
        <div className="analisis-avance-barra">
          {avanceFases.map((seccion) => (
            <div
              key={seccion.estado}
              className="analisis-avance-segmento"
              style={{
                width: `${(seccion.cantidad / totalFases) * 100}%`,
                backgroundColor: seccion.color,
              }}
              title={`${seccion.label}: ${seccion.cantidad}`}
            />
          ))}
        </div>
        <ul className="analisis-leyenda analisis-leyenda--horizontal">
          {avanceFases.map((seccion) => (
            <li key={seccion.estado} className="analisis-leyenda-item">
              <span className="analisis-leyenda-punto" style={{ backgroundColor: seccion.color }} />
              <span className="analisis-leyenda-nombre">{seccion.label}</span>
              <span className="analisis-leyenda-pct">{seccion.cantidad}</span>
            </li>
          ))}
        </ul>

        <h4 className="analisis-subtitulo">Egresos por fase</h4>
        {egresosPorFase.length === 0 ? (
          <EstadoVacio mensaje="Todavía no hay gastos ni compras imputados a una fase." />
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(egresosPorFase.length * 52, 140)}>
            <BarChart
              data={egresosPorFase}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={LINEA} />
              <XAxis type="number" tickFormatter={fmCorta} tick={{ fontSize: 12 }} />
              <YAxis
                type="category"
                dataKey="nombre"
                width={180}
                tick={{ fontSize: 12 }}
                interval={0}
              />
              <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.total} moneda={moneda} />} />
              <Bar
                dataKey="total"
                fill={GRIS_CLARO}
                isAnimationActive={false}
                radius={[0, 4, 4, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Seccion>

      <div className="analisis-fila">
        <Seccion titulo="Gastos sin comprobante">
          <TarjetaKpi
            valor={gastosSinComprobante.cantidad}
            detalle={`${fm(gastosSinComprobante.monto)} sin respaldo cargado`}
            plano
          />
        </Seccion>

        <Seccion
          titulo="Top proveedores"
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
      </div>

      <Seccion
        titulo="Notas de crédito / débito"
        descripcion="Ajustes de cuenta corriente con proveedores (compras) y con el proyecto (cobros). Crédito resta, débito suma."
        vacio={
          notas.compras.credito === 0 &&
          notas.compras.debito === 0 &&
          notas.cobros.credito === 0 &&
          notas.cobros.debito === 0
        }
        mensajeVacio="Todavía no hay notas de crédito ni débito cargadas."
      >
        <div className="analisis-kpis--notas">
          <TarjetaKpi
            titulo="Notas de crédito (compras)"
            valor={fm(notas.compras.credito)}
            detalle="A favor nuestro, resta a lo que le debemos al proveedor"
            color={ERROR}
            destacado
            plano
          />
          <TarjetaKpi
            titulo="Notas de débito (compras)"
            valor={fm(notas.compras.debito)}
            detalle="En contra nuestro, suma a lo que le debemos al proveedor"
            color={ATENCION}
            destacado
            plano
          />
          <TarjetaKpi
            titulo="Notas de crédito (cobros)"
            valor={fm(notas.cobros.credito)}
            detalle="Ajuste a favor del cliente, resta a lo cobrado"
            color={ERROR}
            destacado
            plano
          />
          <TarjetaKpi
            titulo="Notas de débito (cobros)"
            valor={fm(notas.cobros.debito)}
            detalle="Ajuste en contra del cliente, suma a lo cobrado"
            color={ATENCION}
            destacado
            plano
          />
        </div>
      </Seccion>
    </div>
  );
}

export default AnalisisGeneral;
