import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  AlertTriangle,
  Building2,
  FileMinus,
  FilePlus,
  IdCard,
  Mail,
  MapPin,
  MoreHorizontal,
  Paperclip,
  Pencil,
  Phone,
  Package,
  ShoppingCart,
  Sparkles,
  Tag,
  Trash2,
} from "lucide-react";

import {
  getProveedorPorId,
  actualizarProveedor,
  eliminarProveedor,
} from "../services/proveedorService";
import { obtenerMensajeError } from "../utils/errorHandling";
import {
  getProductosPorProveedor,
  crearProducto,
  actualizarProducto,
  eliminarProducto,
} from "../services/productoService";
// La ficha del proveedor consulta compras, no las carga: crear/editar/borrar
// una compra vive en su proyecto, que es donde hay contexto de fase. Lo único
// que se escribe desde acá son los estados de pago/envío (actualizarCompra).
import {
  getCompras,
  actualizarCompra,
  getComprobanteCompra,
  getNotaCompra,
} from "../services/compraService";
import { getFases } from "../services/faseService";
import { getProyectos } from "../services/proyectoService";
import { getCategorias } from "../services/categoriaService";

import useAuth from "../context/useAuth";
import { getTipoProducto } from "../constants/tipoProducto";
import { OLIVA, ERROR } from "../constants/colores";
import { getEstadoPagoConVencimiento, getEstadoEnvio } from "../constants/estadoCompra";
import { diasVencida } from "../utils/plazos";
import { useEtiquetaTipoFactura } from "../hooks/useTiposFactura";
import { formatMoneda, formatFecha, pluralizar } from "../utils/formato";
import { precioTotalCompra } from "../utils/moneda";
import { calcularResumenProveedor } from "../utils/proveedores";
import { FILTROS_VACIOS, filtrarCompras } from "../utils/filtros";

import ModalProveedor from "../components/modals/ModalProveedor";
import ModalProducto from "../components/modals/ModalProducto";
import ModalImportarCatalogo from "../components/modals/ModalImportarCatalogo";
import ModalDetalleCompra from "../components/modals/ModalDetalleCompra";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import { Cargando } from "../components/shared/Cargando";
import { EstadoVacio } from "../components/shared/EstadoVacio";
import { EstadoError } from "../components/shared/EstadoError";
import FiltrosLista from "../components/shared/FiltrosLista";
import { Breadcrumbs } from "../components/shared/Breadcrumbs";
import { Tabs } from "../components/shared/Tabs";
import { BadgeEstado } from "../components/shared/BadgeEstado";
import { Avatar } from "../components/proveedores/ProveedorItems";
import { useToast } from "../context/useToast";
import { usePageTitle } from "../hooks/usePageTitle";

import "./ProveedorDetalle.css";

// Detalle de proveedor — variante 4P de HS General.dc.html
// ("Ficha lateral · Historial de compras"): la ficha del proveedor es una
// columna fija del layout a la izquierda (no un drawer, DESIGN.md §15) y el
// contenido son dos tabs, Catálogo e Historial de compras.

/** El "⋯" de la ficha: hoy sólo tiene "Eliminar proveedor", que no merece un
 * botón rojo a la vista al lado de Editar. Se cierra con click afuera o Esc. */
