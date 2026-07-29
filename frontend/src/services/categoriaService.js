import axiosClient from "../api/axiosClient";

export const getCategorias = async () => {
  const { data } = await axiosClient.get("/categorias/");
  return data;
};

export const getCategoriaPorId = async (categoriaId) => {
  const { data } = await axiosClient.get(`/categorias/${categoriaId}`);
  return data;
};

export const crearCategoria = async (categoria) => {
  // categoria: { nombre, tipo }
  const { data } = await axiosClient.post("/categorias/crear", categoria);
  return data;
};

export const actualizarCategoria = async (categoriaId, cambios) => {
  const { data } = await axiosClient.put(`/categorias/${categoriaId}`, cambios);
  return data;
};

export const eliminarCategoria = async (categoriaId) => {
  const { data } = await axiosClient.delete(`/categorias/${categoriaId}`);
  return data;
};