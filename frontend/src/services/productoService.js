import axiosClient from "../api/axiosClient";

export const getProductos = async () => {
  const { data } = await axiosClient.get("/productos/");
  return data;
};

export const getProductosPorProveedor = async (proveedorId) => {
  const { data } = await axiosClient.get(`/productos/proveedores/${proveedorId}/productos`);
  return data;
};

export const crearProducto = async (producto) => {
  // producto: { proveedor_id, marca, modelo, tipo, categoria_ids: [] }
  const { data } = await axiosClient.post("/productos/crear", producto);
  return data;
};

export const actualizarProducto = async (productoId, cambios) => {
  // cambios puede incluir categoria_ids (reemplaza la relación M2M completa, no suma)
  const { data } = await axiosClient.put(`/productos/${productoId}`, cambios);
  return data;
};

export const eliminarProducto = async (productoId) => {
  const { data } = await axiosClient.delete(`/productos/${productoId}`);
  return data;
};
