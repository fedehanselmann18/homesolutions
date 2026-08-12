import { useState } from "react";

import GastoCard from "../proyectos/cards/GastoCard";
import CompraCard from "../proyectos/cards/CompraCard";
import FiltrosLista from "../shared/FiltrosLista";

/**
 * Tab "Acciones de la fase" de FaseDetalle.jsx -- mismo patrón de sub-tabs +
 * FiltrosLista + cards que Acciones.jsx (proyectos/Acciones.jsx), pero solo
 * con Compras/Gastos (una fase no tiene cobros propios) y en orden invertido
 * (Compras primero) a pedido de Fede. Los datos, filtros y handlers ya viven
 * en FaseDetalle.jsx -- este componente es puramente de layout.
 */
export function AccionesFase({
    canManage,
    faseNombre,
    nombreProveedor,
    productos,
    compras,
    comprasFiltradas,
    filtrosCompras,
    onCambiarFiltrosCompras,
    onNuevaCompra,
    onEditarCompra,
    onEliminarCompra,
    onTogglePagoCompra,
    onToggleEnvioCompra,
    onVerComprobanteCompra,
    onAgregarComprobanteCompra,
    onEliminarComprobanteCompra,
    onAgregarNotaCompra,
    onVerNotaCompra,
    onEliminarNotaCompra,
    onAbrirDetalleCompra,
    gastos,
    gastosFiltrados,
    filtrosGastos,
    onCambiarFiltrosGastos,
    onNuevoGasto,
    onEditarGasto,
    onEliminarGasto,
    onVerComprobanteGasto,
    onAgregarComprobanteGasto,
    onEliminarComprobanteGasto,
    onAbrirDetalleGasto,
}) {
    const [subTab, setSubTab] = useState("compras");

    return (
        <div>
            <div className="acciones-subtabs">
                <button
                    className={`acciones-subtab ${subTab === "compras" ? "active" : ""}`}
                    onClick={() => setSubTab("compras")}
                >
                    Compras
                </button>
                <button
                    className={`acciones-subtab ${subTab === "gastos" ? "active" : ""}`}
                    onClick={() => setSubTab("gastos")}
                >
                    Gastos
                </button>
            </div>

            {subTab === "compras" && (
                <div className="acciones-seccion">
                    <div className="acciones-header">
                        <h2>Compras de la fase</h2>
                        {canManage && <button onClick={onNuevaCompra}>Nueva compra</button>}
                    </div>

                    {compras.length > 0 && (
                        <FiltrosLista
                            filtros={filtrosCompras}
                            onCambiar={onCambiarFiltrosCompras}
                            mostrarNotas
                            mostrarEstadoPago
                            mostrarEstadoEnvio
                        />
                    )}

                    {compras.length === 0 ? (
                        <p>No hay compras registradas para esta fase.</p>
                    ) : comprasFiltradas.length === 0 ? (
                        <p>Ninguna compra coincide con los filtros.</p>
                    ) : (
                        <div className="acciones-grid acciones-grid--compras">
                            {comprasFiltradas.map((compra) => (
                                <CompraCard
                                    key={compra.id}
                                    compra={compra}
                                    faseNombre={faseNombre}
                                    proveedorNombre={nombreProveedor(compra.proveedor_id)}
                                    productos={productos}
                                    onEditar={onEditarCompra}
                                    onEliminar={onEliminarCompra}
                                    onTogglePago={onTogglePagoCompra}
                                    onToggleEnvio={onToggleEnvioCompra}
                                    onVerComprobante={onVerComprobanteCompra}
                                    onAgregarComprobante={onAgregarComprobanteCompra}
                                    onEliminarComprobante={onEliminarComprobanteCompra}
                                    onAgregarNota={onAgregarNotaCompra}
                                    onVerNota={onVerNotaCompra}
                                    onEliminarNota={onEliminarNotaCompra}
                                    onAbrirDetalle={onAbrirDetalleCompra}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {subTab === "gastos" && (
                <div className="acciones-seccion">
                    <div className="acciones-header">
                        <h2>Gastos de la fase</h2>
                        {canManage && <button onClick={onNuevoGasto}>Nuevo gasto</button>}
                    </div>

                    {gastos.length > 0 && (
                        <FiltrosLista filtros={filtrosGastos} onCambiar={onCambiarFiltrosGastos} mostrarComprobante />
                    )}

                    {gastos.length === 0 ? (
                        <p>No hay gastos registrados para esta fase.</p>
                    ) : gastosFiltrados.length === 0 ? (
                        <p>Ningún gasto coincide con los filtros.</p>
                    ) : (
                        <div className="acciones-grid">
                            {gastosFiltrados.map((gasto) => (
                                <GastoCard
                                    key={gasto.id}
                                    gasto={gasto}
                                    faseNombre={faseNombre}
                                    onEditar={onEditarGasto}
                                    onEliminar={onEliminarGasto}
                                    onVerComprobante={onVerComprobanteGasto}
                                    onAgregarComprobante={onAgregarComprobanteGasto}
                                    onEliminarComprobante={onEliminarComprobanteGasto}
                                    onAbrirDetalle={onAbrirDetalleGasto}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AccionesFase;