function MenuMas({ items }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const cerrarAfuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    const cerrarConEsc = (e) => e.key === "Escape" && setAbierto(false);
    document.addEventListener("mousedown", cerrarAfuera);
    document.addEventListener("keydown", cerrarConEsc);
    return () => {
      document.removeEventListener("mousedown", cerrarAfuera);
      document.removeEventListener("keydown", cerrarConEsc);
    };
  }, [abierto]);

  return (
    <div className="menu-mas" ref={ref}>
      <button
        type="button"
        className="btn-icono btn-icono--contorno"
        aria-label="Más acciones"
        aria-haspopup="menu"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
      {abierto && (
        <div className="menu-mas__lista" role="menu">
          {items.map(({ texto, icono: Icono, peligro, onClick }) => (
            <button
              key={texto}
              type="button"
              role="menuitem"
              className={`menu-mas__item${peligro ? " menu-mas__item--peligro" : ""}`}
              onClick={() => {
                setAbierto(false);
                onClick();
              }}
            >
              {Icono && <Icono size={14} strokeWidth={1.75} aria-hidden="true" />}
              {texto}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Una compra del historial: cuadradito de fecha, título, obra y meta, estados. */
function FilaCompra({ compra, proyecto, canManage, onAbrir, onTogglePago, onToggleEnvio }) {
  const etiquetaFactura = useEtiquetaTipoFactura();
  const fecha = new Date(`${compra.fecha}T00:00:00`);
  const vencida = diasVencida(compra, new Date());
  const pagado = compra.estado_pago === "pagado";
  const entregado = compra.estado_envio === "entregado";
  const tieneComprobante = (compra.comprobantes ?? []).length > 0;
  const meta = [
    etiquetaFactura(compra.tipo_factura),
    compra.detalle?.length ? pluralizar(compra.detalle.length, "producto") : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const titulo = (texto, accion) => (canManage ? `${texto} — ${accion}` : texto);
  const detener = (fn) => (e) => {
    e.stopPropagation();
    fn();
  };

  return (
    <div
      className="historial-fila"
      onClick={onAbrir}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onAbrir();
        }
      }}
      role="link"
      tabIndex={0}
      aria-label={compra.descripcion}
    >
      <span className="historial-fila__fecha" aria-label={formatFecha(compra.fecha)}>
        <span className="historial-fila__dia">{String(fecha.getDate()).padStart(2, "0")}</span>
        <span className="historial-fila__mes">
          {fecha.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}
        </span>
      </span>
      <span className="historial-fila__titulo">{compra.descripcion}</span>
      <span className="historial-fila__monto cifra">
        {formatMoneda(precioTotalCompra(compra, "ars"))}
      </span>
      <span className="historial-fila__meta">
        {proyecto && (
          <span className="historial-fila__proyecto">
            <Building2 size={13} strokeWidth={1.75} aria-hidden="true" />
            {proyecto}
          </span>
        )}
        {meta}
        {tieneComprobante ? (
          <Paperclip
            className="historial-fila__clip"
            size={14}
            strokeWidth={1.75}
            aria-label="Con comprobante"
          />
        ) : (
          <AlertTriangle
            className="historial-fila__falta"
            size={14}
            strokeWidth={1.75}
            aria-label="Falta el comprobante"
          />
        )}
      </span>
      <span className="historial-fila__estados">
        <BadgeEstado
          chico
          estado={getEstadoPagoConVencimiento(compra.estado_pago, vencida)}
          titulo={titulo(
            pagado ? "Pagado" : vencida ? `Vencida hace ${pluralizar(vencida, "día")}` : "A pagar",
            pagado ? "marcar sin pagar" : "marcar pagado"
          )}
          onToggle={canManage ? detener(onTogglePago) : undefined}
        />
        <BadgeEstado
          chico
          estado={getEstadoEnvio(compra.estado_envio)}
          titulo={titulo(
            entregado ? "Entregado" : "Sin entregar",
            entregado ? "marcar sin entregar" : "marcar entregado"
          )}
          onToggle={canManage ? detener(onToggleEnvio) : undefined}
        />
      </span>
    </div>
  );
}

export function ProveedorDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";
  const toast = useToast();

  const [proveedor, setProveedor] = useState(null);
  usePageTitle(proveedor?.nombre);
  const [productos, setProductos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [fases, setFases] = useState([]);
  const [proyectos, setProyectos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [modalProveedorAbierto, setModalProveedorAbierto] = useState(false);
  const [modalProductoAbierto, setModalProductoAbierto] = useState(false);
  const [productoEditando, setProductoEditando] = useState(null);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);

  // Se guarda el id y no la compra: togglear pago/envío desde el modal
  // recarga `compras`, y una copia congelada del objeto seguiría mostrando
  // el estado viejo.
  const [detalleCompraId, setDetalleCompraId] = useState(null);

  const [filtrosCompras, setFiltrosCompras] = useState(FILTROS_VACIOS);

  const [tab, setTab] = useState("catalogo");
  const [confirmarEliminarProveedor, setConfirmarEliminarProveedor] = useState(false);
  const [productoAEliminar, setProductoAEliminar] = useState(null);

  useEffect(() => {
    fetchTodo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fetchTodo = async () => {
    try {
      setCargando(true);
      setError(null);
      const [proveedorData, productosData, comprasData, fasesData, proyectosData, categoriasData] =
        await Promise.all([
          getProveedorPorId(id),
          getProductosPorProveedor(id),
          getCompras(),
          getFases(),
          getProyectos(),
          getCategorias(),
        ]);
      setProveedor(proveedorData);
      setProductos(productosData);
      setCompras(comprasData);
      setFases(fasesData);
      setProyectos(proyectosData);
      setCategorias(categoriasData);
    } catch (err) {
      console.error("Error fetching detalle de proveedor:", err);
      setError(err);
    } finally {
      setCargando(false);
    }
  };

  const refetchProductos = async () => {
    setProductos(await getProductosPorProveedor(id));
  };

  // Los modales pueden crear una categoría sin salir del modal (ver
  // ChipsCategorias) -- hay que refrescar la lista para que aparezca como
  // chip elegible ahí mismo.
  const refetchCategorias = async () => {
    setCategorias(await getCategorias());
  };

  const refetchCompras = async () => {
    setCompras(await getCompras());
  };

  const resumen = useMemo(
    () => calcularResumenProveedor(proveedor ?? { id }, { productos, compras }),
    [proveedor, id, productos, compras]
  );

  const nombreProyecto = (proyectoId) => proyectos.find((p) => p.id === proyectoId)?.nombre;
  const nombreFase = (faseId) => fases.find((f) => f.id === faseId)?.nombre;

  // La Compra guarda fase_id, no proyecto_id (ver models.py): para saber de
  // qué proyecto es hay que pasar por su fase.
  const proyectoDeCompra = useMemo(() => {
    const proyectoPorFase = new Map(fases.map((f) => [f.id, f.proyecto_id]));
    return (compra) => proyectoPorFase.get(compra.fase_id) ?? null;
  }, [fases]);

  const nombreProyectoDeCompra = (compra) => nombreProyecto(proyectoDeCompra(compra));

  // Sólo los proyectos en los que este proveedor tiene alguna compra: ofrecer
  // los 4 del sistema cuando le compraste a uno solo es ruido.
  const proyectosConCompras = useMemo(() => {
    const ids = new Set(resumen.comprasDelProveedor.map(proyectoDeCompra).filter(Boolean));
    return proyectos.filter((p) => ids.has(p.id));
  }, [resumen.comprasDelProveedor, proyectoDeCompra, proyectos]);

  // Las más nuevas arriba.
  const comprasDelProveedorFiltradas = useMemo(
    () =>
      filtrarCompras(resumen.comprasDelProveedor, filtrosCompras, { proyectoDeCompra }).sort(
        (a, b) => b.fecha.localeCompare(a.fecha)
      ),
    [resumen.comprasDelProveedor, filtrosCompras, proyectoDeCompra]
  );

  const compraDetalle = detalleCompraId
    ? resumen.comprasDelProveedor.find((c) => c.id === detalleCompraId)
    : null;

  // --- Proveedor ---
  const handleGuardarProveedor = async (datos) => {
    try {
      const actualizado = await actualizarProveedor(id, datos);
      setProveedor(actualizado);
      setModalProveedorAbierto(false);
    } catch (err) {
      console.error("Error guardando proveedor:", err);
      toast.error(obtenerMensajeError(err));
    }
  };

  const handleConfirmarEliminarProveedor = async () => {
    setConfirmarEliminarProveedor(false);
    try {
      await eliminarProveedor(id);
      navigate("/proveedores");
    } catch (err) {
      console.error("Error eliminando proveedor:", err);
      toast.error("No se pudo eliminar el proveedor.");
    }
  };

  // --- Productos ---
  const handleNuevoProducto = () => {
    setProductoEditando(null);
    setModalProductoAbierto(true);
  };

  const handleEditarProducto = (producto) => {
    setProductoEditando(producto);
    setModalProductoAbierto(true);
  };

  const handleGuardarProducto = async (datosForm) => {
    try {
      if (productoEditando) {
        await actualizarProducto(productoEditando.id, datosForm);
      } else {
        await crearProducto({ ...datosForm, proveedor_id: id });
      }
      setModalProductoAbierto(false);
      setProductoEditando(null);
      refetchProductos();
    } catch (err) {
      console.error("Error guardando producto:", err);
      toast.error("No se pudo guardar el producto.");
    }
  };

  const handleConfirmarEliminarProducto = async () => {
    const productoId = productoAEliminar.id;
    setProductoAEliminar(null);
    try {
      await eliminarProducto(productoId);
      refetchProductos();
    } catch (err) {
      console.error("Error eliminando producto:", err);
      // El backend explica POR QUÉ no se puede (producto ya usado en una
      // compra, RESTRICT de detalle_compra). Con el texto genérico, Agus
      // reintentaba el borrado sin saber que nunca iba a andar.
      toast.error(obtenerMensajeError(err));
    }
  };

  // --- Compras (historial, sólo consulta) ---
  // Marcar pagado/entregado es lo único que se escribe desde acá: es
  // justamente la acción que uno quiere a mano mirando lo que le debe a un
  // proveedor. Crear/editar/borrar la compra sigue viviendo en su proyecto.
  const handleToggleEstadoPagoCompra = async (compra) => {
    try {
      const estado_pago = compra.estado_pago === "pagado" ? "pendiente" : "pagado";
      await actualizarCompra(compra.id, { estado_pago });
      refetchCompras();
    } catch (err) {
      console.error("Error actualizando el estado de pago de la compra:", err);
      toast.error("No se pudo actualizar el estado de pago.");
    }
  };

  const handleToggleEstadoEnvioCompra = async (compra) => {
    try {
      const estado_envio = compra.estado_envio === "entregado" ? "pedido" : "entregado";
      await actualizarCompra(compra.id, { estado_envio });
      refetchCompras();
    } catch (err) {
      console.error("Error actualizando el estado de envío de la compra:", err);
      toast.error("No se pudo actualizar el estado de envío.");
    }
  };

  if (cargando) return <Cargando texto="Cargando proveedor..." />;
  if (error || !proveedor) {
    return <EstadoError mensaje="No se pudo cargar el detalle del proveedor." grande />;
  }

  const rubro = productos.length
    ? getTipoProducto(
        [...productos].sort(
          (a, b) =>
            productos.filter((p) => p.tipo === b.tipo).length -
            productos.filter((p) => p.tipo === a.tipo).length
        )[0].tipo
      ).label
    : null;
  const totalFiltrado = comprasDelProveedorFiltradas.reduce(
    (acc, c) => acc + precioTotalCompra(c, "ars"),
    0
  );
  const contacto = [
    { icono: IdCard, label: "CUIT", valor: proveedor.cuit },
    { icono: Phone, label: "Teléfono", valor: proveedor.telefono },
    { icono: Mail, label: "Email", valor: proveedor.email },
    { icono: MapPin, label: "Dirección", valor: proveedor.direccion },
  ].filter((c) => c.valor);

  return (
    <div className="proveedor-detalle">
      <Breadcrumbs
        items={[{ label: "Proveedores", to: "/proveedores" }, { label: proveedor.nombre }]}
      />

      <div className="proveedor-detalle__layout">
        <aside className="proveedor-ficha">
          <div className="proveedor-ficha__identidad">
            <Avatar nombre={proveedor.nombre} grande />
            <div className="proveedor-ficha__nombres">
              <h1 className="proveedor-ficha__nombre">{proveedor.nombre}</h1>
              {rubro && <span className="proveedor-ficha__rubro">{rubro}</span>}
            </div>
          </div>

          <div className="proveedor-ficha__panel">
            <span className="proveedor-ficha__panel-label">Comprado histórico</span>
            <span className="proveedor-ficha__panel-monto cifra">
              {formatMoneda(resumen.totalComprado)}
            </span>
            <span
              className={`proveedor-ficha__deuda${
                resumen.deuda > 0 ? " proveedor-ficha__deuda--debe" : ""
              }`}
            >
              <span
                className="proveedor-ficha__punto"
                style={{ background: resumen.deuda > 0 ? ERROR : OLIVA }}
              />
              {resumen.deuda > 0
                ? `Deuda ${formatMoneda(resumen.deuda)} · ${pluralizar(
                    resumen.comprasImpagas.length,
                    "compra",
                    "compras"
                  )}`
                : "Sin deuda pendiente"}
            </span>
            {(resumen.totalNotasCredito > 0 || resumen.totalNotasDebito > 0) && (
              <span className="proveedor-ficha__notas cifra">
                {[
                  resumen.totalNotasCredito > 0 &&
                    `Notas de crédito −${formatMoneda(resumen.totalNotasCredito)}`,
                  resumen.totalNotasDebito > 0 &&
                    `Notas de débito +${formatMoneda(resumen.totalNotasDebito)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            )}
          </div>

          {contacto.length > 0 && (
            <dl className="proveedor-ficha__contacto">
              {contacto.map(({ icono: Icono, label, valor }) => (
                <div key={label} className="proveedor-ficha__dato">
                  <Icono size={15} strokeWidth={1.75} aria-hidden="true" />
                  <dt>{label}</dt>
                  <dd>{valor}</dd>
                </div>
              ))}
            </dl>
          )}

          {canManage && (
            <div className="proveedor-ficha__acciones">
              <button
                type="button"
                className="btn btn-secondary proveedor-ficha__editar"
                onClick={() => setModalProveedorAbierto(true)}
              >
                <Pencil size={14} strokeWidth={1.75} aria-hidden="true" />
                Editar
              </button>
              <MenuMas
                items={[
                  {
                    texto: "Eliminar proveedor",
                    icono: Trash2,
                    peligro: true,
                    onClick: () => setConfirmarEliminarProveedor(true),
                  },
                ]}
              />
            </div>
          )}
        </aside>

        <div className="proveedor-detalle__contenido">
          <div className="proveedor-detalle__tabs">
            <Tabs
              tabs={[
                { key: "catalogo", label: "Catálogo", icono: Tag, contador: productos.length },
                {
                  key: "historial",
                  label: "Historial de compras",
                  icono: ShoppingCart,
                  contador: resumen.comprasDelProveedor.length,
                },
              ]}
              activa={tab}
              onCambiar={setTab}
              etiqueta="Secciones del proveedor"
            />
            {tab === "catalogo" && canManage && (
              <div className="proveedor-detalle__tabs-acciones">
                <button
                  type="button"
                  className="btn btn--sm btn-marca"
                  onClick={() => setModalImportarAbierto(true)}
                >
                  <Sparkles size={14} strokeWidth={1.75} aria-hidden="true" />
                  Importar
                </button>
                <button
                  type="button"
                  className="btn btn--sm btn-primary"
                  onClick={handleNuevoProducto}
                >
                  <Package aria-hidden="true" />
                  Producto
                </button>
              </div>
            )}
          </div>

          {tab === "catalogo" &&
            (productos.length === 0 ? (
              <EstadoVacio mensaje="Este proveedor todavía no tiene productos cargados." />
            ) : (
              <div className="planilla catalogo-proveedor">
                <div className="planilla__header catalogo-proveedor__fila">
                  <span>Producto</span>
                  <span>Tipo</span>
                  <span>Categoría</span>
                  <span className="catalogo-proveedor__precio">Precio</span>
                  <span />
                </div>
                {productos.map((producto) => {
                  const tipo = getTipoProducto(producto.tipo);
                  return (
                    <div
                      key={producto.id}
                      className="planilla__fila catalogo-proveedor__fila catalogo-proveedor__fila--dato"
                    >
                      <span className="catalogo-proveedor__nombre">
                        {producto.marca} {producto.modelo}
                      </span>
                      <span className="catalogo-proveedor__tipo">
                        {tipo.icono && (
                          <tipo.icono size={14} strokeWidth={1.75} aria-hidden="true" />
                        )}
                        {tipo.label}
                      </span>
                      <span className="catalogo-proveedor__categorias">
                        {(producto.categorias ?? []).map((c) => (
                          <span key={c.id} className="badge badge--neutro">
                            {c.nombre}
                          </span>
                        ))}
                      </span>
                      <span className="catalogo-proveedor__precio cifra">
                        {formatMoneda(producto.precio)}
                      </span>
                      <span className="acciones catalogo-proveedor__acciones">
                        {canManage && (
                          <>
                            <button
                              type="button"
                              className="btn-icono btn-icono--sm"
                              title="Editar"
                              aria-label={`Editar ${producto.marca} ${producto.modelo}`}
                              onClick={() => handleEditarProducto(producto)}
                            >
                              <Pencil aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              className="btn-icono btn-icono--sm btn-icono--peligro"
                              title="Eliminar"
                              aria-label={`Eliminar ${producto.marca} ${producto.modelo}`}
                              onClick={() => setProductoAEliminar(producto)}
                            >
                              <Trash2 aria-hidden="true" />
                            </button>
                          </>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}

          {tab === "historial" &&
            (resumen.comprasDelProveedor.length === 0 ? (
              <EstadoVacio mensaje="Todavía no hay compras registradas a este proveedor." />
            ) : (
              <>
                <FiltrosLista
                  modo="chips"
                  filtros={filtrosCompras}
                  onCambiar={setFiltrosCompras}
                  proyectos={proyectosConCompras}
                  mostrarNotas
                  mostrarEstadoPago
                  mostrarEstadoEnvio
                />

                {comprasDelProveedorFiltradas.length === 0 ? (
                  <EstadoVacio mensaje="Ninguna compra coincide con esos filtros." />
                ) : (
                  <div className="historial">
                    {comprasDelProveedorFiltradas.map((compra) => (
                      <FilaCompra
                        key={compra.id}
                        compra={compra}
                        proyecto={nombreProyectoDeCompra(compra)}
                        canManage={canManage}
                        onAbrir={() => setDetalleCompraId(compra.id)}
                        onTogglePago={() => handleToggleEstadoPagoCompra(compra)}
                        onToggleEnvio={() => handleToggleEstadoEnvioCompra(compra)}
                      />
                    ))}
                    <div className="historial__total cifra">
                      <span>
                        Total · {pluralizar(comprasDelProveedorFiltradas.length, "compra")}
                      </span>
                      <span>{formatMoneda(totalFiltrado)}</span>
                    </div>
                  </div>
                )}

                {resumen.notas.length > 0 && (
                  <section className="historial-notas">
                    <h2 className="historial-notas__titulo">Notas de crédito y débito</h2>
                    <ul className="historial-notas__lista">
                      {resumen.notas.map((nota) => {
                        const credito = nota.tipo === "nota_credito";
                        const Icono = credito ? FileMinus : FilePlus;
                        return (
                          <li key={nota.id}>
                            <button
                              type="button"
                              className="historial-notas__fila"
                              onClick={() => setDetalleCompraId(nota.origenId)}
                            >
                              <Icono size={15} strokeWidth={1.75} aria-hidden="true" />
                              <span className="historial-notas__texto">
                                <span>{nota.origenDescripcion}</span>
                                <span className="historial-notas__meta">
                                  {credito ? "Nota de crédito" : "Nota de débito"} · compra del{" "}
                                  {formatFecha(nota.origenFecha)}
                                </span>
                              </span>
                              <span className="historial-notas__monto cifra">
                                {credito ? "−" : "+"}
                                {formatMoneda(nota.monto_ars)}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                )}
              </>
            ))}
        </div>
      </div>

      {modalProveedorAbierto && (
        <ModalProveedor
          proveedor={proveedor}
          onGuardar={handleGuardarProveedor}
          onCerrar={() => setModalProveedorAbierto(false)}
        />
      )}

      {modalProductoAbierto && (
        <ModalProducto
          producto={productoEditando}
          proveedor={proveedor}
          categoriasDisponibles={categorias}
          onGuardar={handleGuardarProducto}
          onCerrar={() => setModalProductoAbierto(false)}
          onCategoriaCreada={refetchCategorias}
        />
      )}

      {modalImportarAbierto && (
        <ModalImportarCatalogo
          proveedor={proveedor}
          productosDelProveedor={productos}
          categoriasDisponibles={categorias}
          onImportado={refetchProductos}
          onCerrar={() => setModalImportarAbierto(false)}
          onCargarAMano={handleNuevoProducto}
          onCategoriaCreada={refetchCategorias}
        />
      )}

      {compraDetalle && (
        <ModalDetalleCompra
          compra={compraDetalle}
          faseNombre={nombreFase(compraDetalle.fase_id)}
          proveedorNombre={proveedor.nombre}
          productos={productos}
          onCerrar={() => setDetalleCompraId(null)}
          onVerComprobante={(c) => getComprobanteCompra(compraDetalle.id, c.id)}
          onVerNota={(n) => getNotaCompra(compraDetalle.id, n.id)}
          onTogglePago={() => handleToggleEstadoPagoCompra(compraDetalle)}
          onToggleEnvio={() => handleToggleEstadoEnvioCompra(compraDetalle)}
          canManage={canManage}
        />
      )}

      {confirmarEliminarProveedor && (
        <ModalConfirmar
          titulo="Eliminar proveedor"
          mensaje="Esta acción no se puede deshacer."
          nombreRecurso={proveedor.nombre}
          onConfirmar={handleConfirmarEliminarProveedor}
          onCancelar={() => setConfirmarEliminarProveedor(false)}
        />
      )}

      {productoAEliminar && (
        <ModalConfirmar
          titulo="Eliminar producto"
          mensaje="Esta acción no se puede deshacer."
          nombreRecurso={`${productoAEliminar.marca} ${productoAEliminar.modelo}`}
          onConfirmar={handleConfirmarEliminarProducto}
          onCancelar={() => setProductoAEliminar(null)}
        />
      )}
    </div>
  );
}

export default ProveedorDetalle;
