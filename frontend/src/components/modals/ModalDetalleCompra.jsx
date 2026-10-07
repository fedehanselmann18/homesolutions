import { formatMoneda, formatMonedaDual, pluralizar } from "../../utils/formato";
import { leyendaOtraMoneda } from "../../utils/moneda";
import { getTipoFacturaLabel } from "../../constants/tipoFactura";
import {
  getEstadoPagoConAntiguedad,
  getEstadoEnvio,
  getCondicionPagoLabel,
} from "../../constants/estadoCompra";
import { totalNotasCredito, totalNotasDebito } from "../../utils/notas";
import { diasDesde } from "../../utils/seguimiento";
import { OLIVA, ATENCION } from "../../constants/colores";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { SeccionNotas } from "../shared/SeccionNotas";
import { BadgeEstado } from "../shared/BadgeEstado";
import {
  DetalleShell,
  CabeceraMovimiento,
  BandaFaltante,
  SeccionDetalle,
  GrillaDetalles,
  TotalesDetalle,
  ArchivosDetalle,
} from "./PiezasDetalle";

/**
 * Vista de lectura de una Compra (Movimientos v2). El desglose del total
 * (neto, impuestos uno por uno, notas de crédito y de débito) queda completo
 * en el bloque de totales: los importes exactos tienen que poder leerse sin
 * abrir la compra para editarla.
 */
