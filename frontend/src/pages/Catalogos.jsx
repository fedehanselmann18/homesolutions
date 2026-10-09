import { useState } from "react";
import { CalendarClock, DollarSign, FileText, Layers, Percent, Receipt, Tag } from "lucide-react";

import {
  useCategorias,
  useCategoriasGasto,
  useCotizaciones,
  useFasesPredeterminadas,
  useImpuestos,
  useTiposFactura,
  useCondicionesPago,
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
import {
  crearTipoFactura,
  actualizarTipoFactura,
  eliminarTipoFactura,
} from "../services/tipoFacturaService";
import {
  crearCondicionPago,
  actualizarCondicionPago,
  eliminarCondicionPago,
} from "../services/condicionPagoService";
import ModalCondicionPago from "../components/modals/ModalCondicionPago";
import { describirDias } from "../utils/plazos";

import { PageHeader } from "../components/shared/PageHeader";
import { Tabs } from "../components/shared/Tabs";
import { SeccionCatalogo } from "../components/catalogos/SeccionCatalogo";
import { SeccionCotizaciones } from "../components/catalogos/SeccionCotizaciones";
import ModalImpuesto from "../components/modals/ModalImpuesto";
import { formatoAlicuota } from "../utils/impuestos";
import "./Catalogos.css";

const TABS = [
  { key: "impuestos", label: "Impuestos", icono: Percent },
  { key: "categoriasGasto", label: "Categorías de gasto", icono: Receipt },
  { key: "tiposFactura", label: "Tipos de factura", icono: FileText },
  { key: "condicionesPago", label: "Condiciones de pago", icono: CalendarClock },
  { key: "categorias", label: "Categorías de producto", icono: Tag },
  { key: "cotizaciones", label: "Cotizaciones", icono: DollarSign },
  { key: "fasesPredeterminadas", label: "Fases predeterminadas", icono: Layers },
];

/**
 * Ajustes (antes «Catálogos»): alta, edición y borrado de las listas que usan
 * los formularios de carga: impuestos (ModalCompra), categorías de gasto
 * (ModalGasto), tipos de factura (compras, gastos, cobros y notas, y el
 * filtro de las listas), categorías de producto (ModalProducto, importar
 * catálogo) y fases predeterminadas (el select de nombre de ModalFase). Y la tabla de
 * cotizaciones del dólar, de la que los forms de carga sugieren el valor del día.
 *
 * Vive en el árbol protegido normal y NO en el panel Manager: ese subárbol se
 * reserva por nombre de usuario (constants/manager.js) y Agus, que es quien
 * carga esto, es rol admin pero no es Manager -- ProtectedRoute lo sacaría.
 * El rol lectura ve las listas pero no los controles de escritura.
 */
// "21 % · IVA" al lado del nombre de un impuesto; nada si no tiene ni uno ni otro.
const detalleImpuesto = (impuesto) =>
  [impuesto.alicuota && formatoAlicuota(impuesto.alicuota), impuesto.grupo]
    .filter(Boolean)
    .join(" · ") || null;

export function Catalogos() {
  usePageTitle("Ajustes");
  const [tabActiva, setTabActiva] = useState(TABS[0].key);

  const impuestosQuery = useImpuestos();
  const categoriasGastoQuery = useCategoriasGasto();
  const categoriasQuery = useCategorias();
  const cotizacionesQuery = useCotizaciones();
  const fasesPredeterminadasQuery = useFasesPredeterminadas();
  const tiposFacturaQuery = useTiposFactura();
  const condicionesPagoQuery = useCondicionesPago();

  // Cada pestaña cuenta lo que tiene, como "Catálogo 7" en un proveedor. Las
  // queries son las mismas que usan las secciones (React Query las dedupea).
  const contadores = {
    impuestos: impuestosQuery.data?.length,
    categoriasGasto: categoriasGastoQuery.data?.length,
    tiposFactura: tiposFacturaQuery.data?.length,
    condicionesPago: condicionesPagoQuery.data?.length,
    categorias: categoriasQuery.data?.length,
    cotizaciones: cotizacionesQuery.data?.length,
    fasesPredeterminadas: fasesPredeterminadasQuery.data?.length,
  };
  const tabs = TABS.map((t) => ({ ...t, contador: contadores[t.key] }));

  return (
    <div className="catalogos">
      <PageHeader
        titulo="Ajustes"
        subtitulo="Impuestos, categorías, tipos de factura, condiciones de pago, cotizaciones del dólar y fases que se usan al cargar obras, compras, gastos y cobros."
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
          ModalFormulario={ModalImpuesto}
          detalle={detalleImpuesto}
          textos={{
            singular: "impuesto",
            descripcion:
              "Se aplican a las compras (IVA, percepciones, etc.). Con alícuota, el monto se calcula solo; los del mismo grupo suman juntos en el Análisis.",
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

      {tabActiva === "tiposFactura" && (
        <SeccionCatalogo
          query={tiposFacturaQuery}
          // Los movimientos guardan el código, no el nombre: renombrar no deja
          // nada viejo fuera de esta misma lista.
          queryKey={queryKeys.tiposFactura.all}
          // En el orden del select (A, B, C… y «Otros» al final), no alfabético.
          ordenAlfabetico={false}
          crear={crearTipoFactura}
          actualizar={actualizarTipoFactura}
          eliminar={eliminarTipoFactura}
          icono={FileText}
          textos={{
            singular: "tipo de factura",
            descripcion:
              "El comprobante de cada compra, gasto, cobro y nota (Factura A, Remito…). Uno nuevo va al final, antes de «Otros». «Otros» no se borra, y uno que ya tiene movimientos tampoco.",
            nuevo: "Nuevo tipo",
            creado: "Tipo de factura creado.",
            tituloNuevo: "Nuevo tipo de factura",
            tituloEditar: "Editar tipo de factura",
            tituloEliminar: "Eliminar tipo de factura",
            cargando: "Cargando tipos de factura...",
            vacio: "Todavía no hay tipos de factura cargados.",
            error: "No se pudieron cargar los tipos de factura.",
          }}
        />
      )}

      {tabActiva === "condicionesPago" && (
        <SeccionCatalogo
          query={condicionesPagoQuery}
          // Las compras y gastos traen su condición anidada (con el nombre):
          // renombrar una deja viejas esas listas.
          queryKey={queryKeys.condicionesPago.all}
          keysAlEditar={[queryKeys.compras.all, queryKeys.gastos.all]}
          ordenAlfabetico={false}
          crear={crearCondicionPago}
          actualizar={actualizarCondicionPago}
          eliminar={eliminarCondicionPago}
          icono={CalendarClock}
          ModalFormulario={ModalCondicionPago}
          detalle={(condicion) => describirDias(condicion.dias)}
          textos={{
            singular: "condición de pago",
            descripcion:
              "Cuándo se paga una compra o un gasto. 30/60 = mitad a 30 días y mitad a 60, contados desde la fecha de la factura. «Contado» no se borra, y una que ya usaste tampoco.",
            nuevo: "Nueva condición",
            creado: "Condición de pago creada.",
            tituloNuevo: "Nueva condición de pago",
            tituloEditar: "Editar condición de pago",
            tituloEliminar: "Eliminar condición de pago",
            cargando: "Cargando condiciones de pago...",
            vacio: "Todavía no hay condiciones de pago cargadas.",
            error: "No se pudieron cargar las condiciones de pago.",
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
