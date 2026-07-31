import axios from 'axios';

const axiosClient = axios.create({
    baseURL : import.meta.env.VITE_API_URL,
    // El JWT ahora viaja en una cookie httpOnly, no en localStorage: el
    // browser tiene que adjuntarla sola en cada request cross-origin
    // (front en Vercel, back en Railway), y para eso axios necesita
    // withCredentials en true.
    withCredentials: true,
});

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

// La cookie csrf_token NO es httpOnly a propósito (ver login.py): la
// leemos acá para reenviarla como header en cada request que modifica
// datos, como exige security_middleware.py del backend.
function leerCookie(nombre) {
  const match = document.cookie.match(new RegExp(`(?:^|; )${nombre}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

axiosClient.interceptors.request.use((config) => {
  const metodo = config.method?.toLowerCase();
  if (metodo && MUTATING_METHODS.has(metodo)) {
    const csrfToken = leerCookie("csrf_token");
    if (csrfToken) {
      config.headers["X-CSRF-Token"] = csrfToken;
    }
  }
  return config;
});

// Rutas que no requieren sesión. Si ya estamos en una de estas, un 401 es
// esperado (ej. useAuthProvider preguntando "¿hay sesión?" al arrancar la
// app en /login) y NO hay que redirigir -- si no, window.location.href a la
// misma URL en la que ya estás fuerza una recarga completa de la página,
// que vuelve a montar todo, vuelve a pegarle a /usuarios/me, vuelve a dar
// 401, vuelve a recargar... loop infinito (visto en los logs del backend).
const RUTAS_PUBLICAS = ["/login", "/registro", "/no-autorizado"];

export function esRutaPublica(pathname) {
  return RUTAS_PUBLICAS.includes(pathname);
}

// Si el backend responde 401 en una ruta protegida (token vencido o
// inválido), mandamos al login. Ya no hay nada que limpiar en localStorage:
// la cookie la borra el propio backend en /auth/logout, o expira sola.
axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !esRutaPublica(window.location.pathname)) {
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
