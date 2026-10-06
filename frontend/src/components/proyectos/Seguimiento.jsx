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

import { useAccionesProyecto } from "../../hooks/useAccionesProyecto";
import useAuth from "../../context/useAuth";

import { TarjetaAlerta } from "../shared/TarjetaAlerta";
import { TarjetaKpi } from "../shared/TarjetaKpi";
import { TarjetaMiniSeguimiento } from "../shared/TarjetaMiniSeguimiento";
import { EstadoVacio } from "../shared/EstadoVacio";
import { EstadoError } from "../shared/EstadoError";
import { Cargando } from "../shared/Cargando";
import { ModalDetalleCompra } from "../modals/ModalDetalleCompra";
import { ModalDetalleGasto } from "../modals/ModalDetalleGasto";
import { ModalDetalleCobro } from "../modals/ModalDetalleCobro";
import ModalCompra from "../modals/ModalCompra";
import ModalGasto from "../modals/ModalGasto";
import ModalCobro from "../modals/ModalCobro";
import { calcularSeguimiento, DIAS_FASE_ESTANCADA } from "../../utils/seguimiento";
import { formatMoneda, formatFecha, pluralizar } from "../../utils/formato";
import { formatMontoDeItem } from "../../utils/moneda";
import { getCondicionPagoLabel } from "../../constants/estadoCompra";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import { VERDE, ROJO, NARANJA, GRIS } from "../../constants/colores";
import "./Seguimiento.css";

const diasTexto = (dias) => `hace ${pluralizar(dias, "día")}`;

