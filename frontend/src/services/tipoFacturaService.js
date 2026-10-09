import axiosClient from "../api/axiosClient";

// Tipos de factura (Factura A, Remito, Factura interna...): las opciones de
// compras, gastos, cobros y notas. Vienen en orden, con «Otros» último.
// Los movimientos guardan el `codigo`; el `nombre` es lo que se muestra.
export const getTiposFactura = async () => {
  const { data } = await axiosClient.get("/tipos-factura/");
  return data;
};

export const crearTipoFactura = async (tipo) => {
  // tipo: { nombre } -- el código lo arma el backend y no cambia nunca
  const { data } = await axiosClient.post("/tipos-factura/crear", tipo);
  return data;
};

export const actualizarTipoFactura = async (id, tipo) => {
  // tipo: { nombre }
  const { data } = await axiosClient.put(`/tipos-factura/${id}`, tipo);
  return data;
};

export const eliminarTipoFactura = async (id) => {
  const { data } = await axiosClient.delete(`/tipos-factura/${id}`);
  return data;
};
