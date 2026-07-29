import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { useProveedores } from "../hooks/useProveedores";
import { getProductos } from "../services/productoService";
import { getCompras } from "../services/compraService";
import { getCategorias } from "../services/categoriaService";
import { getTipoProducto } from "../constants/tipoProducto";
import { calcularResumenProveedor, rubroPrincipal } from "../utils/proveedores";
import useAuth from "../context/useAuth";

import ProveedorCard from "../components/proveedores/ProveedorCard";
import ModalProveedor from "../components/modals/ModalProveedor";
import "./Proveedores.css";

export function Proveedores() {
    const { usuario } = useAuth();
    const canManage = usuario?.rol === "admin";

    const {
        proveedores,
        loading,
        error,
        agregarProveedor,
        editarProveedor,
        borrarProveedor,
    } = useProveedores();

    const [productos, setProductos] = useState([]);
    const [compras, setCompras] = useState([]);
    const [categorias, setCategorias] = useState([]);

    const [busqueda, setBusqueda] = useState("");
    const [categoriaFiltro, setCategoriaFiltro] = useState("");

    const [modalAbierto, setModalAbierto] = useState(false);
    const [proveedorSeleccionado, setProveedorSeleccionado] = useState(null);

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
        if (proveedorSeleccionado) {
            await editarProveedor(proveedorSeleccionado.id, datos);
        } else {
            await agregarProveedor(datos);
        }
        cerrarModal();
    };

    const handleEliminar = async (proveedor) => {
        try {
            await borrarProveedor(proveedor.id);
        } catch (err) {
            console.error("Error eliminando proveedor:", err);
        }
    };

    if (loading) return <p>Cargando proveedores...</p>;
    if (error) return <p>Error al cargar los proveedores.</p>;

    return (
        <div className="proveedores-container">
            <header className="proveedores-header">
                <div className="proveedores-header__texto">
                    <h1 className="proveedores-header__titulo">Proveedores</h1>
                    <p className="proveedores-header__subtitulo">
                        {proveedores.length} {proveedores.length === 1 ? "proveedor cargado" : "proveedores cargados"}
                    </p>
                </div>

                {canManage && (
                    <button className="proveedores-button" onClick={abrirModalCrear}>
                        Nuevo proveedor
                    </button>
                )}
            </header>

            <div className="proveedores-filtros">
                <div className="proveedores-buscador">
                    <Search size={16} strokeWidth={2} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre..."
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
            </div>

            {proveedoresFiltrados.length === 0 ? (
                <p className="proveedores-feedback">
                    {proveedores.length === 0
                        ? "No hay proveedores todavía. ¡Cargá el primero!"
                        : "Ningún proveedor coincide con la búsqueda."}
                </p>
            ) : (
                <div className="proveedores-grid">
                    {proveedoresFiltrados.map(({ proveedor, cantidadProductos, totalComprado, deuda, rubro }) => (
                        <ProveedorCard
                            key={proveedor.id}
                            proveedor={proveedor}
                            rubro={rubro}
                            cantidadProductos={cantidadProductos}
                            totalComprado={totalComprado}
                            deuda={deuda}
                            onEditar={abrirModalEditar}
                            onEliminar={handleEliminar}
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
        </div>
    );
}

export default Proveedores;