function Seccion({ titulo, descripcion, cantidad, children }) {
  return (
    <section className="seguimiento-seccion">
      <div className="seguimiento-seccion-header">
        <h3 className="seguimiento-seccion-titulo">
          <AlertTriangle className="seguimiento-seccion-icono" size={20} strokeWidth={2.25} />
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

export function Seguimiento({ proyectoId, onIrATab }) {
  // Se guarda el id y no la entidad: desde acá se puede togglear pago/envío y
  // subir comprobantes, y eso recarga las queries -- una copia congelada del
  // objeto seguiría mostrando el estado viejo dentro del modal abierto.
  const [detalle, setDetalle] = useState(null); // { tipo: "compra" | "gasto" | "cobro", id }
  const [editando, setEditando] = useState(null); // { tipo, entidad } | null

  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";

  // Seguimiento es la pantalla de "lo que falta": compras sin pagar, sin
  // entregar y movimientos sin comprobante. Poder resolverlo desde la misma
  // ficha evita el rodeo de ir a Acciones a buscar el mismo movimiento.
  // Reusa el hook de Acciones -- comparten las query keys, así que React
  // Query dedupea y una mutación acá refresca las dos pestañas.
  const acciones = useAccionesProyecto(proyectoId);

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
    proyectoQuery.error ||
    fasesQuery.error ||
    gastosQuery.error ||
    cobrosQuery.error ||
    comprasQuery.error;

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
    return <EstadoError mensaje="No se pudieron cargar los datos del seguimiento." grande />;
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
  const nombreProveedor = (proveedorId) =>
    datos.proveedores.find((p) => p.id === proveedorId)?.nombre;

  const abrirDetalleCompra = (compraId) => setDetalle({ tipo: "compra", id: compraId });
  const abrirDetalleGasto = (gastoId) => setDetalle({ tipo: "gasto", id: gastoId });
  const abrirDetalleCobro = (cobroId) => setDetalle({ tipo: "cobro", id: cobroId });

  const cerrarDetalle = () => setDetalle(null);

  // La entidad se re-lee de la colección en cada render, así el modal
  // muestra el estado de después de togglear o subir un comprobante.
  const coleccionPorTipo = {
    compra: datos.compras,
    gasto: datos.gastos,
    cobro: datos.cobros,
  };
  const entidadDetalle = detalle
    ? coleccionPorTipo[detalle.tipo].find((e) => e.id === detalle.id)
    : null;

  // Editar cierra la ficha y abre el modal de edición del mismo movimiento.
  const abrirEdicion = (tipo, entidad) => {
    cerrarDetalle();
    setEditando({ tipo, entidad });
  };
  const cerrarEdicion = () => setEditando(null);

  const guardarEdicion = async (datosForm, comprobantesCambios) => {
    const { tipo, entidad } = editando;
    try {
      if (tipo === "compra") await acciones.guardarCompra(entidad, datosForm, comprobantesCambios);
      else if (tipo === "gasto")
        await acciones.guardarGasto(entidad, datosForm, comprobantesCambios);
      else await acciones.guardarCobro(entidad, datosForm, comprobantesCambios);
      cerrarEdicion();
    } catch {
      // el hook ya mostró el toast de error
    }
  };

  return (
    <div className="seguimiento">
      <Seccion
        titulo="Cobro del proyecto"
        descripcion={
          cobranza.ultimoCobro
            ? `${pluralizar(cobranza.cantidadCobros, "cobro registrado", "cobros registrados")} · último ${diasTexto(cobranza.ultimoCobro.dias)}`
            : "Todavía no se cargó ningún cobro"
        }
      >
        <div className="seguimiento-cobranza">
          <TarjetaKpi
            titulo="Precio acordado"
            valor={formatMoneda(cobranza.precioAcordado, "usd")}
          />
          <TarjetaKpi
            titulo="Cobrado"
            valor={formatMoneda(cobranza.cobrado, "usd")}
            porcentaje={cobranza.pctCobrado}
            detalle={`${cobranza.pctCobrado.toFixed(1)}% de lo acordado`}
          />
          <TarjetaKpi
            titulo="Queda por cobrar"
            valor={formatMoneda(cobranza.pendiente, "usd")}
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
                {pluralizar(
                  comprasSinEntregar.length,
                  "pedido que no te entregaron",
                  "pedidos que no te entregaron"
                )}
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
                {pluralizar(
                  comprasSinComprobante.length,
                  "compra que no tiene comprobante adjunto",
                  "compras que no tienen comprobante adjunto"
                )}
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

      <Seccion
        titulo="Cobros sin comprobante"
        descripcion={
          cobrosSinComprobante.length > 0
            ? `${formatMontoDeItem({
                monto: totales.montoCobrosSinComprobante,
                montoOtra: totales.montoCobrosSinComprobanteOtra,
                moneda: "usd",
              })} sin respaldo cargado`
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
                monto={formatMontoDeItem(cobro)}
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
          <EstadoVacio mensaje="Ninguna fase quedó frenada." />
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
        <Seccion
          titulo="Deuda por proveedor"
          descripcion="Sumando las compras impagas del proyecto"
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
          faseNombre={nombreFase(entidadDetalle.fase_id)}
          proveedorNombre={nombreProveedor(entidadDetalle.proveedor_id)}
          productos={datos.productos}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteCompra(entidadDetalle.id, c.id)}
          onVerNota={(n) => getNotaCompra(entidadDetalle.id, n.id)}
          onAgregarComprobante={
            canManage
              ? (files) => acciones.agregarComprobantesCompra(entidadDetalle.id, files)
              : undefined
          }
          onEliminarComprobante={
            canManage
              ? (id) => acciones.eliminarComprobanteCompra(entidadDetalle.id, id)
              : undefined
          }
          onTogglePago={() => acciones.toggleEstadoPagoCompra(entidadDetalle)}
          onToggleEnvio={() => acciones.toggleEstadoEnvioCompra(entidadDetalle)}
          onEditar={() => abrirEdicion("compra", entidadDetalle)}
          canManage={canManage}
        />
      )}

      {entidadDetalle && detalle.tipo === "gasto" && (
        <ModalDetalleGasto
          gasto={entidadDetalle}
          faseNombre={entidadDetalle.fase_id ? nombreFase(entidadDetalle.fase_id) : null}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteGasto(entidadDetalle.id, c.id)}
          onAgregarComprobante={
            canManage
              ? (files) => acciones.agregarComprobantesGasto(entidadDetalle.id, files)
              : undefined
          }
          onEliminarComprobante={
            canManage ? (id) => acciones.eliminarComprobanteGasto(entidadDetalle.id, id) : undefined
          }
          onEditar={canManage ? () => abrirEdicion("gasto", entidadDetalle) : undefined}
        />
      )}

      {entidadDetalle && detalle.tipo === "cobro" && (
        <ModalDetalleCobro
          cobro={entidadDetalle}
          onCerrar={cerrarDetalle}
          onVerComprobante={(c) => getComprobanteCobro(entidadDetalle.id, c.id)}
          onVerNota={(n) => getNotaCobro(entidadDetalle.id, n.id)}
          onAgregarComprobante={
            canManage
              ? (files) => acciones.agregarComprobantesCobro(entidadDetalle.id, files)
              : undefined
          }
          onEliminarComprobante={
            canManage ? (id) => acciones.eliminarComprobanteCobro(entidadDetalle.id, id) : undefined
          }
          onEditar={() => abrirEdicion("cobro", entidadDetalle)}
          canManage={canManage}
        />
      )}

      {editando?.tipo === "compra" && (
        <ModalCompra
          compra={editando.entidad}
          fasesDisponibles={datos.fases}
          proveedores={datos.proveedores}
          productosDisponibles={datos.productos}
          impuestosDisponibles={acciones.impuestos}
          onGuardar={guardarEdicion}
          onCerrar={cerrarEdicion}
          onVerComprobante={(c) => getComprobanteCompra(editando.entidad.id, c.id)}
          onVerNota={(n) => getNotaCompra(editando.entidad.id, n.id)}
        />
      )}

      {editando?.tipo === "gasto" && (
        <ModalGasto
          gasto={editando.entidad}
          categoriasDisponibles={acciones.categoriasGasto}
          fasesDisponibles={datos.fases}
          onGuardar={guardarEdicion}
          onCerrar={cerrarEdicion}
          onVerComprobante={(c) => getComprobanteGasto(editando.entidad.id, c.id)}
        />
      )}

      {editando?.tipo === "cobro" && (
        <ModalCobro
          cobro={editando.entidad}
          onGuardar={guardarEdicion}
          onCerrar={cerrarEdicion}
          onVerComprobante={(c) => getComprobanteCobro(editando.entidad.id, c.id)}
          onVerNota={(n) => getNotaCobro(editando.entidad.id, n.id)}
        />
      )}
    </div>
  );
}

export default Seguimiento;
