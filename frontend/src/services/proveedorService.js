import axiosClient from "../api/axiosClient";

export const getProveedores = async () => {
  const { data } = await axiosClient.get("/proveedores/");
  return data;
};

export const getProveedorPorId = async (proveedorId) => {
  const { data } = await axiosClient.get(`/proveedores/${proveedorId}`);
  return data;
};

export const crearProveedor = async (proveedor) => {
  // proveedor: { nombre, cuit, direccion, telefono, email }
  const { data } = await axiosClient.post("/proveedores/crear", proveedor);
  return data;
};

export const actualizarProveedor = async (proveedorId, cambios) => {
  const { data } = await axiosClient.put(`/proveedores/${proveedorId}`, cambios);
  return data;
};

export const eliminarProveedor = async (proveedorId) => {
  const { data } = await axiosClient.delete(`/proveedores/${proveedorId}`);
  return data;
};
