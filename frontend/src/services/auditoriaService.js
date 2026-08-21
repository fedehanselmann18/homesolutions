import axiosClient from "../api/axiosClient";

// Rastro de auditoría: exclusivo de la cuenta "Manager" (403 para cualquier
// otra, incluidos los admin del equipo -- ver requiere_manager en el
// backend). Solo lectura: las filas las escribe el backend en cada acción
// auditada, y no hay forma de borrarlas desde la app.

// filtros: { tipo_recurso, usuario_id, desde, hasta, limit, offset }.
// Los vacíos se descartan para no mandar "?tipo_recurso=" y que el backend
// lo tome como filtro por string vacío.
export const getAuditoria = async (filtros = {}) => {
  const params = Object.fromEntries(
    Object.entries(filtros).filter(
      ([, valor]) => valor !== "" && valor !== null && valor !== undefined
    )
  );
  const { data } = await axiosClient.get("/auditoria/", { params });
  return data; // { items, total }
};

// Los tipos de recurso que realmente existen en la tabla, para armar el
// combo de filtro sin hardcodear la lista acá.
export const getTiposAuditoria = async () => {
  const { data } = await axiosClient.get("/auditoria/tipos");
  return data;
};
