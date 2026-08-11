import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, Treemap, XAxis, YAxis } from "recharts";

import { getProyectoPorId, descargarReportePdfProyecto } from "../../services/proyectoService";
import { getFasesPorProyecto } from "../../services/faseService";
import { getGastosPorProyecto } from "../../services/gastoService";
import { getCobrosPorProyecto } from "../../services/cobroService";
import { getComprasPorProyecto } from "../../services/compraService";
import { getProductos } from "../../services/productoService";
import { getProveedores } from "../../services/proveedorService";

import { TarjetaKpi } from "../shared/TarjetaKpi";
import { Cargando } from "../shared/Cargando";
import { calcularAnalisis } from "../../utils/analisis";
import { formatMoneda, formatMonedaCorta } from "../../utils/formato";
import { useToast } from "../../context/useToast";
import useAuth from "../../context/useAuth";
import { Seccion, TooltipMoneda, ContenidoTreemap, Torta, COLORES_TORTA } from "./AnalisisGraficos";
import "./AnalisisGeneral.css";

const VERDE = "#16a34a";
const ROJO = "#dc2626";
const AZUL = "#64748b";
const NARANJA = "#d97706";

const COLOR_CASCADA = {
    entrada: VERDE,
    salida: NARANJA,
    subtotal: AZUL,
    total: VERDE,
    ajuste: NARANJA,
};

// El paso "Notas (compras)" y el paso "total" pueden ir para cualquier lado
// según el signo (una devolución de producto sube el margen, una reposición
// lo baja) -- a diferencia de "salida"/"entrada" que siempre son fijos.
function colorPasoCascada(paso) {
    if (paso.tipo === "total" || paso.tipo === "ajuste") {
        return paso.valor < 0 ? ROJO : VERDE;
    }
    return COLOR_CASCADA[paso.tipo];
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
    const paso = [1, 2, 2.5, 5, 10].map((m) => m * magnitud).find((v) => v >= aproximado) ?? magnitud * 10;

    const desde = Math.floor(minimo / paso) * paso;
    const hasta = Math.ceil(maximo / paso) * paso;

    const ticks = [];
    for (let valor = desde; valor <= hasta + paso / 2; valor += paso) {
        ticks.push(Math.round(valor));
    }
    return { dominio: [desde, hasta], ticks };
}

