import { useState } from "react";
import { DollarSign, Layers, Percent, Receipt, Tag } from "lucide-react";

import {
  useCategorias,
  useCategoriasGasto,
  useCotizaciones,
  useFasesPredeterminadas,
  useImpuestos,
} from "../hooks/queries";
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
import {
  crearFasePredeterminada,
  actualizarFasePredeterminada,
  eliminarFasePredeterminada,
} from "../services/fasePredeterminadaService";

import { PageHeader } from "../components/shared/PageHeader";
import { Tabs } from "../components/shared/Tabs";
import { SeccionCatalogo } from "../components/catalogos/SeccionCatalogo";
import { SeccionCotizaciones } from "../components/catalogos/SeccionCotizaciones";
import "./Catalogos.css";

const TABS = [
  { key: "impuestos", label: "Impuestos", icono: Percent },
  { key: "categoriasGasto", label: "Categorías de gasto", icono: Receipt },
  { key: "categorias", label: "Categorías de producto", icono: Tag },
  { key: "cotizaciones", label: "Cotizaciones", icono: DollarSign },
  { key: "fasesPredeterminadas", label: "Fases predeterminadas", icono: Layers },
];

/**
 * Ajustes (antes «Catálogos»): alta, edición y borrado de las listas que usan
 * los formularios de carga: impuestos (ModalCompra), categorías de gasto
 * (ModalGasto), categorías de producto (ModalProducto, importar catálogo) y
 * fases predeterminadas (el select de nombre de ModalFase). Y la tabla de
 * cotizaciones del dólar, de la que los forms de carga sugieren el valor del día.
 *
 * Vive en el árbol protegido normal y NO en el panel Manager: ese subárbol se
 * reserva por nombre de usuario (constants/manager.js) y Agus, que es quien
 * carga esto, es rol admin pero no es Manager -- ProtectedRoute lo sacaría.
 * El rol lectura ve las listas pero no los controles de escritura.
 */
export function Catalogos() {
  usePageTitle("Ajustes");
  const [tabActiva, setTabActiva] = useState(TABS[0].key);

  const impuestosQuery = useImpuestos();
  const categoriasGastoQuery = useCategoriasGasto();
  const categoriasQuery = useCategorias();
  const cotizacionesQuery = useCotizaciones();
  const fasesPredeterminadasQuery = useFasesPredeterminadas();

  // Cada pestaña cuenta lo que tiene, como "Catálogo 7" en un proveedor. Las
  // queries son las mismas que usan las secciones (React Query las dedupea).
  const contadores = {
    impuestos: impuestosQuery.data?.length,
    categoriasGasto: categoriasGastoQuery.data?.length,
    categorias: categoriasQuery.data?.length,
    cotizaciones: cotizacionesQuery.data?.length,
    fasesPredeterminadas: fasesPredeterminadasQuery.data?.length,
  };
  const tabs = TABS.map((t) => ({ ...t, contador: contadores[t.key] }));

  return (
    <div className="catalogos">
      <PageHeader
        titulo="Ajustes"
        subtitulo="Impuestos, categorías, cotizaciones del dólar y fases que se usan al cargar obras, compras, gastos y cobros."
      />

      <Tabs tabs={tabs} activa={tabActiva} onCambiar={setTabActiva} etiqueta="Ajustes" />

      {tabActiva === "impuestos" && (
        <SeccionCatalogo
          query={impuestosQuery}
          queryKey={queryKeys.impuestos.all}
          keysAlEditar={[queryKeys.compras.all]}
          crear={crearImpuesto}
          actualizar={actualizarImpuesto}
          eliminar={eliminarImpuesto}
          icono={Percent}
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
          icono={Receipt}
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
          icono={Tag}
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
      {tabActiva === "cotizaciones" && <SeccionCotizaciones />}

      {tabActiva === "fasesPredeterminadas" && (
        <SeccionCatalogo
          query={fasesPredeterminadasQuery}
          queryKey={queryKeys.fasesPredeterminadas.all}
          // En el orden de la obra (como salen en el select), no alfabético.
          ordenAlfabetico={false}
          crear={crearFasePredeterminada}
          actualizar={actualizarFasePredeterminada}
          eliminar={eliminarFasePredeterminada}
          icono={Layers}
          textos={{
            singular: "fase predeterminada",
            descripcion:
              "Las opciones del nombre al crear una fase, en este orden. Una nueva va al final. Cambiarlas o borrarlas no toca las fases ya creadas, y siempre se puede escribir un nombre a mano.",
            nuevo: "Nueva fase",
            creado: "Fase predeterminada creada.",
            tituloNuevo: "Nueva fase predeterminada",
            tituloEditar: "Editar fase predeterminada",
            tituloEliminar: "Eliminar fase predeterminada",
            cargando: "Cargando fases predeterminadas...",
            vacio: "Todavía no hay fases predeterminadas cargadas.",
            error: "No se pudieron cargar las fases predeterminadas.",
          }}
        />
      )}
    </div>
  );
}

export default Catalogos;
