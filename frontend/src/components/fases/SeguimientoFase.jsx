import { useMemo, useState } from "react";

import { calcularSeguimiento } from "../../utils/seguimiento";
import { formatMoneda, formatFecha } from "../../utils/formato";
import { getCondicionPagoLabel } from "../../constants/estadoCompra";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { TarjetaMiniSeguimiento } from "../shared/TarjetaMiniSeguimiento";
import { EstadoVacio } from "../shared/EstadoVacio";
import { ModalDetalleCompra } from "../modals/ModalDetalleCompra";
import { ModalDetalleGasto } from "../modals/ModalDetalleGasto";

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

function AlertaColumna({ children }) {
  return <p className="seguimiento-alerta-columna">{children}</p>;
}

function badgesCompra(compra) {
  return [
    getCondicionPagoLabel(compra.condicionPago),
    getTipoFacturaLabel(compra.tipoFactura),
  ].filter(Boolean);
}

/**
 * Tab "Seguimiento de la fase" de FaseDetalle.jsx -- reusa calcularSeguimiento
 * (utils/seguimiento.js) tal cual, scopeado a las compras/gastos de esta fase
 * nomás (cobros/fases vacíos, proyecto null: esas secciones no aplican a una
 * fase individual). Ver docs/redesign/11_fase_detalle_tabs.md.
 */
export function SeguimientoFase({
  faseNombre,
  comprasFase,
  gastosFase,
  productos,
  proveedores,
  onVerComprobanteCompra,
  onVerNotaCompra,
  onVerComprobanteGasto,
}) {
  const [detalle, setDetalle] = useState(null); // { tipo: "compra" | "gasto", entidad }
  const cerrarDetalle = () => setDetalle(null);

  const seguimiento = useMemo(
    () =>
      calcularSeguimiento({
        compras: comprasFase,
        gastos: gastosFase,
        cobros: [],
        fases: [],
        proyecto: null,
        productos,
        proveedores,
      }),
    [comprasFase, gastosFase, productos, proveedores]
  );

  const {
    comprasImpagas,
    comprasSinEntregar,
    comprasSinComprobante,
    gastosSinComprobante,
    deudaPorProveedor,
    totales,
  } = seguimiento;

  const nombreProveedor = (proveedorId) => proveedores.find((p) => p.id === proveedorId)?.nombre;

  const abrirDetalleCompra = (compraId) => {
    const compra = comprasFase.find((c) => c.id === compraId);
    if (compra) setDetalle({ tipo: "compra", entidad: compra });
  };

  const abrirDetalleGasto = (gastoId) => {
    const gasto = gastosFase.find((g) => g.id === gastoId);
    if (gasto) setDetalle({ tipo: "gasto", entidad: gasto });
  };

  return (
    <div className="seguimiento">
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
              <AlertaColumna>
                {comprasSinEntregar.length} pedidos que no te entregaron
              </AlertaColumna>
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

      {deudaPorProveedor.length > 0 && (
        <Seccion
          titulo="Deuda por proveedor"
          descripcion="Sumando las compras impagas de esta fase"
        >
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
          faseNombre={faseNombre}
          proveedorNombre={nombreProveedor(detalle.entidad.proveedor_id)}
          productos={productos}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => onVerComprobanteCompra(detalle.entidad.id, c.id)}
          onVerNota={(n) => onVerNotaCompra(detalle.entidad.id, n.id)}
        />
      )}

      {detalle?.tipo === "gasto" && (
        <ModalDetalleGasto
          gasto={detalle.entidad}
          faseNombre={faseNombre}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => onVerComprobanteGasto(detalle.entidad.id, c.id)}
        />
      )}
    </div>
  );
}

export default SeguimientoFase;