export function AnalisisGeneral({ proyectoId }) {
    const toast = useToast();
    const { usuario } = useAuth();
    const esAdmin = usuario?.rol === "admin";
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [descargandoReporte, setDescargandoReporte] = useState(false);

    useEffect(() => {
        const fetchDatos = async () => {
            try {
                setCargando(true);
                const [proyecto, fases, gastos, cobros, compras, productos, proveedores] = await Promise.all([
                    getProyectoPorId(proyectoId),
                    getFasesPorProyecto(proyectoId),
                    getGastosPorProyecto(proyectoId),
                    getCobrosPorProyecto(proyectoId),
                    getComprasPorProyecto(proyectoId),
                    getProductos(),
                    getProveedores(),
                ]);
                setDatos({ proyecto, fases, gastos, cobros, compras, productos, proveedores });
            } catch (error) {
                console.error("Error fetching datos del análisis:", error);
            } finally {
                setCargando(false);
            }
        };

        fetchDatos();
    }, [proyectoId]);

    const analisis = useMemo(() => (datos ? calcularAnalisis(datos) : null), [datos]);

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
    if (!analisis) return <p className="analisis-vacio">No se pudo cargar el análisis del proyecto.</p>;

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
    const colorDisponible = totales.disponible >= 0 ? VERDE : ROJO;
    const escala = escalaCascada(cascada);

    // "Disponible" siempre va primero y en verde (mismo color que la
    // tarjeta de KPI) -- el resto de las porciones son las fases, con la
    // paleta de marca de siempre pero sin repetir el verde para no
    // confundirlas con la porción de disponible.
    const coloresFasesSinVerde = COLORES_TORTA.filter((c) => c !== VERDE);
    const coloresCobradoPorFase =
        cobradoPorFase[0]?.nombre === "Disponible" ? [VERDE, ...coloresFasesSinVerde] : coloresFasesSinVerde;

    return (
        <div className="analisis">
            {esAdmin && (
                <div className="analisis-header">
                    <button
                        type="button"
                        className="analisis-btn-reporte"
                        onClick={handleDescargarReporte}
                        disabled={descargandoReporte}
                    >
                        {descargandoReporte ? "Generando..." : "Generar reporte PDF"}
                    </button>
                </div>
            )}

            <div className="analisis-kpis">
                <TarjetaKpi
                    titulo="Cobrado"
                    valor={`${totales.pctCobrado.toFixed(1)}%`}
                    porcentaje={totales.pctCobrado}
                    detalle={`${formatMoneda(totales.cobrado)} de ${formatMoneda(totales.precioAcordado)} acordados`}
                />
                <TarjetaKpi
                    titulo="Gastado"
                    valor={`${totales.pctGastado.toFixed(1)}%`}
                    porcentaje={totales.pctGastado}
                    detalle={`${formatMoneda(totales.egresos)} en gastos y compras sobre ${formatMoneda(totales.precioAcordado)}`}
                    color={totales.pctGastado > 100 ? ROJO : NARANJA}
                />
                <TarjetaKpi
                    titulo="Dinero disponible"
                    valor={formatMoneda(totales.disponible)}
                    detalle="Cobros − gastos − compras"
                    color={colorDisponible}
                    destacado
                />
            </div>

            <Seccion
                titulo="Rentabilidad"
                descripcion="De lo cobrado a la ganancia neta, restando gastos, compras, notas de crédito/débito e impuestos."
                vacio={totales.cobrado === 0 && totales.egresos === 0}
                mensajeVacio="Todavía no hay cobros ni egresos cargados."
            >
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={cascada} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                        <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
                        <YAxis
                            domain={escala.dominio}
                            ticks={escala.ticks}
                            tickFormatter={formatMonedaCorta}
                            tick={{ fontSize: 12 }}
                            width={80}
                        />
                        <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.valor} />} />
                        <Bar dataKey="rango" isAnimationActive={false} radius={3}>
                            {cascada.map((paso) => (
                                <Cell key={paso.nombre} fill={colorPasoCascada(paso)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </Seccion>

            <div className="analisis-fila">
                <Seccion
                    titulo="Gastos por categoría"
                    descripcion={`Total de gastos: ${formatMoneda(totales.gastos)}`}
                    vacio={gastosPorCategoria.length === 0}
                    mensajeVacio="No hay gastos cargados."
                >
                    <Torta datos={gastosPorCategoria} colores={COLORES_TORTA} />
                </Seccion>

                <Seccion
                    titulo="Impuestos por tipo"
                    vacio={impuestosPorTipo.length === 0}
                    mensajeVacio="No hay impuestos cargados en las compras."
                >
                    <TarjetaKpi titulo="Total de impuestos" valor={formatMoneda(totales.impuestos)} plano />
                    <Torta datos={impuestosPorTipo} colores={COLORES_TORTA} />
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
                        {/* el treemap arma su propio payload, ahí el monto viaja como `value` */}
                        <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.monto ?? d.value} />} />
                    </Treemap>
                </ResponsiveContainer>
            </Seccion>

            <Seccion
                titulo="Cobrado vs. gastado por fase"
                descripcion={`De ${formatMoneda(totales.cobrado)} cobrados: cuánto sigue disponible, lo comprado en cada fase y los gastos.`}
                vacio={totales.cobrado === 0}
                mensajeVacio="Todavía no hay cobros cargados para este proyecto."
            >
                <Torta datos={cobradoPorFase} colores={coloresCobradoPorFase} />
            </Seccion>

            <Seccion
                titulo="Pagos por tipo de factura"
                descripcion="Gastos y compras del proyecto agrupados por comprobante fiscal."
                vacio={pagosPorTipoFactura.length === 0}
                mensajeVacio="No hay pagos cargados."
            >
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={pagosPorTipoFactura} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
                        <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                        <YAxis tickFormatter={formatMonedaCorta} tick={{ fontSize: 12 }} width={80} />
                        <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.monto} />} />
                        <Bar dataKey="monto" fill={AZUL} isAnimationActive={false} radius={[4, 4, 0, 0]} />
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
                                <td>{formatMoneda(fila.monto)}</td>
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
                    <p className="analisis-vacio">Todavía no hay gastos ni compras imputados a una fase.</p>
                ) : (
                    <ResponsiveContainer width="100%" height={Math.max(egresosPorFase.length * 52, 140)}>
                        <BarChart
                            data={egresosPorFase}
                            layout="vertical"
                            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e4e4e7" />
                            <XAxis type="number" tickFormatter={formatMonedaCorta} tick={{ fontSize: 12 }} />
                            <YAxis type="category" dataKey="nombre" width={180} tick={{ fontSize: 12 }} interval={0} />
                            <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.total} />} />
                            <Bar dataKey="total" fill={VERDE} isAnimationActive={false} radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                )}
            </Seccion>

            <div className="analisis-fila">
                <Seccion titulo="Gastos sin comprobante">
                    <TarjetaKpi
                        valor={gastosSinComprobante.cantidad}
                        detalle={`${formatMoneda(gastosSinComprobante.monto)} sin respaldo cargado`}
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
                                <span className="analisis-ranking-monto">{formatMoneda(proveedor.monto)}</span>
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
                        valor={formatMoneda(notas.compras.credito)}
                        detalle="A favor nuestro, resta a lo que le debemos al proveedor"
                        color={ROJO}
                        destacado
                        plano
                    />
                    <TarjetaKpi
                        titulo="Notas de débito (compras)"
                        valor={formatMoneda(notas.compras.debito)}
                        detalle="En contra nuestro, suma a lo que le debemos al proveedor"
                        color={NARANJA}
                        destacado
                        plano
                    />
                    <TarjetaKpi
                        titulo="Notas de crédito (cobros)"
                        valor={formatMoneda(notas.cobros.credito)}
                        detalle="Ajuste a favor del cliente, resta a lo cobrado"
                        color={ROJO}
                        destacado
                        plano
                    />
                    <TarjetaKpi
                        titulo="Notas de débito (cobros)"
                        valor={formatMoneda(notas.cobros.debito)}
                        detalle="Ajuste en contra del cliente, suma a lo cobrado"
                        color={NARANJA}
                        destacado
                        plano
                    />
                </div>
            </Seccion>
        </div>
    );
}

export default AnalisisGeneral;
