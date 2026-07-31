import axiosClient from "../api/axiosClient";

export const login = async (nombreUsuario, password) => {
  const params = new URLSearchParams();
  params.append("username", nombreUsuario);
  params.append("password", password);

  // El backend setea la cookie httpOnly de sesión (y la de csrf_token) en
  // la respuesta -- no hay nada que guardar acá, el browser la maneja sola.
  const { data } = await axiosClient.post("/auth/login", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  return data;
};

export const logout = async () => {
  // Tiene que ser el backend el que borre la cookie: al ser httpOnly, JS
  // no puede tocarla desde acá.
  await axiosClient.post("/auth/logout");
};
