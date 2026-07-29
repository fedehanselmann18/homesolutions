import axiosClient from "../api/axiosClient";

export const getCategoriasGasto = async () => {
  const { data } = await axiosClient.get("/categorias-gasto/");
  return data;
};

export const getCategoriaGastoPorId = async (categoriaId) => {
  const { data } = await axiosClient.get(`/categorias-gasto/${categoriaId}`);
  return data;
};

export const crearCategoriaGasto = async (categoria) => {
  // categoria: { nombre }
  const { data } = await axiosClient.post("/categorias-gasto/crear", categoria);
  return data;
};

export const actualizarCategoriaGasto = async (categoriaId, cambios) => {
  const { data } = await axiosClient.put(`/categorias-gasto/${categoriaId}`, cambios);
  return data;
};

export const eliminarCategoriaGasto = async (categoriaId) => {
  const { data } = await axiosClient.delete(`/categorias-gasto/${categoriaId}`);
  return data;
};