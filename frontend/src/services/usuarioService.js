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

export const getUsuarioActual = async () => {
  const { data } = await axiosClient.get("/usuarios/me");
  return data;
};

export const getUsuarioPorId = async (usuarioId) => {
  const { data } = await axiosClient.get(`/usuarios/${usuarioId}`);
  return data;
};

export const crearUsuario = async (usuario) => {
  // usuario: { nombre_usuario, rol, password }
  const { data } = await axiosClient.post("/usuarios/crear", usuario);
  return data;
};