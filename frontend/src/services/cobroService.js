import axiosClient from "../api/axiosClient";

export const getCobros = async () => {
  const { data } = await axiosClient.get("/cobros/");
  return data;
};

export const getCobroPorId = async (cobroId) => {
  const { data } = await axiosClient.get(`/cobros/${cobroId}`);
  return data;
};

export const getCobrosPorProyecto = async (proyectoId) => {
  const { data } = await axiosClient.get(`/cobros/proyectos/${proyectoId}/cobros`);
  return data;
};

export const crearCobro = async (cobro) => {
  // cobro: { proyecto_id, monto, descripcion, fecha, tipo_factura }
  const { data } = await axiosClient.post("/cobros/crear", cobro);
  return data;
};

export const actualizarCobro = async (cobroId, cambios) => {
  const { data } = await axiosClient.put(`/cobros/${cobroId}`, cambios);
  return data;
};

export const eliminarCobro = async (cobroId) => {
  const { data } = await axiosClient.delete(`/cobros/${cobroId}`);
  return data;
};

export const subirComprobanteCobro = async (cobroId, archivo) => {
  const formData = new FormData();
  formData.append("archivo", archivo);

  const { data } = await axiosClient.post(`/cobros/${cobroId}/comprobantes`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const getComprobanteCobro = async (cobroId, comprobanteId) => {
  const { data } = await axiosClient.get(
    `/cobros/${cobroId}/comprobantes/${comprobanteId}`,
    { responseType: "blob" }
  );
  return data;
};

export const eliminarComprobanteCobro = async (cobroId, comprobanteId) => {
  const { data } = await axiosClient.delete(`/cobros/${cobroId}/comprobantes/${comprobanteId}`);
  return data;
};