import axiosClient from "../api/axiosClient";

export const getCategorias = async () => {
  const { data } = await axiosClient.get("/categorias/");
  return data;
};

export const crearCategoria = async (categoria) => {
  // categoria: { nombre, tipo }
  const { data } = await axiosClient.post("/categorias/crear", categoria);
  return data;
};
