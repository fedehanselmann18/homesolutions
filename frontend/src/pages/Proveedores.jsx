import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Truck } from "lucide-react";

import {
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from "../services/proveedorService";
import { actualizarCompra } from "../services/compraService";
import {
  useCategorias,
  useCompras,
  useFases,
  useProductos,
  useProveedores,
  useProyectos,
} from "../hooks/queries";
import { getTipoProducto } from "../constants/tipoProducto";
import { calcularResumenProveedor, rubroPrincipal } from "../utils/proveedores";
import { formatMoneda, pluralizar } from "../utils/formato";
import { obtenerMensajeError } from "../utils/errorHandling";
import useAuth from "../context/useAuth";
import { useToast } from "../context/useToast";
import { usePageTitle } from "../hooks/usePageTitle";

import { ProveedorDeudaCard, ProveedorFila } from "../components/proveedores/ProveedorItems";
import ModalProveedor from "../components/modals/ModalProveedor";
import ModalImportarCatalogo from "../components/modals/ModalImportarCatalogo";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import { Cargando } from "../components/shared/Cargando";
import { PageHeader } from "../components/shared/PageHeader";
import { Buscador } from "../components/shared/Buscador";
import { EstadoVacio } from "../components/shared/EstadoVacio";
import "./Proveedores.css";

// Mientras una query carga: siempre el mismo array, para no invalidar los
// useMemo de abajo con uno nuevo en cada render.
const SIN_DATOS = [];

// Lista de proveedores — variante 4N de HS General.dc.html
// ("Primero a quién se le debe"): arriba los que tienen deuda, ordenados por
// lo que se debe, como cards con la acción para resolverlo; abajo los que
// están al día, en filas. El criterio es ordenar por lo que hay que
// resolver, no alfabético.
export function Proveedores() {
  usePageTitle("Proveedores");
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const canManage = usuario?.rol === "admin";
  const toast = useToast();
  const queryClient = useQueryClient();
  const invalidar = (...recursos) =>
    Promise.all(recursos.map((recurso) => queryClient.invalidateQueries({ queryKey: [recurso] })));

  // Las mismas queries que el resto de la app. La pantalla espera sólo a los
  // proveedores para dibujarse: productos, compras y categorías completan la
  // deuda y los filtros cuando llegan.
  const proveedoresQuery = useProveedores();
  const proveedores = proveedoresQuery.data ?? SIN_DATOS;
  const productos = useProductos().data ?? SIN_DATOS;
  const compras = useCompras().data ?? SIN_DATOS;
  const categorias = useCategorias().data ?? SIN_DATOS;

  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState("");

  const [modalAbierto, setModalAbierto] = useState(false);
  const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);
  const [proveedorAEliminar, setProveedorAEliminar] = useState(null);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  const [pagoAConfirmar, setPagoAConfirmar] = useState(null); // resumen del proveedor

  // Para nombrar en qué obras están las compras impagas: una compra guarda
  // la fase, no el proyecto. Son las mismas queries que el resto de la app.
  const fases = useFases().data;
  const proyectos = useProyectos().data;
  const nombreProyectoDeFase = useMemo(() => {
    const proyectoDeFase = new Map((fases ?? []).map((f) => [f.id, f.proyecto_id]));
    const nombres = new Map((proyectos ?? []).map((p) => [p.id, p.nombre]));
    return (faseId) => nombres.get(proyectoDeFase.get(faseId)) ?? null;
  }, [fases, proyectos]);

  const resumenes = useMemo(() => {
    return proveedores.map((proveedor) => {
      const resumen = calcularResumenProveedor(proveedor, { productos, compras });
      return {
        proveedor,
        ...resumen,
        rubro: rubroPrincipal(resumen.productosDelProveedor, getTipoProducto),
      };
    });
  }, [proveedores, productos, compras]);

  // Con deuda: de mayor a menor deuda. Al día: el resto, filtrado por la
  // búsqueda y la categoría (los deudores se ven siempre: son lo urgente).
  const conDeuda = resumenes.filter((r) => r.deuda > 0).sort((a, b) => b.deuda - a.deuda);
  const totalDeuda = conDeuda.reduce((acc, r) => acc + r.deuda, 0);

  const alDia = resumenes.filter((r) => r.deuda <= 0);
  const proveedoresFiltrados = alDia.filter(({ proveedor, productosDelProveedor }) => {
    const coincideNombre = proveedor.nombre.toLowerCase().includes(busqueda.trim().toLowerCase());
    const coincideCategoria =
      !categoriaFiltro ||
      productosDelProveedor.some((p) => (p.categorias ?? []).some((c) => c.id === categoriaFiltro));
    return coincideNombre && coincideCategoria;
  });

  const abrirModalCrear = () => {
    setProveedorSeleccionado(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (proveedor) => {
    setProveedorSeleccionado(proveedor);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setProveedorSeleccionado(null);
  };

  const handleGuardar = async (datos) => {
    try {
      if (proveedorSeleccionado) {
        await actualizarProveedor(proveedorSeleccionado.id, datos);
      } else {
        await crearProveedor(datos);
      }
      // Se espera el refetch: al cerrarse el modal la lista ya está al día.
      await invalidar("proveedores");
      cerrarModal();
    } catch (err) {
      console.error("Error guardando proveedor:", err);
      toast.error(obtenerMensajeError(err));
    }
  };

  const handleSolicitarEliminar = (proveedor) => {
    setProveedorAEliminar(proveedor);
  };

  const handleConfirmarPago = async () => {
    const { proveedor, comprasImpagas } = pagoAConfirmar;
    setPagoAConfirmar(null);
    try {
      await Promise.all(
        comprasImpagas.map((c) => actualizarCompra(c.id, { estado_pago: "pagado" }))
      );
      toast.success(`Listo: las compras a ${proveedor.nombre} quedaron pagadas.`);
    } catch (err) {
      console.error("Error registrando el pago:", err);
      toast.error("No se pudo registrar el pago. Revisá las compras del proveedor.");
    } finally {
      // Aunque falle a la mitad, algunas pueden haber quedado pagadas. Por
      // prefijo: también refresca las compras de cada obra y fase.
      await invalidar("compras");
    }
  };

  const handleConfirmarEliminar = async () => {
    const proveedor = proveedorAEliminar;
    setProveedorAEliminar(null);
    try {
      await eliminarProveedor(proveedor.id);
      // Sus productos se borran en cascada con él.
      await invalidar("proveedores", "productos");
    } catch (err) {
      console.error("Error eliminando proveedor:", err);
      toast.error("No se pudo eliminar el proveedor.");
    }
  };

  if (proveedoresQuery.isLoading) return <Cargando texto="Cargando proveedores..." />;
  if (proveedoresQuery.error) return <p>Error al cargar los proveedores.</p>;

  return (
    <div className="proveedores-container">
      <PageHeader
        titulo="Proveedores"
        chip={pluralizar(proveedores.length, "cargado")}
        acciones={
          canManage && (
            <>
              <button
                type="button"
                className="btn btn-marca"
                onClick={() => setModalImportarAbierto(true)}
              >
                <Sparkles aria-hidden="true" />
                Importar catálogo
              </button>
              <button type="button" className="btn btn-primary" onClick={abrirModalCrear}>
                <Truck aria-hidden="true" />
                Nuevo proveedor
              </button>
            </>
          )
        }
      />

      {proveedores.length === 0 ? (
        <EstadoVacio mensaje="No hay proveedores todavía. ¡Cargá el primero!" grande />
      ) : (
        <>
          {conDeuda.length > 0 && (
            <section className="proveedores-seccion">
              <h2 className="proveedores-seccion__titulo">
                Con deuda · <span className="cifra">{formatMoneda(totalDeuda)}</span>
              </h2>
              <div className="proveedores-deudas">
                {conDeuda.map((resumen) => (
                  <ProveedorDeudaCard
                    key={resumen.proveedor.id}
                    resumen={resumen}
                    proyectos={[
                      ...new Set(
                        resumen.comprasImpagas
                          .map((c) => nombreProyectoDeFase(c.fase_id))
                          .filter(Boolean)
                      ),
                    ]}
                    onRegistrarPago={canManage ? () => setPagoAConfirmar(resumen) : undefined}
                    onVerCompras={() => navigate(`/proveedores/${resumen.proveedor.id}`)}
                  />
                ))}
              </div>
            </section>
          )}

          <section className="proveedores-seccion">
            <div className="proveedores-seccion__header">
              <h2 className="proveedores-seccion__titulo">Al día · {alDia.length}</h2>
              <div className="proveedores-filtros">
                <select
                  className="campo campo--sm proveedores-filtros__select"
                  value={categoriaFiltro}
                  onChange={(e) => setCategoriaFiltro(e.target.value)}
                  aria-label="Filtrar por categoría"
                >
                  <option value="">Todas las categorías</option>
                  {categorias.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.nombre}
                    </option>
                  ))}
                </select>
                <Buscador
                  valor={busqueda}
                  onCambiar={setBusqueda}
                  placeholder="Buscar"
                  etiqueta="Buscar proveedor"
                  ancho="fijo"
                />
              </div>
            </div>

            {proveedoresFiltrados.length === 0 ? (
              <EstadoVacio
                mensaje={
                  alDia.length === 0
                    ? "Todos los proveedores tienen algo pendiente."
                    : "Ningún proveedor coincide con la búsqueda."
                }
              />
            ) : (
              <div className="planilla">
                {proveedoresFiltrados.map((resumen) => (
                  <ProveedorFila
                    key={resumen.proveedor.id}
                    resumen={resumen}
                    onAbrir={() => navigate(`/proveedores/${resumen.proveedor.id}`)}
                    onEditar={canManage ? () => abrirModalEditar(resumen.proveedor) : undefined}
                    onEliminar={
                      canManage ? () => handleSolicitarEliminar(resumen.proveedor) : undefined
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {modalAbierto && (
        <ModalProveedor
          proveedor={proveedorSeleccionado}
          onGuardar={handleGuardar}
          onCerrar={cerrarModal}
        />
      )}

      {pagoAConfirmar && (
        <ModalConfirmar
          titulo="Registrar pago"
          tono="neutro"
          textoConfirmar="Marcar pagadas"
          mensaje={
            pagoAConfirmar.comprasImpagas.length === 1
              ? "La compra sin pagar a este proveedor va a quedar como pagada. Se puede deshacer desde la compra."
              : `Las ${pagoAConfirmar.comprasImpagas.length} compras sin pagar a este proveedor van a quedar como pagadas. Se puede deshacer desde cada compra.`
          }
          nombreRecurso={`${pagoAConfirmar.proveedor.nombre} · ${formatMoneda(pagoAConfirmar.deuda)}`}
          onConfirmar={handleConfirmarPago}
          onCancelar={() => setPagoAConfirmar(null)}
        />
      )}

      {proveedorAEliminar && (
        <ModalConfirmar
          titulo="Eliminar proveedor"
          mensaje="Esta acción no se puede deshacer."
          nombreRecurso={proveedorAEliminar.nombre}
          onConfirmar={handleConfirmarEliminar}
          onCancelar={() => setProveedorAEliminar(null)}
        />
      )}

      {modalImportarAbierto && (
        <ModalImportarCatalogo
          proveedoresDisponibles={proveedores}
          productosTodos={productos}
          categoriasDisponibles={categorias}
          onImportado={() => invalidar("proveedores", "productos")}
          onCerrar={() => setModalImportarAbierto(false)}
          onCargarAMano={abrirModalCrear}
          // Puede crear una categoría sin cerrarse (ver ChipsCategorias):
          // refrescamos para que aparezca como chip elegible.
          onCategoriaCreada={() => invalidar("categorias")}
        />
      )}
    </div>
  );
}

export default Proveedores;
