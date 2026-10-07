import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, HandCoins, Layers, Paperclip } from "lucide-react";

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
import { useToast } from "../../context/useToast";

import { BadgeEstado } from "../shared/BadgeEstado";
import { EstadoVacio } from "../shared/EstadoVacio";
import { EstadoError } from "../shared/EstadoError";
import { Cargando } from "../shared/Cargando";
import { ModalDetalleCompra } from "../modals/ModalDetalleCompra";
import { ModalDetalleGasto } from "../modals/ModalDetalleGasto";
import { ModalDetalleCobro } from "../modals/ModalDetalleCobro";
import ModalCompra from "../modals/ModalCompra";
import ModalGasto from "../modals/ModalGasto";
import ModalCobro from "../modals/ModalCobro";
import { calcularSeguimiento, armarBandeja } from "../../utils/seguimiento";
import { formatMoneda } from "../../utils/formato";
import { formatMontoDeItem } from "../../utils/moneda";
import { obtenerDetalleBackend } from "../../utils/errorHandling";
import {
  DIAS_DEUDA_VENCIDA,
  getEstadoEnvio,
  getEstadoPago,
  getEstadoPagoConAntiguedad,
} from "../../constants/estadoCompra";
import { TIPOS_MOVIMIENTO } from "../../constants/tipoMovimiento";
import { NARANJA, NARANJA_TINT, NARANJA_TEXTO, TINTA_MUTED, BASE_2 } from "../../constants/colores";
import "./Seguimiento.css";

// El badge de cada item de la bandeja, con la forma de estadoCompra.js para
// que lo pinte BadgeEstado: el de pago y el de envío son los mismos del libro
// de obra; los otros tres son propios de esta lista.
const ATENCION = { color: NARANJA, bg: NARANJA_TINT, fg: NARANJA_TEXTO };
function estadoDeItem(item) {
  switch (item.estado) {
    case "impaga":
      // Desde DIAS_DEUDA_VENCIDA el par rojo de estadoCompra; antes, el
      // ámbar de "a pagar" pero con los días, que es lo que ordena la lista.
      return item.dias >= DIAS_DEUDA_VENCIDA
        ? getEstadoPagoConAntiguedad("pendiente", item.dias)
        : {
            ...getEstadoPago("pendiente"),
            label: item.dias > 1 ? `${item.dias} días sin pagar` : "A pagar",
          };
    case "sinEntregar":
      return getEstadoEnvio("pedido");
    case "sinComprobante":
      return { ...ATENCION, label: "Sin comprobante", icono: Paperclip };
    case "estancada":
      return { ...ATENCION, label: `${item.dias} días sin cambios`, icono: Clock };
    default:
      return {
        color: TINTA_MUTED,
        bg: BASE_2,
        fg: TINTA_MUTED,
        label: "Por cobrar",
        icono: HandCoins,
      };
  }
}

const ICONO_TIPO = {
  compra: TIPOS_MOVIMIENTO.compra.icono,
  gasto: TIPOS_MOVIMIENTO.gasto.icono,
  cobro: TIPOS_MOVIMIENTO.cobro.icono,
  cobranza: TIPOS_MOVIMIENTO.cobro.icono,
  fase: Layers,
};

const TEXTO_ACCION = {
  pagar: "Registrar pago",
  entregar: "Marcar entregado",
  adjuntar: "Adjuntar",
  cobrar: "Registrar cobro",
  verFase: "Ver fase",
};

