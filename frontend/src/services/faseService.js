import axiosClient from "../api/axiosClient";

export const getFases = async () => {
  const { data } = await axiosClient.get("/fases/");
  return data;
};

export const getFasePorId = async (faseId) => {
  const { data } = await axiosClient.get(`/fases/${faseId}`);
  return data;
};

export const getFasesPorProyecto = async (proyectoId) => {
  const { data } = await axiosClient.get(`/fases/proyectos/${proyectoId}/fases`);
  return data;
};

export const crearFase = async (fase) => {
  // fase: { proyecto_id, nombre, descripcion, estado }
  const { data } = await axiosClient.post("/fases/crear", fase);
  return data;
};

export const actualizarFase = async (faseId, cambios) => {
  const { data } = await axiosClient.put(`/fases/${faseId}`, cambios);
  return data;
};

export const eliminarFase = async (faseId) => {
  const { data } = await axiosClient.delete(`/fases/${faseId}`);
  return data;
};
