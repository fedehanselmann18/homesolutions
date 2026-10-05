import { useMemo, useState } from "react";

import { calcularSeguimiento } from "../../utils/seguimiento";
import { formatFecha } from "../../utils/formato";
import { formatMontoDeItem } from "../../utils/moneda";
import { getCondicionPagoLabel } from "../../constants/estadoCompra";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { ROJO, NARANJA, GRIS } from "../../constants/colores";
import { TarjetaMiniSeguimiento } from "../shared/TarjetaMiniSeguimiento";
import { EstadoVacio } from "../shared/EstadoVacio";
import { ModalDetalleCompra } from "../modals/ModalDetalleCompra";
import { ModalDetalleGasto } from "../modals/ModalDetalleGasto";

const diasTexto = (dias) => `hace ${dias} ${dias === 1 ? "día" : "días"}`;

function Seccion({ titulo, descripcion, cantidad, children }) {
  return (
    <section className="seguimiento-seccion">
      <div className="seguimiento-seccion-header">
        <h3 className="seguimiento-seccion-titulo">
          {titulo}
          {cantidad > 0 && <span className="badge badge--sm badge--neutro">{cantidad}</span>}
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
  // Seguimiento es la pantalla de "lo que falta": si desde acá no se puede
  // adjuntar el comprobante que falta ni marcar la compra como pagada, hay
  // que ir a buscar el mismo movimiento a otra pestaña. Todo opcional para
  // no romper si algún día se usa este componente en modo lectura.
  onAgregarComprobanteCompra,
  onEliminarComprobanteCompra,
  onAgregarComprobanteGasto,
  onEliminarComprobanteGasto,
  onTogglePagoCompra,
  onToggleEnvioCompra,
  onEditarCompra,
  onEditarGasto,
  canManage = false,
}) {
  // Igual que en el Seguimiento del proyecto: se guarda el id y la entidad se
  // re-lee, así togglear o subir un comprobante se refleja en el modal abierto.
  const [detalle, setDetalle] = useState(null); // { tipo: "compra" | "gasto", id }
  const cerrarDetalle = () => setDetalle(null);

  const entidadDetalle = detalle
    ? (detalle.tipo === "compra" ? comprasFase : gastosFase).find((e) => e.id === detalle.id)
    : null;

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

  const abrirDetalleCompra = (compraId) => setDetalle({ tipo: "compra", id: compraId });
  const abrirDetalleGasto = (gastoId) => setDetalle({ tipo: "gasto", id: gastoId });

  return (
    <div className="seguimiento">
      <Seccion titulo="Compras">
        <div className="seguimiento-tablero">
          <div className="seguimiento-columna">
            <h4 className="seguimiento-columna-titulo">
              Pendientes de pago
              {comprasImpagas.length > 0 && (
                <span className="badge badge--sm badge--neutro">{comprasImpagas.length}</span>
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
                    monto={formatMontoDeItem(compra)}
                    color={ROJO}
                    onClick={() => abrirDetalleCompra(compra.id)}
                  />
                ))}
              </div>
            )}
            {comprasImpagas.length > 0 && (
              <AlertaColumna>
                {formatMontoDeItem({
                  monto: totales.deudaTotal,
                  montoOtra: totales.deudaTotalOtra,
                  moneda: "ars",
                })}{" "}
                sin pagar
              </AlertaColumna>
            )}
          </div>

          <div className="seguimiento-columna">
            <h4 className="seguimiento-columna-titulo">
              Pendientes de entrega
              {comprasSinEntregar.length > 0 && (
                <span className="badge badge--sm badge--neutro">{comprasSinEntregar.length}</span>
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
                <span className="badge badge--sm badge--neutro">
                  {comprasSinComprobante.length}
                </span>
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
                    monto={formatMontoDeItem(compra)}
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
            ? `${formatMontoDeItem({
                monto: totales.montoSinComprobante,
                montoOtra: totales.montoSinComprobanteOtra,
                moneda: "ars",
              })} sin respaldo cargado`
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
                monto={formatMontoDeItem(gasto)}
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
                  <td className="seguimiento-tabla-monto">{formatMontoDeItem(fila)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td>Total</td>
                <td>{comprasImpagas.length}</td>
                <td className="seguimiento-tabla-monto">
                  {formatMontoDeItem({
                    monto: totales.deudaTotal,
                    montoOtra: totales.deudaTotalOtra,
                    moneda: "ars",
                  })}
                </td>
              </tr>
            </tfoot>
          </table>
        </Seccion>
      )}

      {entidadDetalle && detalle.tipo === "compra" && (
        <ModalDetalleCompra
          compra={entidadDetalle}
          faseNombre={faseNombre}
          proveedorNombre={nombreProveedor(entidadDetalle.proveedor_id)}
          productos={productos}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => onVerComprobanteCompra(entidadDetalle.id, c.id)}
          onVerNota={(n) => onVerNotaCompra(entidadDetalle.id, n.id)}
          onAgregarComprobante={
            canManage && onAgregarComprobanteCompra
              ? (files) => onAgregarComprobanteCompra(entidadDetalle.id, files)
              : undefined
          }
          onEliminarComprobante={
            canManage && onEliminarComprobanteCompra
              ? (id) => onEliminarComprobanteCompra(entidadDetalle.id, id)
              : undefined
          }
          onTogglePago={onTogglePagoCompra ? () => onTogglePagoCompra(entidadDetalle) : undefined}
          onToggleEnvio={
            onToggleEnvioCompra ? () => onToggleEnvioCompra(entidadDetalle) : undefined
          }
          onEditar={
            onEditarCompra
              ? () => {
                  cerrarDetalle();
                  onEditarCompra(entidadDetalle);
                }
              : undefined
          }
          canManage={canManage}
        />
      )}

      {entidadDetalle && detalle.tipo === "gasto" && (
        <ModalDetalleGasto
          gasto={entidadDetalle}
          faseNombre={faseNombre}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => onVerComprobanteGasto(entidadDetalle.id, c.id)}
          onAgregarComprobante={
            canManage && onAgregarComprobanteGasto
              ? (files) => onAgregarComprobanteGasto(entidadDetalle.id, files)
              : undefined
          }
          onEliminarComprobante={
            canManage && onEliminarComprobanteGasto
              ? (id) => onEliminarComprobanteGasto(entidadDetalle.id, id)
              : undefined
          }
          onEditar={
            canManage && onEditarGasto
              ? () => {
                  cerrarDetalle();
                  onEditarGasto(entidadDetalle);
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

export default SeguimientoFase;
