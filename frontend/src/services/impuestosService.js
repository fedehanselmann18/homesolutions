import axiosClient from "../api/axiosClient";

export const getImpuestos = async () => {
  const { data } = await axiosClient.get("/impuestos/");
  return data;
};

export const crearImpuesto = async (impuesto) => {
  // impuesto: { nombre }
  const { data } = await axiosClient.post("/impuestos/crear", impuesto);
  return data;
};

export const actualizarImpuesto = async (id, impuesto) => {
  // impuesto: { nombre }
  const { data } = await axiosClient.put(`/impuestos/${id}`, impuesto);
  return data;
};

export const eliminarImpuesto = async (id) => {
  const { data } = await axiosClient.delete(`/impuestos/${id}`);
  return data;
};