export function ModalDetalleCompra({
  compra,
  faseNombre,
  proveedorNombre,
  usuarioNombre,
  productos = [],
  onCerrar,
  onVerComprobante,
  onVerNota,
  onAgregarComprobante,
  onEliminarComprobante,
  onAgregarNota,
  onEliminarNota,
  onTogglePago,
  onToggleEnvio,
  onEditar,
  onEliminar,
  canManage = false,
}) {
  const pagado = compra.estado_pago === "pagado";
  const entregado = compra.estado_envio === "entregado";
  const dias = diasDesde(compra.fecha, new Date());
  const estadoPago = getEstadoPagoConAntiguedad(compra.estado_pago, dias);
  const estadoEnvio = getEstadoEnvio(compra.estado_envio);
  const puedeTogglear = canManage;

  // Qué producto (y cuánto) devuelve cada nota: sin esto una nota de crédito
  // es sólo un monto suelto y no se sabe sobre qué línea de la compra cae.
  const nombreProducto = (productoId) => {
    const producto = productos.find((p) => p.id === productoId);
    return producto ? `${producto.marca} ${producto.modelo}` : null;
  };
  const resolverProducto = (detalleCompraId) => {
    const linea = compra.detalle?.find((d) => d.id === detalleCompraId);
    return linea ? nombreProducto(linea.producto_id) : null;
  };

  const impuestos = compra.impuestos_aplicados ?? [];
  const notas = compra.notas ?? [];
  const notasCredito = totalNotasCredito(notas);
  const notasDebito = totalNotasDebito(notas);
  const comprobantes = compra.comprobantes ?? [];
  // La compra se paga en pesos: pesos principal y USD congelado entre
  // paréntesis. Los impuestos heredan la cotización de la compra; cada nota
  // trae la suya (por eso el USD del total no es total en pesos / cotización).
  const usd = (ars) => Number(ars) / Number(compra.cotizacion_dolar);
  const dual = (ars, usdCongelado) =>
    formatMonedaDual(ars, usdCongelado ?? usd(ars), { principal: "ars" });

  const titulosEstado = {
    pago: pagado ? "Pagado" : `Impaga hace ${pluralizar(dias, "día")}`,
    envio: entregado ? "Entregado" : "Sin entregar",
  };

  return (
    <DetalleShell
      tipo={TIPOS_MOVIMIENTO.compra.singular}
      icono={TIPOS_MOVIMIENTO.compra.icono}
      fecha={compra.fecha}
      titulo={compra.descripcion}
      onCerrar={onCerrar}
      onEditar={canManage ? onEditar : undefined}
      onEliminar={canManage ? onEliminar : undefined}
      accionPrimaria={
        canManage && !pagado && onTogglePago
          ? { texto: "Marcar pagado", onClick: onTogglePago }
          : undefined
      }
    >
      <CabeceraMovimiento
        titulo={compra.descripcion}
        monto={compra.precio_total_ars}
        secundario={leyendaOtraMoneda(compra.precio_total_usd, "usd", compra)}
        badges={
          <>
            <BadgeEstado
              estado={estadoPago}
              titulo={
                puedeTogglear
                  ? `${titulosEstado.pago} — ${pagado ? "marcar sin pagar" : "marcar pagado"}`
                  : titulosEstado.pago
              }
              onToggle={puedeTogglear ? onTogglePago : undefined}
            />
            <BadgeEstado
              estado={estadoEnvio}
              titulo={
                puedeTogglear
                  ? `${titulosEstado.envio} — ${entregado ? "marcar sin entregar" : "marcar entregado"}`
                  : titulosEstado.envio
              }
              onToggle={puedeTogglear ? onToggleEnvio : undefined}
            />
          </>
        }
      />

      {comprobantes.length === 0 && (
        <BandaFaltante
          texto="Falta adjuntar la factura o el remito"
          onAgregar={onAgregarComprobante}
        />
      )}

      <SeccionDetalle titulo="Detalles">
        <GrillaDetalles
          campos={[
            faseNombre && { label: "Fase", valor: faseNombre },
            proveedorNombre && { label: "Proveedor", valor: proveedorNombre },
            { label: "Condición de pago", valor: getCondicionPagoLabel(compra.condicion_pago) },
            { label: "Pago", valor: titulosEstado.pago, punto: estadoPago.color },
            { label: "Envío", valor: titulosEstado.envio, punto: estadoEnvio.color },
            {
              label: "Comprobante",
              valor: getTipoFacturaLabel(compra.tipo_factura),
              punto: comprobantes.length > 0 ? OLIVA : ATENCION,
            },
            compra.categorias?.length > 0 && {
              label: "Categorías",
              valor: compra.categorias.map((c) => c.nombre).join(", "),
            },
            usuarioNombre && { label: "Cargado por", valor: usuarioNombre },
          ]}
        />
      </SeccionDetalle>

      <SeccionDetalle
        titulo={compra.detalle?.length ? pluralizar(compra.detalle.length, "producto") : "Total"}
      >
        {compra.detalle?.length > 0 && (
          <div className="detalle__productos">
            {compra.detalle.map((d) => {
              const subtotal = (Number(d.cantidad) || 0) * (Number(d.precio_unitario) || 0);
              return (
                <div key={d.id} className="detalle__producto">
                  <span className="detalle__producto-nombre">
                    {nombreProducto(d.producto_id) ?? "Producto eliminado"}
                  </span>
                  <span className="detalle__producto-cantidad">×{d.cantidad}</span>
                  <span className="detalle__producto-subtotal">{formatMoneda(subtotal)}</span>
                </div>
              );
            })}
          </div>
        )}

        <TotalesDetalle
          filas={[
            { label: "Neto", valor: dual(compra.precio_neto_ars, compra.precio_neto_usd) },
            ...(impuestos.length > 0
              ? impuestos.map((i) => ({
                  label: i.impuesto?.nombre ?? "Impuesto",
                  valor: dual(i.monto),
                }))
              : [{ label: "Impuestos", valor: formatMoneda(0) }]),
            notasCredito > 0 && {
              label: "Notas de crédito",
              valor: `-${dual(notasCredito, totalNotasCredito(notas, "usd"))}`,
              variante: "resta",
            },
            notasDebito > 0 && {
              label: "Notas de débito",
              valor: `+${dual(notasDebito, totalNotasDebito(notas, "usd"))}`,
              variante: "suma",
            },
            {
              label: "Total",
              valor: dual(compra.precio_total_ars, compra.precio_total_usd),
              variante: "total",
            },
          ].filter(Boolean)}
        />
      </SeccionDetalle>

      <ArchivosDetalle
        comprobantes={comprobantes}
        onVer={onVerComprobante}
        onAgregar={onAgregarComprobante}
        onEliminar={onEliminarComprobante}
      />

      <SeccionNotas
        notas={notas}
        contexto="compra"
        resolverProducto={resolverProducto}
        onVer={onVerNota}
        onAgregar={onAgregarNota}
        onEliminar={onEliminarNota}
        canManage={canManage}
      />
    </DetalleShell>
  );
}

export default ModalDetalleCompra;
