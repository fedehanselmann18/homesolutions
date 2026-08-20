import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Mail,
  MapPin,
  Phone,
  Pencil,
  Trash2,
  FileMinus,
  FilePlus,
  Sparkles,
} from "lucide-react";

import {
  getProveedorPorId,
  actualizarProveedor,
  eliminarProveedor,
} from "../services/proveedorService";
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
import { formatMoneda, formatFecha } from "../utils/formato";
import { calcularResumenProveedor } from "../utils/proveedores";
import { FILTROS_VACIOS, filtrarCompras } from "../utils/filtros";

import LibroDeObra from "../components/proyectos/LibroDeObra";
import ModalProveedor from "../components/modals/ModalProveedor";
import ModalProducto from "../components/modals/ModalProducto";
import ModalImportarCatalogo from "../components/modals/ModalImportarCatalogo";
import ModalDetalleCompra from "../components/modals/ModalDetalleCompra";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import { Cargando } from "../components/shared/Cargando";
import { TarjetaAlerta } from "../components/shared/TarjetaAlerta";
import FiltrosLista from "../components/shared/FiltrosLista";
import { useToast } from "../context/useToast";
import { usePageTitle } from "../hooks/usePageTitle";

import "../components/proyectos/Acciones.css";
import "../components/proyectos/Seguimiento.css";
import "./ProveedorDetalle.css";

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

  const comprasDelProveedorFiltradas = useMemo(
    () => filtrarCompras(resumen.comprasDelProveedor, filtrosCompras, { proyectoDeCompra }),
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
      toast.error("No se pudo guardar el proveedor.");
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
      toast.error("No se pudo eliminar el producto.");
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
    return (
      <div className="proveedor-detalle-vacio">No se pudo cargar el detalle del proveedor.</div>
    );
  }

  return (
    <div className="proveedor-detalle">
      <button
        type="button"
        className="proveedor-detalle-volver"
        onClick={() => navigate("/proveedores")}
      >
        <ArrowLeft size={16} strokeWidth={2} />
        Volver a proveedores
      </button>

      <div className="proveedor-detalle-header">
        <div className="proveedor-detalle-header-top">
          <h1 className="proveedor-detalle-nombre">{proveedor.nombre}</h1>
          {canManage && (
            <div className="proveedor-detalle-header-acciones">
              <button type="button" onClick={() => setModalProveedorAbierto(true)}>
                <Pencil size={14} strokeWidth={2} />
                Editar
              </button>
              <button
                type="button"
                className="proveedor-detalle-btn-eliminar"
                onClick={() => setConfirmarEliminarProveedor(true)}
              >
                <Trash2 size={14} strokeWidth={2} />
                Eliminar
              </button>
            </div>
          )}
        </div>

        <div className="proveedor-detalle-datos">
          {proveedor.cuit && (
            <span className="proveedor-detalle-dato">CUIT: {proveedor.cuit}</span>
          )}
          {proveedor.telefono && (
            <span className="proveedor-detalle-dato">
              <Phone size={15} strokeWidth={2} /> {proveedor.telefono}
            </span>
          )}
          {proveedor.email && (
            <span className="proveedor-detalle-dato">
              <Mail size={15} strokeWidth={2} /> {proveedor.email}
            </span>
          )}
          {proveedor.direccion && (
            <span className="proveedor-detalle-dato">
              <MapPin size={15} strokeWidth={2} /> {proveedor.direccion}
            </span>
          )}
        </div>

        <div className="proveedor-detalle-metricas">
          <div className="proveedor-detalle-metrica">
            <span className="proveedor-detalle-metrica-label">Comprado histórico</span>
            <span className="proveedor-detalle-metrica-valor">
              {formatMoneda(resumen.totalComprado)}
            </span>
          </div>
          <div className="proveedor-detalle-metrica">
            <span className="proveedor-detalle-metrica-label">Deuda pendiente</span>
            <span
              className="proveedor-detalle-metrica-valor"
              style={{ color: resumen.deuda > 0 ? "#dc2626" : "#16a34a" }}
            >
              {formatMoneda(resumen.deuda)}
            </span>
          </div>
          {resumen.totalNotasCredito > 0 && (
            <div className="proveedor-detalle-metrica">
              <span className="proveedor-detalle-metrica-label">Notas de crédito</span>
              <span className="proveedor-detalle-metrica-valor" style={{ color: "#dc2626" }}>
                -{formatMoneda(resumen.totalNotasCredito)}
              </span>
            </div>
          )}
          {resumen.totalNotasDebito > 0 && (
            <div className="proveedor-detalle-metrica">
              <span className="proveedor-detalle-metrica-label">Notas de débito</span>
              <span className="proveedor-detalle-metrica-valor" style={{ color: "#c2662d" }}>
                +{formatMoneda(resumen.totalNotasDebito)}
              </span>
            </div>
          )}
        </div>
      </div>

      {resumen.notas.length > 0 && (
        <div className="proveedor-detalle-seccion">
          <div className="proveedor-detalle-seccion-header">
            <h2>Notas de crédito / débito</h2>
          </div>
          <div className="seguimiento-lista">
            {resumen.notas.map((nota) => {
              const esCredito = nota.tipo === "nota_credito";
              return (
                <TarjetaAlerta
                  key={nota.id}
                  icono={esCredito ? FileMinus : FilePlus}
                  color={esCredito ? "#dc2626" : "#c2662d"}
                  titulo={nota.origenDescripcion}
                  detalle={`Compra del ${formatFecha(nota.origenFecha)}`}
                  monto={`${esCredito ? "-" : "+"}${formatMoneda(nota.monto)}`}
                  onClick={() => setDetalleCompraId(nota.origenId)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="proveedor-detalle-seccion">
        <div className="proveedor-detalle-seccion-header">
          <h2>Catálogo de productos</h2>
          {canManage && (
            <div className="proveedor-detalle-seccion-header-acciones">
              <button
                type="button"
                className="proveedor-detalle-btn-ia"
                onClick={() => setModalImportarAbierto(true)}
              >
                <Sparkles size={15} strokeWidth={2.25} />
                Importar catálogo
              </button>
              <button onClick={handleNuevoProducto}>Nuevo producto</button>
            </div>
          )}
        </div>

        {productos.length === 0 ? (
          <p>Este proveedor todavía no tiene productos cargados.</p>
        ) : (
          <div className="proveedor-detalle-tabla-wrap">
            <table className="proveedor-detalle-tabla">
              <thead>
                <tr>
                  <th>Producto</th>
                  <th>Tipo</th>
                  <th>Categorías</th>
                  <th>Precio</th>
                  {canManage && <th />}
                </tr>
              </thead>
              <tbody>
                {productos.map((producto) => {
                  const tipo = getTipoProducto(producto.tipo);
                  return (
                    <tr key={producto.id}>
                      <td>
                        {producto.marca} {producto.modelo}
                      </td>
                      <td>
                        <span
                          className="proveedor-detalle-badge"
                          style={{ color: tipo.color, backgroundColor: `${tipo.color}1c` }}
                        >
                          {tipo.icono && <tipo.icono size={12} strokeWidth={2.25} />} {tipo.label}
                        </span>
                      </td>
                      <td>
                        <div className="proveedor-detalle-chips">
                          {(producto.categorias ?? []).map((c) => (
                            <span key={c.id} className="proveedor-detalle-chip">
                              {c.nombre}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td>{formatMoneda(producto.precio)}</td>
                      {canManage && (
                        <td className="proveedor-detalle-tabla-acciones">
                          <button type="button" onClick={() => handleEditarProducto(producto)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="proveedor-detalle-btn-eliminar-texto"
                            onClick={() => setProductoAEliminar(producto)}
                          >
                            Eliminar
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="acciones-seccion">
        <div className="acciones-header">
          <h2>Historial de compras</h2>
        </div>

        {resumen.comprasDelProveedor.length > 0 && (
          <FiltrosLista
            filtros={filtrosCompras}
            onCambiar={setFiltrosCompras}
            proyectos={proyectosConCompras}
            mostrarNotas
            mostrarEstadoPago
            mostrarEstadoEnvio
          />
        )}

        {resumen.comprasDelProveedor.length === 0 ? (
          <p>Todavía no hay compras registradas a este proveedor.</p>
        ) : (
          <LibroDeObra
            titulo={`Compras — ${proveedor.nombre}`}
            compras={comprasDelProveedorFiltradas}
            nombreFase={nombreFase}
            nombreProyecto={nombreProyectoDeCompra}
            saldoLabel="Total comprado"
            canManage={canManage}
            // Se consulta, no se edita: la compra se carga y se corrige desde
            // su proyecto. Lo único que queda a mano son los toggles de
            // pago/envío, que es lo que se mira parado en un proveedor.
            permitirEdicion={false}
            onAbrirDetalle={(_tipo, compra) => setDetalleCompraId(compra.id)}
            onTogglePagoCompra={handleToggleEstadoPagoCompra}
            onToggleEnvioCompra={handleToggleEstadoEnvioCompra}
            onVerComprobante={(_tipo, compraId, comprobanteId) =>
              getComprobanteCompra(compraId, comprobanteId)
            }
          />
        )}
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
