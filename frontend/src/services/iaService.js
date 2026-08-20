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

/**
 * Le pide al backend que lea un catálogo de proveedor (Excel/CSV, PDF o
 * foto de una lista de precios) con IA, para prellenar la vista previa de
 * ModalImportarCatalogo. No sube ni guarda nada -- la creación/actualización
 * real la hace el front después, llamando a los endpoints normales de
 * proveedores/productos con lo que el usuario confirmó.
 *
 * @param {File} archivo
 * @param {string|null} proveedorId Si el catálogo es de un proveedor que ya
 *   existe, se manda su id y la IA no intenta resolver uno. Si es null, la
 *   IA intenta leer el proveedor del documento y lo devuelve en
 *   proveedor_sugerido.
 * @param {{proveedores?: {id:string,nombre:string,cuit?:string}[], productos?: {id:string,marca:string,modelo:string,tipo:string,precio:number}[], categorias?: {id:string,nombre:string,tipo:string}[]}} contexto
 *   `productos` solo tiene sentido si ya se manda proveedorId -- es el
 *   catálogo actual de ESE proveedor, para clasificar cada fila detectada.
 *   `categorias` es el catálogo completo, para sugerir categoria_ids en los
 *   productos nuevos.
 */
export const leerCatalogoConIA = async (archivo, proveedorId, contexto = {}) => {
  const formData = new FormData();
  formData.append("archivo", archivo);
  if (proveedorId) formData.append("proveedor_id", proveedorId);
  formData.append(
    "contexto",
    JSON.stringify({
      proveedores: contexto.proveedores ?? [],
      productos: contexto.productos ?? [],
      categorias: contexto.categorias ?? [],
    })
  );

  const { data } = await axiosClient.post("/ia/leer-catalogo", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
};
