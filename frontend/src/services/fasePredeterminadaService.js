import axiosClient from "../api/axiosClient";

// Nombres predeterminados de fase: las opciones del select del modal de fase.
// Vienen ya en orden (1, 2, 3...); una nueva va al final.
export const getFasesPredeterminadas = async () => {
  const { data } = await axiosClient.get("/fases-predeterminadas/");
  return data;
};

export const crearFasePredeterminada = async (fase) => {
  // fase: { nombre }
  const { data } = await axiosClient.post("/fases-predeterminadas/crear", fase);
  return data;
};

export const actualizarFasePredeterminada = async (id, fase) => {
  // fase: { nombre }
  const { data } = await axiosClient.put(`/fases-predeterminadas/${id}`, fase);
  return data;
};

export const eliminarFasePredeterminada = async (id) => {
  const { data } = await axiosClient.delete(`/fases-predeterminadas/${id}`);
  return data;
};
