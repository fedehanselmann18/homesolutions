import { useEffect, useMemo, useState } from "react";
import { Clock, FileWarning, Truck, Wallet } from "lucide-react";

import { getProyectoPorId } from "../../services/proyectoService";
import { getFasesPorProyecto } from "../../services/faseService";
import { getGastosPorProyecto } from "../../services/gastoService";
import { getCobrosPorProyecto } from "../../services/cobroService";
import { getComprasPorProyecto } from "../../services/compraService";
import { getProductos } from "../../services/productoService";
import { getProveedores } from "../../services/proveedorService";

import { TarjetaAlerta } from "../shared/TarjetaAlerta";
import { TarjetaKpi } from "../shared/TarjetaKpi";
import { Cargando } from "../shared/Cargando";
import { calcularSeguimiento, DIAS_FASE_ESTANCADA } from "../../utils/seguimiento";
import { formatMoneda, formatFecha } from "../../utils/formato";
import { getCondicionPagoLabel } from "../../constants/estadoCompra";
import "./Seguimiento.css";

const VERDE = "#16a34a";
const ROJO = "#dc2626";
const NARANJA = "#d97706";
const GRIS = "#64748b";

const diasTexto = (dias) => `hace ${dias} ${dias === 1 ? "día" : "días"}`;

function Seccion({ titulo, descripcion, cantidad, children }) {
    return (
        <section className="seguimiento-seccion">
            <div className="seguimiento-seccion-header">
                <h3 className="seguimiento-seccion-titulo">
                    {titulo}
                    {cantidad > 0 && <span className="seguimiento-contador">{cantidad}</span>}
                </h3>
                {descripcion && <p className="seguimiento-seccion-descripcion">{descripcion}</p>}
            </div>
            {children}
        </section>
    );
}

function ListaVacia({ mensaje }) {
    return <p className="seguimiento-vacio">{mensaje}</p>;
}

