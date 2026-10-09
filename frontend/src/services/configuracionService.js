import axiosClient from "../api/axiosClient";

// Panel de configuración de Manager: exclusivo de
// esa cuenta (403 para cualquier otra, incluidos los admin del equipo -- ver
// requiere_manager en el backend).

// Claves editables con su valor efectivo (fila de la tabla `configuracion`
// o default de Settings/.env si no hay fila) -- ver ConfiguracionValor en
// el backend.
export const getConfiguracion = async () => {
  const { data } = await axiosClient.get("/configuracion/");
  return data;
};

// Estado -- solo lectura -- de las integraciones externas (bucket, Gemini):
// dependen de variables que nunca pasan por esta tabla (son credenciales).
export const getEstadoIntegraciones = async () => {
  const { data } = await axiosClient.get("/configuracion/estado-integraciones");
  return data;
};

export const actualizarConfiguracion = async (clave, valor) => {
  const { data } = await axiosClient.patch(`/configuracion/${clave}`, { valor });
  return data;
};

// Borra la fila: el valor efectivo vuelve a ser el de Settings/.env.
export const restaurarConfiguracion = async (clave) => {
  const { data } = await axiosClient.delete(`/configuracion/${clave}`);
  return data;
};
