import axiosClient from "../api/axiosClient";

// --- Compra (CRUD principal) ---

export const getCompras = async () => {
  const { data } = await axiosClient.get("/compras/");
  return data;
};

export const getCompraPorId = async (compraId) => {
  const { data } = await axiosClient.get(`/compras/${compraId}`);
  return data;
};

export const getComprasPorFase = async (faseId) => {
  const { data } = await axiosClient.get(`/compras/fases/${faseId}/compras`);
  return data;
};

export const getComprasPorProyecto = async (proyectoId) => {
  const { data } = await axiosClient.get(`/compras/proyectos/${proyectoId}/compras`);
  return data;
};

export const crearCompra = async (compra) => {
  // compra: { fase_id, proveedor_id, descripcion, precio_neto, tipo_factura,
  //           fecha, condicion_pago, estado_pago, estado_envio,
  //           detalle: [{ producto_id, cantidad, precio_unitario }],
  //           impuestos: [{ impuesto_id, monto }] }
  // usuario_id lo agrega el backend solo, del JWT
  const { data } = await axiosClient.post("/compras/crear", compra);
  return data;
};

export const actualizarCompra = async (compraId, cambios) => {
  // Solo campos propios de la compra. Para tocar detalle/impuestos usar los endpoints de abajo.
  const { data } = await axiosClient.put(`/compras/${compraId}`, cambios);
  return data;
};

export const eliminarCompra = async (compraId) => {
  const { data } = await axiosClient.delete(`/compras/${compraId}`);
  return data;
};

// --- Detalle de compra (líneas de producto) ---

export const agregarDetalleCompra = async (compraId, detalle) => {
  // detalle: { producto_id, cantidad, precio_unitario }
  const { data } = await axiosClient.post(`/compras/${compraId}/detalle`, detalle);
  return data;
};

export const eliminarDetalleCompra = async (compraId, detalleId) => {
  const { data } = await axiosClient.delete(`/compras/${compraId}/detalle/${detalleId}`);
  return data;
};

// --- Impuestos aplicados a la compra ---

export const agregarImpuestoCompra = async (compraId, impuesto) => {
  // impuesto: { impuesto_id, monto }
  const { data } = await axiosClient.post(`/compras/${compraId}/impuestos`, impuesto);
  return data;
};

export const eliminarImpuestoCompra = async (compraId, impuestoAplicadoId) => {
  const { data } = await axiosClient.delete(`/compras/${compraId}/impuestos/${impuestoAplicadoId}`);
  return data;
};

// --- Comprobantes (archivos) ---

export const subirComprobanteCompra = async (compraId, archivo) => {
  const formData = new FormData();
  formData.append("archivo", archivo);

  const { data } = await axiosClient.post(`/compras/${compraId}/comprobantes`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const getComprobanteCompra = async (compraId, comprobanteId) => {
  const { data } = await axiosClient.get(
    `/compras/${compraId}/comprobantes/${comprobanteId}`,
    { responseType: "blob" } // el backend devuelve el archivo, no JSON
  );
  return data;
};

export const eliminarComprobanteCompra = async (compraId, comprobanteId) => {
  const { data } = await axiosClient.delete(`/compras/${compraId}/comprobantes/${comprobanteId}`);
  return data;
};