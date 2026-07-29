import { useEffect, useMemo, useState } from "react";
import { Search, TrendingDown } from "lucide-react";

import { useProveedores } from "../hooks/useProveedores";
import { getProductos } from "../services/productoService";
import { getCategorias } from "../services/categoriaService";
import { TIPOS_PRODUCTO, getTipoProducto } from "../constants/tipoProducto";
import { formatMoneda } from "../utils/formato";
import { agruparPorProducto, filtrarProductos } from "../utils/comparador";

import "./Comparador.css";

// Comparador de precios: dos vistas sobre el mismo catálogo de productos.
// 1) "Mismo producto" -> solo marca+modelo cargados en 2+ proveedores, para
//    decidir a quién comprarle algo puntual.
// 2) "Explorar por categoría" -> todo el catálogo filtrable, para cuando no
//    hay match exacto pero igual querés ver precios de la zona/categoría.
export function Comparador() {
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
                const [productosData, categoriasData] = await Promise.all([getProductos(), getCategorias()]);
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

    const grupos = useMemo(() => agruparPorProducto(productos, proveedores), [productos, proveedores]);

    const filtrados = useMemo(
        () =>
            filtrarProductos(productos, proveedores, {
                categoriaId: categoriaFiltro,
                tipo: tipoFiltro,
                texto: busqueda,
            }),
        [productos, proveedores, categoriaFiltro, tipoFiltro, busqueda]
    );

    if (cargando || cargandoProveedores) return <p className="comparador-feedback">Cargando comparador...</p>;
    if (error) return <p className="comparador-feedback">No se pudo cargar el comparador.</p>;

    return (
        <div className="comparador-container">
            <header className="comparador-header">
                <h1 className="comparador-header__titulo">Comparador de precios</h1>
                <p className="comparador-header__subtitulo">
                    Compará qué proveedor conviene antes de cargar una compra.
                </p>
            </header>

            <section className="comparador-seccion">
                <h2 className="comparador-seccion-titulo">Mismo producto, distintos proveedores</h2>

                {grupos.length === 0 ? (
                    <p className="comparador-feedback">
                        Todavía no hay ningún producto con la misma marca y modelo cargado en más de un proveedor.
                    </p>
                ) : (
                    <div className="comparador-grupos">
                        {grupos.map((grupo) => {
                            const tipo = getTipoProducto(grupo.tipo);
                            return (
                                <article key={grupo.clave} className="comparador-grupo">
                                    <div className="comparador-grupo-header">
                                        <div>
                                            <h3 className="comparador-grupo-nombre">
                                                {grupo.marca} {grupo.modelo}
                                            </h3>
                                            <div className="comparador-grupo-chips">
                                                <span
                                                    className="comparador-badge"
                                                    style={{ color: tipo.color, backgroundColor: `${tipo.color}1c` }}
                                                >
                                                    {tipo.icono} {tipo.label}
                                                </span>
                                                {grupo.categorias.map((c) => (
                                                    <span key={c.id} className="comparador-chip">
                                                        {c.nombre}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        {grupo.ahorroPct > 0 && (
                                            <span className="comparador-ahorro">
                                                <TrendingDown size={14} strokeWidth={2} />
                                                {grupo.ahorroPct.toFixed(0)}% de diferencia
                                            </span>
                                        )}
                                    </div>

                                    <table className="comparador-tabla">
                                        <thead>
                                            <tr>
                                                <th>Proveedor</th>
                                                <th>Precio</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {grupo.ofertas.map((oferta, i) => (
                                                <tr key={oferta.id} className={i === 0 ? "comparador-fila-mejor" : ""}>
                                                    <td>
                                                        {oferta.proveedorNombre}
                                                        {i === 0 && (
                                                            <span className="comparador-tag-mejor">Mejor precio</span>
                                                        )}
                                                    </td>
                                                    <td>{formatMoneda(oferta.precio)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </article>
                            );
                        })}
                    </div>
                )}
            </section>

            <section className="comparador-seccion">
                <h2 className="comparador-seccion-titulo">Explorar por categoría</h2>

                <div className="comparador-filtros">
                    <div className="comparador-buscador">
                        <Search size={16} strokeWidth={2} />
                        <input
                            type="text"
                            placeholder="Buscar por marca o modelo..."
                            value={busqueda}
                            onChange={(e) => setBusqueda(e.target.value)}
                        />
                    </div>

                    <select value={categoriaFiltro} onChange={(e) => setCategoriaFiltro(e.target.value)}>
                        <option value="">Todas las categorías</option>
                        {categorias.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                                {cat.nombre}
                            </option>
                        ))}
                    </select>

                    <select value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)}>
                        <option value="">Todos los tipos</option>
                        {Object.entries(TIPOS_PRODUCTO).map(([clave, t]) => (
                            <option key={clave} value={clave}>
                                {t.icono} {t.label}
                            </option>
                        ))}
                    </select>
                </div>

                {filtrados.length === 0 ? (
                    <p className="comparador-feedback">Ningún producto coincide con el filtro.</p>
                ) : (
                    <div className="comparador-tabla-wrap">
                        <table className="comparador-tabla comparador-tabla--ancha">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Tipo</th>
                                    <th>Proveedor</th>
                                    <th>Precio</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtrados.map((producto) => {
                                    const tipo = getTipoProducto(producto.tipo);
                                    return (
                                        <tr key={producto.id}>
                                            <td>
                                                {producto.marca} {producto.modelo}
                                            </td>
                                            <td>
                                                <span
                                                    className="comparador-badge"
                                                    style={{ color: tipo.color, backgroundColor: `${tipo.color}1c` }}
                                                >
                                                    {tipo.icono} {tipo.label}
                                                </span>
                                            </td>
                                            <td>{producto.proveedorNombre}</td>
                                            <td>{formatMoneda(producto.precio)}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

export default Comparador;
