import axiosClient from "../api/axiosClient";

export const getCategoriasGasto = async () => {
  const { data } = await axiosClient.get("/categorias-gasto/");
  return data;
};

export const crearCategoriaGasto = async (categoria) => {
  // categoria: { nombre }
  const { data } = await axiosClient.post("/categorias-gasto/crear", categoria);
  return data;
};

export const actualizarCategoriaGasto = async (id, categoria) => {
  // categoria: { nombre }
  const { data } = await axiosClient.put(`/categorias-gasto/${id}`, categoria);
  return data;
};

export const eliminarCategoriaGasto = async (id) => {
  const { data } = await axiosClient.delete(`/categorias-gasto/${id}`);
  return data;
};
