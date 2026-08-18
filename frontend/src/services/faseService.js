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

// direccion: "arriba" | "abajo". Intercambia el número de esta fase con el
// de su vecina en esa dirección (dentro del mismo proyecto). Devuelve la
// lista completa de fases del proyecto ya reordenada.
export const moverFase = async (faseId, direccion) => {
  const { data } = await axiosClient.patch(`/fases/${faseId}/mover`, { direccion });
  return data;
};
