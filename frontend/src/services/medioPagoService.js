import axiosClient from "../api/axiosClient";

// Medios de pago (Efectivo, Transferencia, Cheque...): las opciones de «Medio
// de pago» de compras y gastos. Los movimientos guardan el `codigo`; el
// `nombre` es lo que se muestra. Uno desactivado (`activo: false`) viene en la
// lista pero no se ofrece al cargar.
export const getMediosPago = async () => {
  const { data } = await axiosClient.get("/medios-pago/");
  return data;
};

export const crearMedioPago = async (medio) => {
  // medio: { nombre } -- el código lo arma el backend y no cambia nunca
  const { data } = await axiosClient.post("/medios-pago/crear", medio);
  return data;
};

export const actualizarMedioPago = async (id, medio) => {
  // medio: { nombre?, activo? }
  const { data } = await axiosClient.put(`/medios-pago/${id}`, medio);
  return data;
};

export const eliminarMedioPago = async (id) => {
  const { data } = await axiosClient.delete(`/medios-pago/${id}`);
  return data;
};
