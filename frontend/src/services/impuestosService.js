import axiosClient from "../api/axiosClient";

export const getImpuestos = async () => {
  const { data } = await axiosClient.get("/impuestos/");
  return data;
};

export const getImpuestoPorId = async (impuestoId) => {
  const { data } = await axiosClient.get(`/impuestos/${impuestoId}`);
  return data;
};

export const crearImpuesto = async (impuesto) => {
  // impuesto: { nombre }
  const { data } = await axiosClient.post("/impuestos/crear", impuesto);
  return data;
};

export const actualizarImpuesto = async (impuestoId, cambios) => {
  const { data } = await axiosClient.put(`/impuestos/${impuestoId}`, cambios);
  return data;
};

export const eliminarImpuesto = async (impuestoId) => {
  const { data } = await axiosClient.delete(`/impuestos/${impuestoId}`);
  return data;
};
