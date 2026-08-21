import { useEffect, useMemo, useState } from "react";
import { Sparkles } from "lucide-react";

import { useProveedores } from "../hooks/useProveedores";
import { getProductos } from "../services/productoService";
import { getCompras } from "../services/compraService";
import { getCategorias } from "../services/categoriaService";
import { getTipoProducto } from "../constants/tipoProducto";
import { calcularResumenProveedor, rubroPrincipal } from "../utils/proveedores";
import useAuth from "../context/useAuth";
import { useToast } from "../context/useToast";
import { usePageTitle } from "../hooks/usePageTitle";

import ProveedorCard from "../components/proveedores/ProveedorCard";
import ModalProveedor from "../components/modals/ModalProveedor";
import ModalImportarCatalogo from "../components/modals/ModalImportarCatalogo";
import ModalConfirmar from "../components/modals/ModalConfirmar";
import { Cargando } from "../components/shared/Cargando";
import { PageHeader } from "../components/shared/PageHeader";
import { Buscador } from "../components/shared/Buscador";
import { EstadoVacio } from "../components/shared/EstadoVacio";
import "./Proveedores.css";

export function Proveedores() {
  usePageTitle("Proveedores");
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

  const proveedoresFiltrados = resumenes.filter(({ proveedor, productosDelProveedor }) => {
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
      toast.error("No se pudo guardar el proveedor.");
    }
  };

  const handleSolicitarEliminar = (proveedor) => {
    setProveedorAEliminar(proveedor);
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
        subtitulo={`${proveedores.length} ${
          proveedores.length === 1 ? "proveedor cargado" : "proveedores cargados"
        }`}
        acciones={
          canManage && (
            <>
              <button
                type="button"
                className="btn btn-marca"
                onClick={() => setModalImportarAbierto(true)}
              >
                <Sparkles size={16} strokeWidth={2} />
                Importar catálogo
              </button>
              <button type="button" className="btn btn-primary" onClick={abrirModalCrear}>
                Nuevo proveedor
              </button>
            </>
          )
        }
      />

      <div className="proveedores-filtros">
        <Buscador
          valor={busqueda}
          onCambiar={setBusqueda}
          placeholder="Buscar por nombre…"
          etiqueta="Buscar proveedor"
        />

        <select
          className="campo proveedores-filtros__select"
          value={categoriaFiltro}
          onChange={(e) => setCategoriaFiltro(e.target.value)}
        >
          <option value="">Todas las categorías</option>
          {categorias.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.nombre}
            </option>
          ))}
        </select>
      </div>

      {proveedoresFiltrados.length === 0 ? (
        <EstadoVacio
          mensaje={
            proveedores.length === 0
              ? "No hay proveedores todavía. ¡Cargá el primero!"
              : "Ningún proveedor coincide con la búsqueda."
          }
          grande
        />
      ) : (
        <div className="proveedores-grid">
          {proveedoresFiltrados.map(
            ({
              proveedor,
              cantidadProductos,
              totalComprado,
              deuda,
              rubro,
              totalNotasCredito,
              totalNotasDebito,
            }) => (
              <ProveedorCard
                key={proveedor.id}
                proveedor={proveedor}
                rubro={rubro}
                cantidadProductos={cantidadProductos}
                totalComprado={totalComprado}
                deuda={deuda}
                totalNotasCredito={totalNotasCredito}
                totalNotasDebito={totalNotasDebito}
                onEditar={abrirModalEditar}
                onEliminar={handleSolicitarEliminar}
              />
            )
          )}
        </div>
      )}

      {modalAbierto && (
        <ModalProveedor
          proveedor={proveedorSeleccionado}
          onGuardar={handleGuardar}
          onCerrar={cerrarModal}
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
