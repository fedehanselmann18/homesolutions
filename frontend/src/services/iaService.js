import axiosClient from "../api/axiosClient";

/**
 * Le pide al backend que lea un comprobante (factura/remito/recibo) con IA
 * y devuelva campos sueltos para prellenar el formulario. No sube ni guarda
 * nada -- el archivo sigue en el ComprobantesUploader tal cual estaba, y el
 * submit normal del modal sigue siendo el único que crea/guarda algo.
 *
 * @param {File} archivo
 * @param {"gasto"|"compra"|"cobro"} tipoEntidad
 * @param {{fases?: {id:string,nombre:string}[], categoriasGasto?: {id:string,nombre:string}[], proveedores?: {id:string,nombre:string,cuit?:string}[], productos?: {id:string,marca:string,modelo:string,proveedor_id:string}[], impuestos?: {id:string,nombre:string}[]}} contexto
 *   Catálogos que el modal ya tiene cargados (mismos que usa para los
 *   <select>), para que la IA pueda sugerir un id real y no solo un nombre.
 * @returns {Promise<{monto:number|null, fecha:string|null, tipo_factura:string|null,
 *   descripcion:string|null, proveedor_id:string|null, fase_id:string|null,
 *   categoria_gasto_id:string|null, detalle:{producto_id:string,cantidad:number}[],
 *   impuestos:{impuesto_id:string,monto:number}[], advertencias:string[]}>}
 */
export const extraerComprobanteConIA = async (archivo, tipoEntidad, contexto = {}) => {
  const formData = new FormData();
  formData.append("archivo", archivo);
  formData.append("tipo_entidad", tipoEntidad);
  formData.append(
    "contexto",
    JSON.stringify({
      fases: contexto.fases ?? [],
      categorias_gasto: contexto.categoriasGasto ?? [],
      proveedores: contexto.proveedores ?? [],
      productos: contexto.productos ?? [],
      impuestos: contexto.impuestos ?? [],
    })
  );

  const { data } = await axiosClient.post("/ia/extraer-comprobante", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};
