import axiosClient from "../api/axiosClient";

export const getCategoriasGasto = async () => {
  const { data } = await axiosClient.get("/categorias-gasto/");
  return data;
};
