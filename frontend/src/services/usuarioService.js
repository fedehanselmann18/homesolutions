import axiosClient from "../api/axiosClient";

export const getUsuarios = async () => {
  const { data } = await axiosClient.get("/usuarios/");
  return data;
};

// Público (sin sesión): solo nombres de usuario, para el combo de login.
export const getOpcionesLogin = async () => {
  const { data } = await axiosClient.get("/usuarios/login-options");
  return data;
};

// Público (sin sesión): nombres autorizados que TODAVÍA no tienen cuenta,
// para el combo de /registro. Antes esta lista estaba hardcodeada en el
// front; ahora la maneja Manager desde la app (tabla usuarios_autorizados).
export const getOpcionesRegistro = async () => {
  const { data } = await axiosClient.get("/usuarios/opciones-registro");
  return data;
};

export const getUsuarioActual = async () => {
  const { data } = await axiosClient.get("/usuarios/me");
  return data;
};

export const crearUsuario = async (usuario) => {
  // usuario: { nombre_usuario, rol, password }
  const { data } = await axiosClient.post("/usuarios/crear", usuario);
  return data;
};

// ---------------------------------------------------------------------------
// Mantenimiento de cuentas: TODO lo de acá abajo es exclusivo de la cuenta
// "Manager" (403 para cualquier otra, incluidos los admin del equipo -- ver
// requiere_manager en el backend).
// ---------------------------------------------------------------------------

// La sesión activa de esa persona queda invalidada por el reseteo.
export const resetearPasswordUsuario = async (usuarioId, password) => {
  const { data } = await axiosClient.post(`/usuarios/${usuarioId}/resetear-password`, { password });
  return data;
};

// El rol nuevo aplica en el próximo request de esa persona, sin desloguearla.
export const cambiarRolUsuario = async (usuarioId, rol) => {
  const { data } = await axiosClient.patch(`/usuarios/${usuarioId}/rol`, { rol });
  return data;
};

// Corta la sesión sin tocarle la contraseña: entra de nuevo con la misma.
export const cerrarSesionUsuario = async (usuarioId) => {
  const { data } = await axiosClient.post(`/usuarios/${usuarioId}/cerrar-sesion`);
  return data;
};

// Baja temporal: no puede loguearse ni sostener la sesión abierta.
export const desactivarUsuario = async (usuarioId) => {
  const { data } = await axiosClient.post(`/usuarios/${usuarioId}/desactivar`);
  return data;
};

export const reactivarUsuario = async (usuarioId) => {
  const { data } = await axiosClient.post(`/usuarios/${usuarioId}/reactivar`);
  return data;
};

// Whitelist de autoregistro (quién puede crearse cuenta en /registro).
export const getUsuariosAutorizados = async () => {
  const { data } = await axiosClient.get("/usuarios/autorizados");
  return data;
};

export const autorizarUsuario = async (nombreUsuario, rol) => {
  const { data } = await axiosClient.post("/usuarios/autorizados", {
    nombre_usuario: nombreUsuario,
    rol,
  });
  return data;
};

export const revocarAutorizacion = async (autorizadoId) => {
  await axiosClient.delete(`/usuarios/autorizados/${autorizadoId}`);
};
