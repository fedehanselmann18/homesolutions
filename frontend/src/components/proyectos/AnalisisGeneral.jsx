import { useEffect, useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    Treemap,
    XAxis,
    YAxis,
} from "recharts";

import { getProyectoPorId } from "../../services/proyectoService";
import { getFasesPorProyecto } from "../../services/faseService";
import { getGastosPorProyecto } from "../../services/gastoService";
import { getCobrosPorProyecto } from "../../services/cobroService";
import { getComprasPorProyecto } from "../../services/compraService";
import { getProductos } from "../../services/productoService";
import { getProveedores } from "../../services/proveedorService";

import { TarjetaKpi } from "../shared/TarjetaKpi";
import { calcularAnalisis } from "../../utils/analisis";
import { formatMoneda, formatMonedaCorta } from "../../utils/formato";
import "./AnalisisGeneral.css";

const VERDE = "#6F7F45";
const ROJO = "#DC2626";
const AZUL = "#2563EB";
const NARANJA = "#D97706";

const COLORES_TORTA = ["#6F7F45", "#2563EB", "#F5A623", "#B45309", "#0EA5E9", "#8B5CF6", "#EC4899", "#94A3B8"];

const COLOR_CASCADA = {
    entrada: VERDE,
    salida: NARANJA,
    subtotal: AZUL,
    total: VERDE,
};

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

function Seccion({ titulo, descripcion, children, vacio, mensajeVacio }) {
    return (
        <section className="analisis-seccion">
            <h3 className="analisis-seccion-titulo">{titulo}</h3>
            {descripcion && <p className="analisis-seccion-descripcion">{descripcion}</p>}
            {vacio ? <p className="analisis-vacio">{mensajeVacio}</p> : children}
        </section>
    );
}

function TooltipMoneda({ active, payload, label, obtenerValor }) {
    if (!active || !payload?.length) return null;
    const dato = payload[0].payload;
    const valor = obtenerValor(dato);
    if (!Number.isFinite(valor)) return null;

    return (
        <div className="analisis-tooltip">
            <strong>{label ?? dato.name ?? dato.nombre}</strong>
            <span>{formatMoneda(valor)}</span>
        </div>
    );
}

// depth 0 = raíz (no se dibuja), 1 = tipo de producto (solo el marco),
// 2 = producto (el bloque con nombre y monto)
function ContenidoTreemap({ x, y, width, height, depth, name, monto, color, indice }) {
    if (depth === 0) return null;

    if (depth === 1) {
        return <rect x={x} y={y} width={width} height={height} fill="none" stroke="#fff" strokeWidth={4} />;
    }

    const opacidad = 0.9 - Math.min(indice ?? 0, 5) * 0.12;
    const entraElTexto = width > 80 && height > 36;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                fill={color ?? VERDE}
                fillOpacity={opacidad}
                stroke="#fff"
                strokeWidth={1}
            />
            {entraElTexto && (
                <>
                    <text x={x + 8} y={y + 20} className="analisis-treemap-nombre">
                        {name}
                    </text>
                    <text x={x + 8} y={y + 36} className="analisis-treemap-monto">
                        {formatMonedaCorta(monto)}
                    </text>
                </>
            )}
        </g>
    );
}

function Torta({ datos, colores }) {
    return (
        <div className="analisis-torta">
            <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                    <Pie
                        data={datos}
                        dataKey="monto"
                        nameKey="nombre"
                        innerRadius={55}
                        outerRadius={90}
                        paddingAngle={2}
                        isAnimationActive={false}
                    >
                        {datos.map((dato, i) => (
                            <Cell key={dato.nombre} fill={colores[i % colores.length]} />
                        ))}
                    </Pie>
                    <Tooltip content={<TooltipMoneda obtenerValor={(d) => d.monto} />} />
                </PieChart>
            </ResponsiveContainer>

            <ul className="analisis-leyenda">
                {datos.map((dato, i) => (
                    <li key={dato.nombre} className="analisis-leyenda-item">
                        <span
                            className="analisis-leyenda-punto"
                            style={{ backgroundColor: colores[i % colores.length] }}
                        />
                        <span className="analisis-leyenda-nombre">{dato.nombre}</span>
                        <span className="analisis-leyenda-pct">{dato.pct.toFixed(1)}%</span>
                        <span className="analisis-leyenda-monto">{formatMoneda(dato.monto)}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function AnalisisGeneral({ proyectoId }) {
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(true);

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

    if (cargando) return <p className="analisis-vacio">Cargando análisis...</p>;
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
        gastosSinComprobante,
        topProveedores,
    } = analisis;

    const totalFases = avanceFases.reduce((acc, f) => acc + f.cantidad, 0);
    const colorDisponible = totales.disponible >= 0 ? VERDE : ROJO;
    const escala = escalaCascada(cascada);

    return (
        <div className="analisis">
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
                descripcion="De lo cobrado a la ganancia neta, restando gastos, compras e impuestos."
                vacio={totales.cobrado === 0 && totales.egresos === 0}
                mensajeVacio="Todavía no hay cobros ni egresos cargados."
            >
                <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={cascada} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
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
                                <Cell
                                    key={paso.nombre}
                                    fill={paso.valor < 0 && paso.tipo === "total" ? ROJO : COLOR_CASCADA[paso.tipo]}
                                />
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
                titulo="Pagos por tipo de factura"
                descripcion="Gastos y compras del proyecto agrupados por comprobante fiscal."
                vacio={pagosPorTipoFactura.length === 0}
                mensajeVacio="No hay pagos cargados."
            >
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={pagosPorTipoFactura} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee" />
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
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eee" />
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
        </div>
    );
}

export default AnalisisGeneral;
