import { useMemo, useState } from "react";
import { Clock, AlertTriangle } from "lucide-react";

import { getComprobanteCompra, getNotaCompra } from "../../services/compraService";
import { getComprobanteGasto } from "../../services/gastoService";
import { getComprobanteCobro, getNotaCobro } from "../../services/cobroService";
import {
    useProyecto,
    useFasesPorProyecto,
    useGastosPorProyecto,
    useCobrosPorProyecto,
    useComprasPorProyecto,
    useProductos,
    useProveedores,
} from "../../hooks/queries";

import { TarjetaAlerta } from "../shared/TarjetaAlerta";
import { TarjetaKpi } from "../shared/TarjetaKpi";
import { TarjetaMiniSeguimiento } from "../shared/TarjetaMiniSeguimiento";
import { EstadoVacio } from "../shared/EstadoVacio";
import { Cargando } from "../shared/Cargando";
import { ModalDetalleCompra } from "../modals/ModalDetalleCompra";
import { ModalDetalleGasto } from "../modals/ModalDetalleGasto";
import { ModalDetalleCobro } from "../modals/ModalDetalleCobro";
import { calcularSeguimiento, DIAS_FASE_ESTANCADA } from "../../utils/seguimiento";
import { formatMoneda, formatFecha } from "../../utils/formato";
import { getCondicionPagoLabel } from "../../constants/estadoCompra";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { VERDE, ROJO, NARANJA, GRIS } from "../../constants/colores";
import "./Seguimiento.css";

const diasTexto = (dias) => `hace ${dias} ${dias === 1 ? "día" : "días"}`;

