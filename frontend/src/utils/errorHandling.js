// Helper centralizado para traducir errores de axios a un mensaje en
// español apto para mostrarle al usuario -- nunca el número de status crudo
// ni texto tipo "Request failed with status code X" (eso es err.message,
// no lo que mandó el backend). Ver detail real en err.response.data.detail.

const MENSAJES_POR_STATUS = {
  401: "Tu sesión expiró o no es válida.",
  403: "No tenés permisos para hacer esto.",
  404: "No se encontró lo que buscabas.",
  429: "Demasiados intentos. Esperá un momento y probá de nuevo.",
};

const MENSAJE_SIN_CONEXION = "No se pudo conectar con el servidor. Revisá tu conexión.";
const MENSAJE_GENERICO = "Ocurrió un error inesperado. Intentá de nuevo.";

// El backend arma su "detail" a propósito para mostrarlo tal cual (ej. "Una
// o más categorías no existen") -- si vino como string usable, es ese texto.
// Si vino como array (shape típico de un 422 de Pydantic sin nuestro
// exception_handler, o algún endpoint que no lo tenga cubierto), no hay un
// mensaje puntual que mostrar, así que se trata como "no hay detail usable".
export function obtenerDetalleBackend(error) {
  const detail = error?.response?.data?.detail;
  return typeof detail === "string" && detail.trim() ? detail : null;
}

export function obtenerMensajeError(error) {
  const respuesta = error?.response;

  if (!respuesta) {
    return MENSAJE_SIN_CONEXION;
  }

  const detalle = obtenerDetalleBackend(error);
  if (detalle) {
    return detalle;
  }

  if (Array.isArray(respuesta.data?.detail) && respuesta.data.detail.length > 0) {
    return "Revisá los datos ingresados.";
  }

  return MENSAJES_POR_STATUS[respuesta.status] ?? MENSAJE_GENERICO;
}
