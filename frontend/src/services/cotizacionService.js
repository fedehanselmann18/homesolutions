import axiosClient from "../api/axiosClient";

// Tabla de cotizaciones del dólar: fuente de SUGERENCIA para precargar el
// form de carga (ver models.Cotizacion en el backend). Editarla no toca los
// movimientos ya cargados, que guardan su propia cotización congelada.

export const getCotizaciones = async () => {
  const { data } = await axiosClient.get("/cotizaciones/");
  return data;
};

/**
 * La más reciente hasta `fecha` (hoy si no viene), opcionalmente de un tipo.
 * Devuelve null si no hay ninguna: no es un error, el form se puede cargar
 * igual tipeando el valor.
 */
export const getUltimaCotizacion = async ({ tipo, fecha } = {}) => {
  const params = {};
  if (tipo) params.tipo = tipo;
  if (fecha) params.fecha = fecha;
  const { data } = await axiosClient.get("/cotizaciones/ultima", { params });
  return data;
};

export const crearCotizacion = async (cotizacion) => {
  // cotizacion: { fecha, tipo, valor }
  const { data } = await axiosClient.post("/cotizaciones/crear", cotizacion);
  return data;
};

export const actualizarCotizacion = async (id, cotizacion) => {
  const { data } = await axiosClient.put(`/cotizaciones/${id}`, cotizacion);
  return data;
};

export const eliminarCotizacion = async (id) => {
  const { data } = await axiosClient.delete(`/cotizaciones/${id}`);
  return data;
};