function Seccion({ titulo, descripcion, cantidad, children }) {
    return (
        <section className="seguimiento-seccion">
            <div className="seguimiento-seccion-header">
                <h3 className="seguimiento-seccion-titulo">
                    <AlertTriangle className="seguimiento-seccion-icono" size={20} strokeWidth={2.25} />
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

function AlertaColumna({ children }) {
    return <p className="seguimiento-alerta-columna">{children}</p>;
}

function badgesCompra(compra) {
    return [getCondicionPagoLabel(compra.condicionPago), getTipoFacturaLabel(compra.tipoFactura)].filter(Boolean);
}

export function Seguimiento({ proyectoId, onIrATab }) {
    const [detalle, setDetalle] = useState(null); // { tipo: "compra" | "gasto" | "cobro", entidad }

    const proyectoQuery = useProyecto(proyectoId);
    const fasesQuery = useFasesPorProyecto(proyectoId);
    const gastosQuery = useGastosPorProyecto(proyectoId);
    const cobrosQuery = useCobrosPorProyecto(proyectoId);
    const comprasQuery = useComprasPorProyecto(proyectoId);
    const productosQuery = useProductos();
    const proveedoresQuery = useProveedores();

    const cargando =
        proyectoQuery.isLoading ||
        fasesQuery.isLoading ||
        gastosQuery.isLoading ||
        cobrosQuery.isLoading ||
        comprasQuery.isLoading ||
        productosQuery.isLoading ||
        proveedoresQuery.isLoading;
    const error =
        proyectoQuery.error || fasesQuery.error || gastosQuery.error || cobrosQuery.error || comprasQuery.error;

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

    const irAFases = onIrATab ? () => onIrATab("fases") : undefined;

    const nombreFase = (faseId) => datos.fases.find((f) => f.id === faseId)?.nombre;
    const nombreProveedor = (proveedorId) => datos.proveedores.find((p) => p.id === proveedorId)?.nombre;

    const abrirDetalleCompra = (compraId) => {
        const compra = datos.compras.find((c) => c.id === compraId);
        if (compra) setDetalle({ tipo: "compra", entidad: compra });
    };

    const abrirDetalleGasto = (gastoId) => {
        const gasto = datos.gastos.find((g) => g.id === gastoId);
        if (gasto) setDetalle({ tipo: "gasto", entidad: gasto });
    };

    const abrirDetalleCobro = (cobroId) => {
        const cobro = datos.cobros.find((c) => c.id === cobroId);
        if (cobro) setDetalle({ tipo: "cobro", entidad: cobro });
    };

    const cerrarDetalle = () => setDetalle(null);

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

            <Seccion titulo="Compras">
                <div className="seguimiento-tablero">
                    <div className="seguimiento-columna">
                        <h4 className="seguimiento-columna-titulo">
                            Pendientes de pago
                            {comprasImpagas.length > 0 && (
                                <span className="seguimiento-contador">{comprasImpagas.length}</span>
                            )}
                        </h4>
                        {comprasImpagas.length === 0 ? (
                            <EstadoVacio mensaje="No hay compras impagas." />
                        ) : (
                            <div className="seguimiento-columna-lista">
                                {comprasImpagas.map((compra) => (
                                    <TarjetaMiniSeguimiento
                                        key={compra.id}
                                        titulo={compra.descripcion}
                                        productos={compra.productos}
                                        fecha={formatFecha(compra.fecha)}
                                        badges={badgesCompra(compra)}
                                        etiqueta={diasTexto(compra.dias)}
                                        monto={formatMoneda(compra.monto)}
                                        color={ROJO}
                                        onClick={() => abrirDetalleCompra(compra.id)}
                                    />
                                ))}
                            </div>
                        )}
                        {comprasImpagas.length > 0 && (
                            <AlertaColumna>{formatMoneda(totales.deudaTotal)} sin pagar</AlertaColumna>
                        )}
                    </div>

                    <div className="seguimiento-columna">
                        <h4 className="seguimiento-columna-titulo">
                            Pendientes de entrega
                            {comprasSinEntregar.length > 0 && (
                                <span className="seguimiento-contador">{comprasSinEntregar.length}</span>
                            )}
                        </h4>
                        {comprasSinEntregar.length === 0 ? (
                            <EstadoVacio mensaje="No hay compras esperando entrega." />
                        ) : (
                            <div className="seguimiento-columna-lista">
                                {comprasSinEntregar.map((compra) => (
                                    <TarjetaMiniSeguimiento
                                        key={compra.id}
                                        titulo={compra.descripcion}
                                        productos={compra.productos}
                                        fecha={formatFecha(compra.fecha)}
                                        badges={badgesCompra(compra)}
                                        etiqueta={diasTexto(compra.dias)}
                                        color={NARANJA}
                                        onClick={() => abrirDetalleCompra(compra.id)}
                                    />
                                ))}
                            </div>
                        )}
                        {comprasSinEntregar.length > 0 && (
                            <AlertaColumna>{comprasSinEntregar.length} pedidos que no te entregaron</AlertaColumna>
                        )}
                    </div>

                    <div className="seguimiento-columna">
                        <h4 className="seguimiento-columna-titulo">
                            Sin comprobante
                            {comprasSinComprobante.length > 0 && (
                                <span className="seguimiento-contador">{comprasSinComprobante.length}</span>
                            )}
                        </h4>
                        {comprasSinComprobante.length === 0 ? (
                            <EstadoVacio mensaje="Todas las compras tienen comprobante." />
                        ) : (
                            <div className="seguimiento-columna-lista">
                                {comprasSinComprobante.map((compra) => (
                                    <TarjetaMiniSeguimiento
                                        key={compra.id}
                                        titulo={compra.descripcion}
                                        productos={compra.productos}
                                        fecha={formatFecha(compra.fecha)}
                                        badges={badgesCompra(compra)}
                                        monto={formatMoneda(compra.monto)}
                                        color={GRIS}
                                        onClick={() => abrirDetalleCompra(compra.id)}
                                    />
                                ))}
                            </div>
                        )}
                        {comprasSinComprobante.length > 0 && (
                            <AlertaColumna>
                                {comprasSinComprobante.length} compras que no tienen comprobante adjunto
                            </AlertaColumna>
                        )}
                    </div>
                </div>
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
                    <EstadoVacio mensaje="Todos los gastos tienen comprobante." />
                ) : (
                    <div className="seguimiento-columna-lista">
                        {gastosSinComprobante.map((gasto) => (
                            <TarjetaMiniSeguimiento
                                key={gasto.id}
                                titulo={gasto.descripcion}
                                subtitulo={`Cargado el ${formatFecha(gasto.fecha)}`}
                                monto={formatMoneda(gasto.monto)}
                                color={GRIS}
                                onClick={() => abrirDetalleGasto(gasto.id)}
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
                    <EstadoVacio mensaje="Todos los cobros tienen comprobante." />
                ) : (
                    <div className="seguimiento-columna-lista">
                        {cobrosSinComprobante.map((cobro) => (
                            <TarjetaMiniSeguimiento
                                key={cobro.id}
                                titulo={cobro.descripcion}
                                subtitulo={`Cargado el ${formatFecha(cobro.fecha)}`}
                                monto={formatMoneda(cobro.monto)}
                                color={GRIS}
                                onClick={() => abrirDetalleCobro(cobro.id)}
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

            {detalle?.tipo === "compra" && (
                <ModalDetalleCompra
                    compra={detalle.entidad}
                    faseNombre={nombreFase(detalle.entidad.fase_id)}
                    proveedorNombre={nombreProveedor(detalle.entidad.proveedor_id)}
                    productos={datos.productos}
                    onCerrar={cerrarDetalle}
                    onVerComprobante={(c) => getComprobanteCompra(detalle.entidad.id, c.id)}
                    onVerNota={(n) => getNotaCompra(detalle.entidad.id, n.id)}
                />
            )}

            {detalle?.tipo === "gasto" && (
                <ModalDetalleGasto
                    gasto={detalle.entidad}
                    faseNombre={detalle.entidad.fase_id ? nombreFase(detalle.entidad.fase_id) : null}
                    onCerrar={cerrarDetalle}
                    onVerComprobante={(c) => getComprobanteGasto(detalle.entidad.id, c.id)}
                />
            )}

            {detalle?.tipo === "cobro" && (
                <ModalDetalleCobro
                    cobro={detalle.entidad}
                    onCerrar={cerrarDetalle}
                    onVerComprobante={(c) => getComprobanteCobro(detalle.entidad.id, c.id)}
                    onVerNota={(n) => getNotaCobro(detalle.entidad.id, n.id)}
                />
            )}
        </div>
    );
}

export default Seguimiento;
