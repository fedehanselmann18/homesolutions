import axios from 'axios';

const axiosClient = axios.create({
    baseURL : import.meta.env.VITE_API_URL,
});

// Antes de cada request, si hay token guardado, lo mandamos en el header
axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Si el backend responde 401 (token vencido o inválido), limpiamos y mandamos al login
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default axiosClient;