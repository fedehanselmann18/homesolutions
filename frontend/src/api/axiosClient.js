import axios from "axios";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  // El JWT ahora viaja en una cookie httpOnly, no en localStorage: el
  // browser tiene que adjuntarla sola en cada request cross-origin
  // (front en Vercel, back en Railway), y para eso axios necesita
  // withCredentials en true.
  withCredentials: true,
});

const MUTATING_METHODS = new Set(["post", "put", "patch", "delete"]);

// La cookie csrf_token NO es httpOnly a propósito (ver login.py) -- pero en
// producción front (Vercel) y back (Railway) son dominios DISTINTOS, y
// document.cookie solo puede leer cookies del propio dominio del front. La
// cookie del backend es invisible para este JS aunque no sea httpOnly.
// Por eso el valor viaja en el body de GET /usuarios/me (ver
// UsuarioOut.csrf_token) y se guarda acá en memoria, no se lee de
// document.cookie. Se pierde al recargar la página a propósito -- por eso
// useAuthProvider vuelve a pedirlo pegándole a /usuarios/me en cada mount.
let csrfTokenEnMemoria = null;

export function setCsrfToken(token) {
  csrfTokenEnMemoria = token || null;
}

axiosClient.interceptors.request.use((config) => {
  const metodo = config.method?.toLowerCase();
  if (metodo && MUTATING_METHODS.has(metodo) && csrfTokenEnMemoria) {
    config.headers["X-CSRF-Token"] = csrfTokenEnMemoria;
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

// El access_token dura poco (60 min, ver ACCESS_TOKEN_EXPIRE_MINUTES) pero
// el login también deja una cookie refresh_token de larga duración (7 días,
// path="/auth", ver login.py) pensada justo para este momento: antes de
// tirar a la persona al login por un 401, probamos renovar la sesión sola.
//
// Dedupe: si varios pedidos 401ean a la vez (ej. el Sidebar dispara 6
// queries en paralelo al montar), todos esperan la MISMA promesa en vez de
// disparar 6 POST /auth/refresh -- refrescoEnCurso vive fuera del
// interceptor para que sea compartida entre todos los pedidos en vuelo.
let refrescoEnCurso = null;

function refrescarSesion() {
  if (!refrescoEnCurso) {
    refrescoEnCurso = axiosClient
      .post("/auth/refresh")
      // El refresh pisa la cookie csrf_token en el backend (ver
      // _setear_cookies_sesion en login.py), así que el valor que
      // teníamos en memoria queda vencido -- se vuelve a pedir del mismo
      // lugar que en el login (GET /usuarios/me, ver useAuthProvider).
      .then(() => axiosClient.get("/usuarios/me"))
      .then(({ data }) => setCsrfToken(data.csrf_token))
      .finally(() => {
        refrescoEnCurso = null;
      });
  }
  return refrescoEnCurso;
}

// Si el backend responde 401 en una ruta protegida (token vencido o
// inválido), primero intentamos refrescar la sesión sola; si eso también
// falla (refresh token vencido, revocado -- B-06, o directamente no hay
// sesión) recién ahí vamos al login. Ya no hay nada que limpiar en
// localStorage: las cookies las borra el propio backend en /auth/logout, o
// expiran solas.
axiosClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config;

    if (status !== 401 || esRutaPublica(window.location.pathname)) {
      return Promise.reject(error);
    }

    // Un 401 de una llamada al propio /auth/* (login con credenciales
    // malas, o el refresh de acá abajo cuando el refresh token también
    // venció) no se reintenta -- ES el fracaso, no un token de acceso
    // vencido. Lo mismo si esta request ya pasó por acá una vez: evita
    // loop infinito si el token nuevo también viniera inválido.
    if (original?.url?.includes("/auth/") || original?._reintentadoTrasRefresh) {
      window.location.href = "/login";
      return Promise.reject(error);
    }

    try {
      await refrescarSesion();
    } catch {
      window.location.href = "/login";
      return Promise.reject(error);
    }

    original._reintentadoTrasRefresh = true;
    return axiosClient(original);
  }
);

export default axiosClient;
