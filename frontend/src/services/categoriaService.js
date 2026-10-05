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

export const actualizarCategoria = async (id, categoria) => {
  // categoria: { nombre, tipo } -- tipo: "equipo" | "materiales" | "mano_obra"
  const { data } = await axiosClient.put(`/categorias/${id}`, categoria);
  return data;
};

export const eliminarCategoria = async (id) => {
  const { data } = await axiosClient.delete(`/categorias/${id}`);
  return data;
};
