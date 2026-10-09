import axiosClient from "../api/axiosClient";

// Marca o desmarca un plazo de pago de una compra o un gasto. Sin fecha, el
// backend pone la de hoy. El estado del movimiento se recalcula solo.
export const marcarPlazoPago = async (id, { pagado, fecha_pago } = {}) => {
  const { data } = await axiosClient.put(`/plazos-pago/${id}`, { pagado, fecha_pago });
  return data;
};
