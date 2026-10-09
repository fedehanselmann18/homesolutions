import axiosClient from "../api/axiosClient";

// Condiciones de pago (Contado, 30 días, 30/60 días...): cuándo se paga una
// compra o un gasto. Vienen en orden; «Contado» viene con protegido: true.
export const getCondicionesPago = async () => {
  const { data } = await axiosClient.get("/condiciones-pago/");
  return data;
};

export const crearCondicionPago = async (condicion) => {
  // condicion: { nombre, dias: [30, 60] }
  const { data } = await axiosClient.post("/condiciones-pago/crear", condicion);
  return data;
};

export const actualizarCondicionPago = async (id, condicion) => {
  const { data } = await axiosClient.put(`/condiciones-pago/${id}`, condicion);
  return data;
};

export const eliminarCondicionPago = async (id) => {
  const { data } = await axiosClient.delete(`/condiciones-pago/${id}`);
  return data;
};
