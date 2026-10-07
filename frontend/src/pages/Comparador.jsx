import { useEffect, useMemo, useState } from "react";
import { TrendingDown } from "lucide-react";

import { useProveedores } from "../hooks/useProveedores";
import { getProductos } from "../services/productoService";
import { getCategorias } from "../services/categoriaService";
import { TIPOS_PRODUCTO, getTipoProducto } from "../constants/tipoProducto";
import { formatMoneda } from "../utils/formato";
import { agruparPorProducto, filtrarProductos } from "../utils/comparador";
import { Cargando } from "../components/shared/Cargando";
import { EstadoVacio } from "../components/shared/EstadoVacio";
import { PageHeader } from "../components/shared/PageHeader";
import { Buscador } from "../components/shared/Buscador";
import { EstadoError } from "../components/shared/EstadoError";
import { FiltrosSegmentados } from "../components/shared/FiltrosSegmentados";
import { usePageTitle } from "../hooks/usePageTitle";

import "./Comparador.css";

const OPCIONES_TIPO = [
  { key: "", label: "Todos" },
  ...Object.entries(TIPOS_PRODUCTO).map(([clave, t]) => ({ key: clave, label: t.label })),
];

// El tipo de un producto es un dato, no un estado: ícono + texto tenue, como
// en el catálogo de un proveedor.
function TipoProducto({ tipo }) {
  const info = getTipoProducto(tipo);
  return (
    <span className="comparador-tipo">
      {info.icono && <info.icono size={14} strokeWidth={1.75} aria-hidden="true" />}
      {info.label}
    </span>
  );
}

// Comparador de precios: dos vistas sobre el mismo catálogo de productos.
// 1) "Mismo producto" -> solo marca+modelo cargados en 2+ proveedores, para
//    decidir a quién comprarle algo puntual.
// 2) "Explorar por categoría" -> todo el catálogo filtrable, para cuando no
//    hay match exacto pero igual querés ver precios de la zona/categoría.
export function Comparador() {
  usePageTitle("Comparador de precios");
  const { proveedores, loading: cargandoProveedores } = useProveedores();
  const [productos, setProductos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const [categoriaFiltro, setCategoriaFiltro] = useState("");
  const [tipoFiltro, setTipoFiltro] = useState("");
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    const fetchDatos = async () => {
      try {
        setCargando(true);
        setError(null);
        const [productosData, categoriasData] = await Promise.all([
          getProductos(),
          getCategorias(),
        ]);
        setProductos(productosData);
        setCategorias(categoriasData);
      } catch (err) {
        console.error("Error fetching datos del comparador:", err);
        setError(err);
      } finally {
        setCargando(false);
      }
    };
    fetchDatos();
  }, []);

  const grupos = useMemo(
    () => agruparPorProducto(productos, proveedores),
    [productos, proveedores]
  );

  const filtrados = useMemo(
    () =>
      filtrarProductos(productos, proveedores, {
        categoriaId: categoriaFiltro,
        tipo: tipoFiltro,
        texto: busqueda,
      }),
    [productos, proveedores, categoriaFiltro, tipoFiltro, busqueda]
  );

  if (cargando || cargandoProveedores) return <Cargando texto="Cargando comparador..." />;
  if (error) return <EstadoError mensaje="No se pudo cargar el comparador." grande />;

  // Los contadores de los chips de tipo respetan la búsqueda y la categoría:
  // cuentan lo que quedaría al elegir cada uno.
  const sinFiltroTipo = filtrarProductos(productos, proveedores, {
    categoriaId: categoriaFiltro,
    tipo: "",
    texto: busqueda,
  });
  const contadoresTipo = Object.fromEntries(
    OPCIONES_TIPO.map(({ key }) => [
      key,
      key ? sinFiltroTipo.filter((p) => p.tipo === key).length : sinFiltroTipo.length,
    ])
  );

  return (
    <div className="comparador-container">
      <PageHeader
        titulo="Comparador de precios"
        subtitulo="Compará qué proveedor conviene antes de cargar una compra."
      />

      <section className="comparador-seccion">
        <h2 className="comparador-seccion-titulo">
          Mismo producto, distintos proveedores
          {grupos.length > 0 && (
            <span className="comparador-seccion-cantidad">{grupos.length}</span>
          )}
        </h2>

        {grupos.length === 0 ? (
          <EstadoVacio mensaje="Todavía no hay ningún producto con la misma marca y modelo cargado en más de un proveedor." />
        ) : (
          <div className="comparador-grupos">
            {grupos.map((grupo) => (
              <article key={grupo.clave} className="comparador-grupo">
                <header className="comparador-grupo__header">
                  <div className="comparador-grupo__titulo">
                    <h3 className="comparador-grupo__nombre">
                      {grupo.marca} {grupo.modelo}
                    </h3>
                    <span className="comparador-grupo__meta">
                      <TipoProducto tipo={grupo.tipo} />
                      {grupo.categorias.map((c) => (
                        <span key={c.id} className="badge badge--neutro">
                          {c.nombre}
                        </span>
                      ))}
                    </span>
                  </div>
                  {grupo.ahorroPct > 0 && (
                    <span className="comparador-grupo__ahorro">
                      <TrendingDown size={14} strokeWidth={1.75} aria-hidden="true" />
                      {grupo.ahorroPct.toFixed(0)}% de diferencia
                    </span>
                  )}
                </header>

                <ul className="comparador-ofertas">
                  {grupo.ofertas.map((oferta, i) => (
                    <li
                      key={oferta.id}
                      className={`comparador-oferta${i === 0 ? " comparador-oferta--mejor" : ""}`}
                    >
                      <span className="comparador-oferta__proveedor">
                        {oferta.proveedorNombre}
                        {i === 0 && (
                          <span className="badge badge--sm badge--marca">Mejor precio</span>
                        )}
                      </span>
                      <span className="comparador-oferta__precio cifra">
                        {formatMoneda(oferta.precio)}
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="comparador-seccion">
        <div className="comparador-seccion__header">
          <h2 className="comparador-seccion-titulo">
            Todo el catálogo
            <span className="comparador-seccion-cantidad">{filtrados.length}</span>
          </h2>
          <div className="comparador-filtros">
            <select
              className="campo campo--sm comparador-filtros__select"
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
              placeholder="Buscar marca o modelo"
              etiqueta="Buscar producto"
              ancho="fijo"
            />
          </div>
        </div>

        <FiltrosSegmentados
          opciones={OPCIONES_TIPO}
          activa={tipoFiltro}
          contadores={contadoresTipo}
          etiqueta="Filtrar por tipo"
          onCambiar={setTipoFiltro}
        />

        {filtrados.length === 0 ? (
          <EstadoVacio mensaje="Ningún producto coincide con el filtro." />
        ) : (
          <div className="planilla comparador-catalogo">
            <div className="planilla__header">
              <span>Producto</span>
              <span>Tipo</span>
              <span>Proveedor</span>
              <span className="comparador-catalogo__precio">Precio</span>
            </div>
            {filtrados.map((producto) => (
              <div key={producto.id} className="planilla__fila">
                <span className="comparador-catalogo__nombre">
                  {producto.marca} {producto.modelo}
                </span>
                <span className="comparador-catalogo__tipo">
                  <TipoProducto tipo={producto.tipo} />
                </span>
                <span className="comparador-catalogo__proveedor">{producto.proveedorNombre}</span>
                <span className="comparador-catalogo__precio cifra">
                  {formatMoneda(producto.precio)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default Comparador;
