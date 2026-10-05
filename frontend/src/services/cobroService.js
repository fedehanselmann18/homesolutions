import axiosClient from "../api/axiosClient";

export const getCobros = async () => {
  const { data } = await axiosClient.get("/cobros/");
  return data;
};

export const getCobrosPorProyecto = async (proyectoId) => {
  const { data } = await axiosClient.get(`/cobros/proyectos/${proyectoId}/cobros`);
  return data;
};

export const crearCobro = async (cobro) => {
  // cobro: { proyecto_id, monto_usd, cotizacion_dolar, tipo_cambio, descripcion,
  //          fecha, tipo_factura } -- monto_ars NO: lo congela el backend
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
  const { data } = await axiosClient.get(`/cobros/${cobroId}/comprobantes/${comprobanteId}`, {
    responseType: "blob",
  });
  return data;
};

export const eliminarComprobanteCobro = async (cobroId, comprobanteId) => {
  const { data } = await axiosClient.delete(`/cobros/${cobroId}/comprobantes/${comprobanteId}`);
  return data;
};

// --- Notas (cuenta corriente: nota de crédito / nota de débito) ---

export const crearNotaCobro = async (
  cobroId,
  {
    archivo,
    tipo,
    tipo_factura,
    monto_usd,
    cotizacion_dolar,
    tipo_cambio,
    descripcion,
    fecha,
    origen,
  }
) => {
  const formData = new FormData();
  formData.append("archivo", archivo);
  formData.append("tipo", tipo);
  formData.append("tipo_factura", tipo_factura);
  // En dólares, como el cobro; los pesos los congela el backend con la
  // cotización de la nota (no la del cobro: es otro día, otro dólar).
  formData.append("monto_usd", monto_usd);
  formData.append("cotizacion_dolar", cotizacion_dolar);
  formData.append("tipo_cambio", tipo_cambio);
  formData.append("descripcion", descripcion);
  formData.append("fecha", fecha);
  if (origen) formData.append("origen", origen);

  const { data } = await axiosClient.post(`/cobros/${cobroId}/notas`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const getNotaCobro = async (cobroId, notaId) => {
  const { data } = await axiosClient.get(`/cobros/${cobroId}/notas/${notaId}`, {
    responseType: "blob",
  });
  return data;
};

export const eliminarNotaCobro = async (cobroId, notaId) => {
  const { data } = await axiosClient.delete(`/cobros/${cobroId}/notas/${notaId}`);
  return data;
};