export function Seguimiento({ proyectoId }) {
  // Se guarda el id y no la entidad: desde acá se puede togglear pago/envío y
  // subir comprobantes, y eso recarga las queries -- una copia congelada del
  // objeto seguiría mostrando el estado viejo dentro del modal abierto.
  const [detalle, setDetalle] = useState(null); // { tipo: "compra" | "gasto" | "cobro", id }
  const [editando, setEditando] = useState(null); // { tipo, entidad } | null

  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";
  const toast = useToast();
  const navigate = useNavigate();

  // Un solo <input type="file"> para todos los "Adjuntar" de la lista: se
  // anota a qué movimiento va y se abre el selector del sistema.
  const inputAdjuntarRef = useRef(null);
  const [adjuntarA, setAdjuntarA] = useState(null); // { tipo, id }
  const [ocupado, setOcupado] = useState(null); // key del item en curso

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

  const { cobranza, comprasSinComprobante, gastosSinComprobante, cobrosSinComprobante, totales } =
    seguimiento;
  const grupos = armarBandeja(seguimiento, { diasVencida: DIAS_DEUDA_VENCIDA });
  const cantidadSinComprobante =
    comprasSinComprobante.length + gastosSinComprobante.length + cobrosSinComprobante.length;

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

  const compraPorId = (id) => datos.compras.find((c) => c.id === id);
  const agregarComprobantes = {
    compra: acciones.agregarComprobantesCompra,
    gasto: acciones.agregarComprobantesGasto,
    cobro: acciones.agregarComprobantesCobro,
  };

  const ejecutar = async (item) => {
    if (item.accion === "adjuntar") {
      setAdjuntarA({ tipo: item.tipo, id: item.id, key: item.key });
      inputAdjuntarRef.current?.click();
      return;
    }
    if (item.accion === "cobrar") return setEditando({ tipo: "cobro", entidad: null });
    if (item.accion === "verFase") return navigate(`/proyectos/${proyectoId}/fases/${item.id}`);

    setOcupado(item.key);
    try {
      if (item.accion === "pagar") await acciones.toggleEstadoPagoCompra(compraPorId(item.id));
      else await acciones.toggleEstadoEnvioCompra(compraPorId(item.id));
    } catch {
      // el hook ya mostró el toast de error
    } finally {
      setOcupado(null);
    }
  };

  const subirAdjuntos = async (files) => {
    if (!adjuntarA || !files?.length) return;
    setOcupado(adjuntarA.key);
    try {
      await agregarComprobantes[adjuntarA.tipo](adjuntarA.id, files);
    } catch (err) {
      toast.error(obtenerDetalleBackend(err) ?? "No se pudo adjuntar el comprobante.");
    } finally {
      setOcupado(null);
      setAdjuntarA(null);
    }
  };

  const abrirItem = (item) => {
    if (item.tipo === "compra") abrirDetalleCompra(item.id);
    else if (item.tipo === "gasto") abrirDetalleGasto(item.id);
    else if (item.tipo === "cobro") abrirDetalleCobro(item.id);
    else if (item.tipo === "fase") navigate(`/proyectos/${proyectoId}/fases/${item.id}`);
  };

  return (
    <div className="seguimiento">
      {/* Variante 4f: tres cifras arriba y una sola lista por urgencia, cada
          item con la acción que lo resuelve ahí mismo. */}
      <dl className="seguimiento-kpis">
        <div>
          <dt>Por pagar a proveedores</dt>
          <dd>{formatMoneda(totales.deudaTotal, "ars")}</dd>
        </div>
        <div>
          <dt>Por cobrar</dt>
          <dd>{formatMoneda(cobranza.pendiente, "usd")}</dd>
        </div>
        <div>
          <dt>Sin comprobante</dt>
          <dd>{cantidadSinComprobante}</dd>
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

      {grupos.length === 0 ? (
        <EstadoVacio mensaje="No hay nada pendiente en este proyecto." />
      ) : (
        <div className="bandeja">
          {grupos.map((grupo) => (
            <section key={grupo.clave} className="bandeja__grupo" aria-label={grupo.label}>
              <h3 className={`bandeja__titulo bandeja__titulo--${grupo.clave}`}>
                <span className="bandeja__punto" aria-hidden="true" />
                {grupo.label}
                <span className="bandeja__cantidad">{grupo.items.length}</span>
              </h3>
              <ul className="bandeja__lista">
                {grupo.items.map((item) => {
                  const Icono = ICONO_TIPO[item.tipo];
                  const abre = item.tipo !== "cobranza";
                  return (
                    <li
                      key={item.key}
                      className={`bandeja__item${abre ? " bandeja__item--abre" : ""}`}
                      onClick={abre ? () => abrirItem(item) : undefined}
                    >
                      <span className="bandeja__icono" aria-hidden="true">
                        <Icono size={15} strokeWidth={1.75} />
                      </span>
                      <span className="bandeja__texto">
                        {abre ? (
                          <button
                            type="button"
                            className="bandeja__titulo-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              abrirItem(item);
                            }}
                          >
                            {item.titulo}
                          </button>
                        ) : (
                          <span className="bandeja__titulo-item">{item.titulo}</span>
                        )}
                        <span className="bandeja__subtitulo">{item.subtitulo}</span>
                      </span>
                      <span className="bandeja__estado">
                        <BadgeEstado estado={estadoDeItem(item)} chico />
                      </span>
                      <span className="bandeja__monto">
                        {item.monto ? formatMontoDeItem(item.monto) : ""}
                      </span>
                      <span className="bandeja__accion">
                        {canManage && (
                          <button
                            type="button"
                            className="btn btn--sm btn-secondary"
                            disabled={ocupado === item.key}
                            onClick={(e) => {
                              e.stopPropagation();
                              ejecutar(item);
                            }}
                          >
                            {TEXTO_ACCION[item.accion]}
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
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
          proyectoActual={datos.proyecto}
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
