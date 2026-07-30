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

// --- Comprobantes (archivos: factura, remito...) ---

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

// --- Notas (cuenta corriente: nota de crédito / nota de débito) ---

export const crearNotaCompra = async (
  compraId,
  { archivo, tipo, tipo_factura, monto, descripcion, fecha, origen, detalles, impuestos }
) => {
  // Para origen="devolucion_producto" el monto NO se manda: se calcula solo
  // en el backend a partir de `detalles` (+ `impuestos` opcionales). Para
  // cualquier otro origen (acuerdo_comercial/otro) o nota_debito, `monto` es
  // el que tipeó el usuario a mano y `detalles`/`impuestos` van vacíos.
  const formData = new FormData();
  formData.append("archivo", archivo);
  formData.append("tipo", tipo);
  formData.append("tipo_factura", tipo_factura);
  formData.append("descripcion", descripcion);
  formData.append("fecha", fecha);
  if (origen) formData.append("origen", origen);

  if (detalles && detalles.length > 0) {
    formData.append("detalles_json", JSON.stringify(detalles));
  } else {
    formData.append("monto", monto);
  }
  if (impuestos && impuestos.length > 0) {
    formData.append("impuestos_json", JSON.stringify(impuestos));
  }

  const { data } = await axiosClient.post(`/compras/${compraId}/notas`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};

export const getNotaCompra = async (compraId, notaId) => {
  const { data } = await axiosClient.get(
    `/compras/${compraId}/notas/${notaId}`,
    { responseType: "blob" }
  );
  return data;
};

export const eliminarNotaCompra = async (compraId, notaId) => {
  const { data } = await axiosClient.delete(`/compras/${compraId}/notas/${notaId}`);
  return data;
};