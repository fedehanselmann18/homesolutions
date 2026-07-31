import axiosClient from "../api/axiosClient";

export const getProyectos = async () => {
  const { data } = await axiosClient.get("/proyectos/");
  return data;
};

export const getProyectoPorId = async (proyectoId) => {
  const { data } = await axiosClient.get(`/proyectos/${proyectoId}`);
  return data;
};

export const crearProyecto = async (proyecto) => {
  // proyecto: { nombre, direccion, fecha_inicio, estado, precio_acordado }
  const { data } = await axiosClient.post("/proyectos/crear", proyecto);
  return data;
};

export const actualizarProyecto = async (proyectoId, cambios) => {
  // cambios: campos parciales (el backend usa exclude_unset)
  const { data } = await axiosClient.put(`/proyectos/${proyectoId}`, cambios);
  return data;
};

export const eliminarProyecto = async (proyectoId) => {
  const { data } = await axiosClient.delete(`/proyectos/${proyectoId}`);
  return data;
};

// Reporte PDF (resumen financiero, cascada, notas, fases, deuda a
// proveedores). Devuelve el blob para que quien llama arme la descarga.
export const descargarReportePdfProyecto = async (proyectoId) => {
  const { data } = await axiosClient.get(`/proyectos/${proyectoId}/reporte-pdf`, {
    responseType: "blob",
  });
  return data;
};