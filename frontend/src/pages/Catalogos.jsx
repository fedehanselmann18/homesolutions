import { useState } from "react";

import { useCategorias, useCategoriasGasto, useImpuestos } from "../hooks/queries";
import { queryKeys } from "../lib/queryKeys";
import { usePageTitle } from "../hooks/usePageTitle";
import { crearImpuesto, actualizarImpuesto, eliminarImpuesto } from "../services/impuestosService";
import {
  crearCategoriaGasto,
  actualizarCategoriaGasto,
  eliminarCategoriaGasto,
} from "../services/categoriaGastoService";
import {
  crearCategoria,
  actualizarCategoria,
  eliminarCategoria,
} from "../services/categoriaService";

import { PageHeader } from "../components/shared/PageHeader";
import { Tabs } from "../components/shared/Tabs";
import { SeccionCatalogo } from "../components/catalogos/SeccionCatalogo";
import "./Catalogos.css";

const TABS = [
  { key: "impuestos", label: "Impuestos" },
  { key: "categoriasGasto", label: "Categorías de gasto" },
  { key: "categorias", label: "Categorías de producto" },
];

/**
 * Alta, edición y borrado de los catálogos que usan los formularios de carga:
 * impuestos (ModalCompra), categorías de gasto (ModalGasto) y categorías de
 * producto (ModalProducto, importar catálogo).
 *
 * Vive en el árbol protegido normal y NO en el panel Manager: ese subárbol se
 * reserva por nombre de usuario (constants/manager.js) y Agus, que es quien
 * carga esto, es rol admin pero no es Manager -- ProtectedRoute lo sacaría.
 * El rol lectura ve las listas pero no los controles de escritura.
 */
export function Catalogos() {
  usePageTitle("Catálogos");
  const [tabActiva, setTabActiva] = useState(TABS[0].key);

  const impuestosQuery = useImpuestos();
  const categoriasGastoQuery = useCategoriasGasto();
  const categoriasQuery = useCategorias();

  return (
    <div className="catalogos">
      <PageHeader
        titulo="Catálogos"
        subtitulo="Impuestos y categorías que se eligen al cargar compras, gastos y productos."
      />

      <Tabs tabs={TABS} activa={tabActiva} onCambiar={setTabActiva} etiqueta="Catálogos" />

      {tabActiva === "impuestos" && (
        <SeccionCatalogo
          query={impuestosQuery}
          queryKey={queryKeys.impuestos.all}
          keysAlEditar={[queryKeys.compras.all]}
          crear={crearImpuesto}
          actualizar={actualizarImpuesto}
          eliminar={eliminarImpuesto}
          textos={{
            singular: "impuesto",
            descripcion: "Se aplican a las compras (IVA, percepciones, etc.).",
            nuevo: "Nuevo impuesto",
            creado: "Impuesto creado.",
            tituloNuevo: "Nuevo impuesto",
            tituloEditar: "Editar impuesto",
            tituloEliminar: "Eliminar impuesto",
            cargando: "Cargando impuestos...",
            vacio: "Todavía no hay impuestos cargados.",
            error: "No se pudieron cargar los impuestos.",
          }}
        />
      )}

      {tabActiva === "categoriasGasto" && (
        <SeccionCatalogo
          query={categoriasGastoQuery}
          queryKey={queryKeys.categoriasGasto.all}
          keysAlEditar={[queryKeys.gastos.all]}
          crear={crearCategoriaGasto}
          actualizar={actualizarCategoriaGasto}
          eliminar={eliminarCategoriaGasto}
          textos={{
            singular: "categoría de gasto",
            descripcion: "Clasifican los gastos de cada obra (flete, viáticos, etc.).",
            nuevo: "Nueva categoría",
            creado: "Categoría de gasto creada.",
            tituloNuevo: "Nueva categoría de gasto",
            tituloEditar: "Editar categoría de gasto",
            tituloEliminar: "Eliminar categoría de gasto",
            cargando: "Cargando categorías de gasto...",
            vacio: "Todavía no hay categorías de gasto cargadas.",
            error: "No se pudieron cargar las categorías de gasto.",
          }}
        />
      )}

      {tabActiva === "categorias" && (
        <SeccionCatalogo
          query={categoriasQuery}
          queryKey={queryKeys.categorias.all}
          keysAlEditar={[queryKeys.productos.all]}
          conTipo
          crear={crearCategoria}
          actualizar={actualizarCategoria}
          eliminar={eliminarCategoria}
          textos={{
            singular: "categoría de producto",
            descripcion: "Clasifican los productos de los proveedores.",
            nuevo: "Nueva categoría",
            creado: "Categoría de producto creada.",
            tituloEliminar: "Eliminar categoría de producto",
            cargando: "Cargando categorías de producto...",
            vacio: "Todavía no hay categorías de producto cargadas.",
            error: "No se pudieron cargar las categorías de producto.",
          }}
        />
      )}
    </div>
  );
}

export default Catalogos;
