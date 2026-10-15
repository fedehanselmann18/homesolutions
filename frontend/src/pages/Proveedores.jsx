import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Sparkles, Truck } from "lucide-react";

import {
  crearProveedor,
  actualizarProveedor,
  eliminarProveedor,
} from "../services/proveedorService";
import { useCategorias, useCompras, useProductos, useProveedores } from "../hooks/queries";
import { getTipoProducto } from "../constants/tipoProducto";
import {
  calcularResumenProveedor,
  coincideBusquedaProveedor,
  rubroPrincipal,
} from "../utils/proveedores";
import { pluralizar } from "../utils/formato";
import { obtenerMensajeError } from "../utils/errorHandling";
import useAuth from "../context/useAuth";
import { useToast } from "../context/useToast";
import { usePageTitle } from "../hooks/usePageTitle";

import { ProveedorTarjeta } from "../components/proveedores/ProveedorItems";
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

// Lista de proveedores — variante 1c, "Fichas en grilla", de Rediseño de
// lista de proveedores.zip: todos los proveedores en tarjetas con sus datos
// de contacto y lo comprado. Antes (variante 4N) arriba iban los que tenían
// deuda, en cards grandes con "Registrar pago"; se sacó porque repetía lo que
// ya dicen Cash flow, las alertas del Panel y el detalle de cada proveedor, y
// empujaba la lista para abajo. La deuda y el pago de cada compra se ven y se
// registran en el detalle del proveedor.
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
  // proveedores para dibujarse: productos, compras y categorías completan lo
  // comprado y los filtros cuando llegan.
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
    const coincideCategoria =
      !categoriaFiltro ||
      productosDelProveedor.some((p) => (p.categorias ?? []).some((c) => c.id === categoriaFiltro));
    return coincideBusquedaProveedor(proveedor, busqueda) && coincideCategoria;
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

  const filtros = proveedores.length > 0 && (
    <div className="proveedores-filtros">
      <select
        className="campo campo--sm proveedores-filtro-categoria"
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
        etiqueta="Buscar proveedor por nombre, CUIT, teléfono o email"
        ancho="fijo"
      />
    </div>
  );

  return (
    <div className="proveedores-container">
      <PageHeader
        titulo="Proveedores"
        chip={pluralizar(proveedores.length, "cargado")}
        acciones={
          (filtros || canManage) && (
            <>
              {filtros}
              {canManage && (
                <div className="proveedores-botones">
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
                </div>
              )}
            </>
          )
        }
      />

      {proveedores.length === 0 ? (
        <EstadoVacio mensaje="No hay proveedores todavía. ¡Cargá el primero!" grande />
      ) : proveedoresFiltrados.length === 0 ? (
        <EstadoVacio mensaje="Ningún proveedor coincide con la búsqueda." />
      ) : (
        <div className="proveedores-tarjetas">
          {proveedoresFiltrados.map((resumen) => (
            <ProveedorTarjeta
              key={resumen.proveedor.id}
              resumen={resumen}
              onAbrir={() => navigate(`/proveedores/${resumen.proveedor.id}`)}
              onEditar={canManage ? () => abrirModalEditar(resumen.proveedor) : undefined}
              onEliminar={canManage ? () => handleSolicitarEliminar(resumen.proveedor) : undefined}
            />
          ))}
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