export function Seguimiento({ proyectoId, onIrATab }) {
    const [datos, setDatos] = useState(null);
    const [cargando, setCargando] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDatos = async () => {
            try {
                setCargando(true);
                setError(null);
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
            } catch (err) {
                console.error("Error fetching datos del seguimiento:", err);
                setError(err);
            } finally {
                setCargando(false);
            }
        };

        fetchDatos();
    }, [proyectoId]);

    const seguimiento = useMemo(() => (datos ? calcularSeguimiento(datos) : null), [datos]);

    if (cargando) return <Cargando texto="Cargando seguimiento..." />;
    if (error || !seguimiento) {
        return <p className="seguimiento-vacio">No se pudieron cargar los datos del seguimiento.</p>;
    }

    const {
        cobranza,
        comprasImpagas,
        comprasSinEntregar,
        comprasSinComprobante,
        gastosSinComprobante,
        cobrosSinComprobante,
        fasesEstancadas,
        deudaPorProveedor,
        totales,
        pendientes,
    } = seguimiento;

    const irAAcciones = onIrATab ? () => onIrATab("acciones") : undefined;
    const irAFases = onIrATab ? () => onIrATab("fases") : undefined;

    return (
        <div className="seguimiento">
            <Seccion
                titulo="Cobro del proyecto"
                descripcion={
                    cobranza.ultimoCobro
                        ? `${cobranza.cantidadCobros} ${cobranza.cantidadCobros === 1 ? "cobro registrado" : "cobros registrados"} · último ${diasTexto(cobranza.ultimoCobro.dias)}`
                        : "Todavía no se cargó ningún cobro"
                }
            >
                <div className="seguimiento-cobranza">
                    <TarjetaKpi titulo="Precio acordado" valor={formatMoneda(cobranza.precioAcordado)} />
                    <TarjetaKpi
                        titulo="Cobrado"
                        valor={formatMoneda(cobranza.cobrado)}
                        porcentaje={cobranza.pctCobrado}
                        detalle={`${cobranza.pctCobrado.toFixed(1)}% de lo acordado`}
                    />
                    <TarjetaKpi
                        titulo="Queda por cobrar"
                        valor={formatMoneda(cobranza.pendiente)}
                        detalle="Precio acordado − cobros cargados"
                        color={cobranza.pendiente > 0 ? NARANJA : VERDE}
                        destacado
                    />
                </div>
            </Seccion>

            <div className="seguimiento-resumen">
                <span className="seguimiento-resumen-valor">{pendientes}</span>
                <span className="seguimiento-resumen-texto">
                    {pendientes === 0
                        ? "No hay nada pendiente en este proyecto."
                        : `${pendientes === 1 ? "cosa pendiente" : "cosas pendientes"} en este proyecto`}
                </span>
            </div>

            <Seccion
                titulo="Compras pendientes de pago"
                descripcion={
                    comprasImpagas.length > 0
                        ? `${formatMoneda(totales.deudaTotal)} sin pagar`
                        : undefined
                }
                cantidad={comprasImpagas.length}
            >
                {comprasImpagas.length === 0 ? (
                    <ListaVacia mensaje="No hay compras impagas." />
                ) : (
                    <div className="seguimiento-lista">
                        {comprasImpagas.map((compra) => (
                            <TarjetaAlerta
                                key={compra.id}
                                icono={Wallet}
                                color={ROJO}
                                titulo={compra.proveedor}
                                detalle={`${compra.productos} · comprado el ${formatFecha(compra.fecha)} · ${getCondicionPagoLabel(compra.condicionPago)}`}
                                monto={formatMoneda(compra.monto)}
                                extra={diasTexto(compra.dias)}
                                onClick={irAAcciones}
                            />
                        ))}
                    </div>
                )}
            </Seccion>

            <Seccion
                titulo="Compras pendientes de entrega"
                descripcion={comprasSinEntregar.length > 0 ? "Pedidas pero todavía no recibidas" : undefined}
                cantidad={comprasSinEntregar.length}
            >
                {comprasSinEntregar.length === 0 ? (
                    <ListaVacia mensaje="No hay compras esperando entrega." />
                ) : (
                    <div className="seguimiento-lista">
                        {comprasSinEntregar.map((compra) => (
                            <TarjetaAlerta
                                key={compra.id}
                                icono={Truck}
                                color={NARANJA}
                                titulo={compra.proveedor}
                                detalle={`${compra.productos} · pedido el ${formatFecha(compra.fecha)}`}
                                extra={diasTexto(compra.dias)}
                                onClick={irAAcciones}
                            />
                        ))}
                    </div>
                )}
            </Seccion>

            <Seccion
                titulo="Compras sin comprobante"
                descripcion={
                    comprasSinComprobante.length > 0
                        ? `${formatMoneda(totales.montoComprasSinComprobante)} sin respaldo cargado`
                        : undefined
                }
                cantidad={comprasSinComprobante.length}
            >
                {comprasSinComprobante.length === 0 ? (
                    <ListaVacia mensaje="Todas las compras tienen comprobante." />
                ) : (
                    <div className="seguimiento-lista">
                        {comprasSinComprobante.map((compra) => (
                            <TarjetaAlerta
                                key={compra.id}
                                icono={FileWarning}
                                color={GRIS}
                                titulo={compra.proveedor}
                                detalle={`${compra.productos} · comprado el ${formatFecha(compra.fecha)}`}
                                monto={formatMoneda(compra.monto)}
                                onClick={irAAcciones}
                            />
                        ))}
                    </div>
                )}
            </Seccion>

            <Seccion
                titulo="Gastos sin comprobante"
                descripcion={
                    gastosSinComprobante.length > 0
                        ? `${formatMoneda(totales.montoSinComprobante)} sin respaldo cargado`
                        : undefined
                }
                cantidad={gastosSinComprobante.length}
            >
                {gastosSinComprobante.length === 0 ? (
                    <ListaVacia mensaje="Todos los gastos tienen comprobante." />
                ) : (
                    <div className="seguimiento-lista">
                        {gastosSinComprobante.map((gasto) => (
                            <TarjetaAlerta
                                key={gasto.id}
                                icono={FileWarning}
                                color={GRIS}
                                titulo={gasto.descripcion}
                                detalle={`Cargado el ${formatFecha(gasto.fecha)}`}
                                monto={formatMoneda(gasto.monto)}
                                onClick={irAAcciones}
                            />
                        ))}
                    </div>
                )}
            </Seccion>

            <Seccion
                titulo="Cobros sin comprobante"
                descripcion={
                    cobrosSinComprobante.length > 0
                        ? `${formatMoneda(totales.montoCobrosSinComprobante)} sin respaldo cargado`
                        : undefined
                }
                cantidad={cobrosSinComprobante.length}
            >
                {cobrosSinComprobante.length === 0 ? (
                    <ListaVacia mensaje="Todos los cobros tienen comprobante." />
                ) : (
                    <div className="seguimiento-lista">
                        {cobrosSinComprobante.map((cobro) => (
                            <TarjetaAlerta
                                key={cobro.id}
                                icono={FileWarning}
                                color={GRIS}
                                titulo={cobro.descripcion}
                                detalle={`Cargado el ${formatFecha(cobro.fecha)}`}
                                monto={formatMoneda(cobro.monto)}
                                onClick={irAAcciones}
                            />
                        ))}
                    </div>
                )}
            </Seccion>

            <Seccion
                titulo="Fases estancadas"
                descripcion={`En curso, sin cambios hace ${DIAS_FASE_ESTANCADA} días o más`}
                cantidad={fasesEstancadas.length}
            >
                {fasesEstancadas.length === 0 ? (
                    <ListaVacia mensaje="Ninguna fase quedó frenada." />
                ) : (
                    <div className="seguimiento-lista">
                        {fasesEstancadas.map((fase) => (
                            <TarjetaAlerta
                                key={fase.id}
                                icono={Clock}
                                color={NARANJA}
                                titulo={fase.nombre}
                                detalle={`En curso, sin cambios ${diasTexto(fase.dias)}`}
                                onClick={irAFases}
                            />
                        ))}
                    </div>
                )}
            </Seccion>

            {deudaPorProveedor.length > 0 && (
                <Seccion titulo="Deuda por proveedor" descripcion="Sumando las compras impagas del proyecto">
                    <table className="seguimiento-tabla">
                        <thead>
                            <tr>
                                <th>Proveedor</th>
                                <th>Compras</th>
                                <th>Deuda</th>
                            </tr>
                        </thead>
                        <tbody>
                            {deudaPorProveedor.map((fila) => (
                                <tr key={fila.proveedor}>
                                    <td>{fila.proveedor}</td>
                                    <td>{fila.compras}</td>
                                    <td className="seguimiento-tabla-monto">{formatMoneda(fila.monto)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr>
                                <td>Total</td>
                                <td>{comprasImpagas.length}</td>
                                <td className="seguimiento-tabla-monto">{formatMoneda(totales.deudaTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </Seccion>
            )}
        </div>
    );
}

export default Seguimiento;
