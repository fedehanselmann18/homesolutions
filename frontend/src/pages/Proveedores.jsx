import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Truck } from "lucide-react";

import { useProveedores } from "../hooks/useProveedores";
import { getProductos } from "../services/productoService";
import { getCompras, actualizarCompra } from "../services/compraService";
import { useFases, useProyectos } from "../hooks/queries";
import { getCategorias } from "../services/categoriaService";
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

  const {
    proveedores,
    loading,
    error,
    agregarProveedor,
    editarProveedor,
    borrarProveedor,
    recargar,
  } = useProveedores();

  const [productos, setProductos] = useState([]);
  const [compras, setCompras] = useState([]);
  const [categorias, setCategorias] = useState([]);

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

  const refetchProductos = async () => {
    setProductos(await getProductos());
  };

  // El modal de importar puede crear una categoría sin cerrarse (ver
  // ChipsCategorias) -- refrescamos para que aparezca como chip elegible.
  const refetchCategorias = async () => {
    setCategorias(await getCategorias());
  };

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        const [productosData, comprasData, categoriasData] = await Promise.all([
          getProductos(),
          getCompras(),
          getCategorias(),
        ]);
        setProductos(productosData);
        setCompras(comprasData);
        setCategorias(categoriasData);
      } catch (err) {
        console.error("Error fetching datos de proveedores:", err);
      }
    };
    fetchDatos();
  }, []);

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
        await editarProveedor(proveedorSeleccionado.id, datos);
      } else {
        await agregarProveedor(datos);
      }
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
      setCompras(await getCompras());
      toast.success(`Listo: las compras a ${proveedor.nombre} quedaron pagadas.`);
    } catch (err) {
      console.error("Error registrando el pago:", err);
      toast.error("No se pudo registrar el pago. Revisá las compras del proveedor.");
      setCompras(await getCompras());
    }
  };

  const handleConfirmarEliminar = async () => {
    const proveedor = proveedorAEliminar;
    setProveedorAEliminar(null);
    try {
      await borrarProveedor(proveedor.id);
    } catch (err) {
      console.error("Error eliminando proveedor:", err);
      toast.error("No se pudo eliminar el proveedor.");
    }
  };

  if (loading) return <Cargando texto="Cargando proveedores..." />;
  if (error) return <p>Error al cargar los proveedores.</p>;

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
          onImportado={async () => {
            await Promise.all([recargar(), refetchProductos()]);
          }}
          onCerrar={() => setModalImportarAbierto(false)}
          onCargarAMano={abrirModalCrear}
          onCategoriaCreada={refetchCategorias}
        />
      )}
    </div>
  );
}

export default Proveedores;
