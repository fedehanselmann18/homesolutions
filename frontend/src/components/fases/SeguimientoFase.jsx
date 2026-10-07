import { useMemo, useRef, useState } from "react";

import { calcularSeguimiento, armarBandeja } from "../../utils/seguimiento";
import { formatMoneda } from "../../utils/formato";
import { obtenerDetalleBackend } from "../../utils/errorHandling";
import { DIAS_DEUDA_VENCIDA } from "../../constants/estadoCompra";
import { useToast } from "../../context/useToast";
import { Bandeja } from "../shared/Bandeja";
import { ModalDetalleCompra } from "../modals/ModalDetalleCompra";
import { ModalDetalleGasto } from "../modals/ModalDetalleGasto";
import "../proyectos/Seguimiento.css";

/**
 * Tab "Seguimiento de la fase" de FaseDetalle.jsx: la misma pantalla que el
 * Seguimiento del proyecto (variante 4f, tres cifras y la bandeja por
 * urgencia), acotada a las compras y gastos de la fase. Reusa
 * calcularSeguimiento y armarBandeja tal cual, sin cobros, fases ni proyecto:
 * una fase no cobra, así que no hay "Saldo del contrato" ni "Ver fase".
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

  const toast = useToast();
  // Un solo <input type="file"> para todos los "Adjuntar": se anota a qué
  // movimiento va y se abre el selector del sistema (igual que en el proyecto).
  const inputAdjuntarRef = useRef(null);
  const [adjuntarA, setAdjuntarA] = useState(null); // { tipo, id, key }
  const [ocupado, setOcupado] = useState(null); // key del item en curso

  const { comprasSinEntregar, comprasSinComprobante, gastosSinComprobante, totales } = seguimiento;
  const grupos = armarBandeja(seguimiento, { diasVencida: DIAS_DEUDA_VENCIDA });

  const nombreProveedor = (proveedorId) => proveedores.find((p) => p.id === proveedorId)?.nombre;
  const compraPorId = (id) => comprasFase.find((c) => c.id === id);

  const abrirItem = (item) => setDetalle({ tipo: item.tipo, id: item.id });

  const agregarComprobantes = {
    compra: onAgregarComprobanteCompra,
    gasto: onAgregarComprobanteGasto,
  };

  const ejecutar = async (item) => {
    if (item.accion === "adjuntar") {
      setAdjuntarA({ tipo: item.tipo, id: item.id, key: item.key });
      inputAdjuntarRef.current?.click();
      return;
    }
    const toggle = item.accion === "pagar" ? onTogglePagoCompra : onToggleEnvioCompra;
    if (!toggle) return;
    setOcupado(item.key);
    try {
      await toggle(compraPorId(item.id));
    } finally {
      setOcupado(null);
    }
  };

  const subirAdjuntos = async (files) => {
    const agregar = adjuntarA && agregarComprobantes[adjuntarA.tipo];
    if (!agregar || !files?.length) return;
    setOcupado(adjuntarA.key);
    try {
      await agregar(adjuntarA.id, files);
    } catch (err) {
      toast.error(obtenerDetalleBackend(err) ?? "No se pudo adjuntar el comprobante.");
    } finally {
      setOcupado(null);
      setAdjuntarA(null);
    }
  };

  return (
    <div className="seguimiento">
      <dl className="seguimiento-kpis">
        <div>
          <dt>Por pagar en la fase</dt>
          <dd>{formatMoneda(totales.deudaTotal, "ars")}</dd>
        </div>
        <div>
          <dt>Sin entregar</dt>
          <dd>{comprasSinEntregar.length}</dd>
        </div>
        <div>
          <dt>Sin comprobante</dt>
          <dd>{comprasSinComprobante.length + gastosSinComprobante.length}</dd>
        </div>
      </dl>

      {canManage && (
        <input
          ref={inputAdjuntarRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            subirAdjuntos(e.target.files);
            e.target.value = "";
          }}
        />
      )}

      <Bandeja
        grupos={grupos}
        canManage={canManage}
        ocupado={ocupado}
        onAbrir={abrirItem}
        onEjecutar={ejecutar}
        mensajeVacio="No hay nada pendiente en esta fase."
      />

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
