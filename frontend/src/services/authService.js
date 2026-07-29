import axiosClient from "../api/axiosClient";

export const login = async (nombreUsuario, password) => {
  const params = new URLSearchParams();
  params.append("username", nombreUsuario);
  params.append("password", password);

  const { data } = await axiosClient.post("/auth/login", params, {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  localStorage.setItem("token", data.access_token);
  return data;
};

export const logout = () => {
  localStorage.removeItem("token");
};