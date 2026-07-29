import { useState, useEffect } from "react";
import {
  getCompras,
  getComprasPorFase,
  getComprasPorProyecto,
  crearCompra,
  actualizarCompra,
  eliminarCompra,
  agregarDetalleCompra,
  eliminarDetalleCompra,
  agregarImpuestoCompra,
  eliminarImpuestoCompra,
} from "../services/compraService";

// filtro: { faseId } o { proyectoId } (opcional, uno u otro)
export function useCompras(filtro = {}) {
  const { faseId, proyectoId } = filtro;
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const cargarCompras = async () => {
    try {
      setLoading(true);
      setError(null);
      let data;
      if (faseId) {
        data = await getComprasPorFase(faseId);
      } else if (proyectoId) {
        data = await getComprasPorProyecto(proyectoId);
      } else {
        data = await getCompras();
      }
      setCompras(data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarCompras();
  }, [faseId, proyectoId]);

  // Para crear, usar useCompraForm.js: arma detalle + impuestos y llama a esta función.
  const agregarCompra = async (compra) => {
    const nueva = await crearCompra(compra);
    setCompras((prev) => [...prev, nueva]);
    return nueva;
  };

  // Solo campos propios de la compra (no detalle/impuestos, usar los métodos de abajo)
  const editarCompra = async (compraId, cambios) => {
    const actualizada = await actualizarCompra(compraId, cambios);
    setCompras((prev) =>
      prev.map((c) => (c.id === compraId ? actualizada : c))
    );
    return actualizada;
  };

  const borrarCompra = async (compraId) => {
    await eliminarCompra(compraId);
    setCompras((prev) => prev.filter((c) => c.id !== compraId));
  };

  // Sub-recursos: la compra ya existe, se editan línea por línea.
  // Al no tener el objeto Compra completo actualizado devuelto por el backend,
  // se recarga la lista para reflejar el cambio (más simple y seguro que
  // reconstruir el anidado a mano en el estado local).

  const agregarDetalle = async (compraId, detalle) => {
    const nuevaLinea = await agregarDetalleCompra(compraId, detalle);
    await cargarCompras();
    return nuevaLinea;
  };

  const borrarDetalle = async (compraId, detalleId) => {
    await eliminarDetalleCompra(compraId, detalleId);
    await cargarCompras();
  };

  const agregarImpuesto = async (compraId, impuesto) => {
    const nuevoImpuesto = await agregarImpuestoCompra(compraId, impuesto);
    await cargarCompras();
    return nuevoImpuesto;
  };

  const borrarImpuesto = async (compraId, impuestoAplicadoId) => {
    await eliminarImpuestoCompra(compraId, impuestoAplicadoId);
    await cargarCompras();
  };

  return {
    compras,
    loading,
    error,
    recargar: cargarCompras,
    agregarCompra,
    editarCompra,
    borrarCompra,
    agregarDetalle,
    borrarDetalle,
    agregarImpuesto,
    borrarImpuesto,
  };
}
