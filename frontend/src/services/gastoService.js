import axiosClient from "../api/axiosClient";

export const getGastos = async () => {
  const { data } = await axiosClient.get("/gastos/");
  return data;
};

export const getGastoPorId = async (gastoId) => {
  const { data } = await axiosClient.get(`/gastos/${gastoId}`);
  return data;
};

export const getGastosPorProyecto = async (proyectoId) => {
  const { data } = await axiosClient.get(`/gastos/proyectos/${proyectoId}/gastos`);
  return data;
};

export const getGastosPorFase = async (faseId) => {
  const { data } = await axiosClient.get(`/gastos/fases/${faseId}/gastos`);
  return data;
};

export const crearGasto = async (gasto) => {
  // gasto: { proyecto_id, fase_id (opcional), monto, descripcion, fecha,
  //          tipo_factura, categoria_gasto_ids: [] }
  const { data } = await axiosClient.post("/gastos/crear", gasto);
  return data;
};

export const actualizarGasto = async (gastoId, cambios) => {
  const { data } = await axiosClient.put(`/gastos/${gastoId}`, cambios);
  return data;
};

export const eliminarGasto = async (gastoId) => {
  const { data } = await axiosClient.delete(`/gastos/${gastoId}`);
  return data;
};

export const subirComprobanteGasto = async (gastoId, archivo) => {
  const formData = new FormData();
  formData.append("archivo", archivo);

  const { data } = await axiosClient.post(`/gastos/${gastoId}/comprobantes`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const getComprobanteGasto = async (gastoId, comprobanteId) => {
  const { data } = await axiosClient.get(`/gastos/${gastoId}/comprobantes/${comprobanteId}`, {
    responseType: "blob",
  });
  return data;
};

export const eliminarComprobanteGasto = async (gastoId, comprobanteId) => {
  const { data } = await axiosClient.delete(`/gastos/${gastoId}/comprobantes/${comprobanteId}`);
  return data;
};
