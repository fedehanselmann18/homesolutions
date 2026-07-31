import { X } from "lucide-react";

import { TIPOS_FACTURA } from "../../constants/tipoFactura";
import {
    FILTRO_NOTAS,
    FILTRO_ESTADO_PAGO,
    FILTRO_ESTADO_ENVIO,
    FILTRO_COMPROBANTE,
    FILTROS_VACIOS,
    hayFiltrosActivos,
} from "../../utils/filtros";

import "./FiltrosLista.css";

/**
 * Barra de filtros reutilizable para listas de Compras / Cobros / Gastos.
 * Componente controlado: recibe `filtros` + `onCambiar` y no guarda estado
 * propio, así el componente padre decide qué hacer con el resultado
 * (filtrarCompras/filtrarCobros/filtrarGastos de utils/filtros.js).
 *
 * `mostrarNotas` sólo aplica a Compras/Cobros (Gasto no tiene notas).
 * `mostrarEstadoPago`/`mostrarEstadoEnvio` sólo aplican a Compras.
 * `mostrarComprobante` aplica a Cobros/Gastos.
 */
export function FiltrosLista({
    filtros,
    onCambiar,
    mostrarNotas = false,
    mostrarEstadoPago = false,
    mostrarEstadoEnvio = false,
    mostrarComprobante = false,
}) {
    const cambiarCampo = (campo, valor) => onCambiar({ ...filtros, [campo]: valor });
    const limpiar = () => onCambiar(FILTROS_VACIOS);

    return (
        <div className="filtros-lista">
            <div className="filtros-lista-campo">
                <label>Desde</label>
                <input
                    type="date"
                    value={filtros.desde}
                    onChange={(e) => cambiarCampo("desde", e.target.value)}
                />
            </div>

            <div className="filtros-lista-campo">
                <label>Hasta</label>
                <input
                    type="date"
                    value={filtros.hasta}
                    onChange={(e) => cambiarCampo("hasta", e.target.value)}
                />
            </div>

            <div className="filtros-lista-campo">
                <label>Tipo de factura</label>
                <select value={filtros.tipoFactura} onChange={(e) => cambiarCampo("tipoFactura", e.target.value)}>
                    <option value="">Todos</option>
                    {TIPOS_FACTURA.map((t) => (
                        <option key={t.value} value={t.value}>
                            {t.label}
                        </option>
                    ))}
                </select>
            </div>

            {mostrarNotas && (
                <div className="filtros-lista-campo">
                    <label>Notas</label>
                    <select value={filtros.notas} onChange={(e) => cambiarCampo("notas", e.target.value)}>
                        {FILTRO_NOTAS.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {mostrarEstadoPago && (
                <div className="filtros-lista-campo">
                    <label>Estado de pago</label>
                    <select value={filtros.estadoPago} onChange={(e) => cambiarCampo("estadoPago", e.target.value)}>
                        {FILTRO_ESTADO_PAGO.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {mostrarEstadoEnvio && (
                <div className="filtros-lista-campo">
                    <label>Estado de envío</label>
                    <select value={filtros.estadoEnvio} onChange={(e) => cambiarCampo("estadoEnvio", e.target.value)}>
                        {FILTRO_ESTADO_ENVIO.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {mostrarComprobante && (
                <div className="filtros-lista-campo">
                    <label>Comprobante</label>
                    <select value={filtros.comprobante} onChange={(e) => cambiarCampo("comprobante", e.target.value)}>
                        {FILTRO_COMPROBANTE.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {hayFiltrosActivos(filtros) && (
                <button type="button" className="filtros-lista-limpiar" onClick={limpiar}>
                    <X size={14} strokeWidth={2} />
                    Limpiar filtros
                </button>
            )}
        </div>
    );
}

export default FiltrosLista;
