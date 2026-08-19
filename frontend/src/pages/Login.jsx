import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { useAuth } from "../context/useAuth";
import { getOpcionesLogin } from "../services/usuarioService";
import { obtenerMensajeError } from "../utils/errorHandling";
import logoHS from "../assets/HS_logo_blanco.png";
import "./Auth.css";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  // Sin sesión todavía, así que se usa el endpoint público que solo
  // devuelve nombres de usuario (no id ni rol -- ver /usuarios/login-options).
  const [nombresUsuario, setNombresUsuario] = useState([]);
  const [cargandoUsuarios, setCargandoUsuarios] = useState(true);

  useEffect(() => {
    getOpcionesLogin()
      .then(setNombresUsuario)
      .catch(() => setNombresUsuario([]))
      .finally(() => setCargandoUsuarios(false));
  }, []);

  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
  // La cuenta "Manager" (mantenimiento, ver constants/manager.js) queda
  // fuera del combo a propósito -- /usuarios/login-options no la devuelve --
  // así que necesita poder escribir el nombre a mano.
  const [nombreManual, setNombreManual] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nombreUsuario || !password) {
      setError("Elegí tu usuario y escribí la contraseña.");
      return;
    }

    try {
      setEnviando(true);
      await login(nombreUsuario, password);
      navigate("/");
    } catch (err) {
      // El backend devuelve 401 tanto si el usuario no existe como si la
      // contraseña es incorrecta (invalid_login_exception), así que el
      // mensaje es genérico a propósito: no hay que mostrar el detail crudo
      // del backend acá (aunque ya venga en español), porque distinguir
      // "usuario no existe" de "contraseña incorrecta" habilitaría
      // enumeración de usuarios. Cualquier otro error (sin conexión, 429,
      // 500) sí usa el mensaje real -- ahí no hay nada que proteger.
      if (err?.response?.status === 401) {
        setError("Usuario o contraseña incorrectos.");
      } else {
        setError(obtenerMensajeError(err));
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-panel__marca">
          <img src={logoHS} alt="HomeSolutions" className="auth-panel__logo" />
          <div className="auth-panel__mensaje">
            <span className="auth-panel__barra" />
            <p>Obras, fases, compras y cobros de HomeSolutions en un solo lugar.</p>
          </div>
          <span className="auth-panel__pie">Uso interno</span>
        </div>

        <form className="auth-panel__form" onSubmit={handleSubmit}>
          <div className="auth-panel__titulo">
            <h1>Iniciar sesión</h1>
            <p>Elegí tu usuario para continuar</p>
          </div>

          <label className="auth-campo">
            <span>Usuario</span>
            {nombreManual ? (
              <input
                type="text"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                placeholder="Nombre de usuario"
              />
            ) : (
              <span className="auth-campo__select">
                <select
                  value={nombreUsuario}
                  onChange={(e) => setNombreUsuario(e.target.value)}
                  disabled={cargandoUsuarios}
                >
                  <option value="" disabled>
                    {cargandoUsuarios ? "Cargando..." : "Seleccioná tu usuario"}
                  </option>
                  {nombresUsuario.map((nombre) => (
                    <option key={nombre} value={nombre}>
                      {nombre}
                    </option>
                  ))}
                </select>
                <ChevronDown size={16} />
              </span>
            )}
          </label>

          <button
            type="button"
            className="auth-panel__toggle"
            onClick={() => {
              setNombreManual((valor) => !valor);
              setNombreUsuario("");
            }}
          >
            {nombreManual
              ? "Elegir un usuario de la lista"
              : "¿Sos otro usuario? Ingresalo manualmente"}
          </button>

          <label className="auth-campo">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="auth-panel__error">{error}</p>}

          <button type="submit" className="auth-panel__submit" disabled={enviando}>
            {enviando ? "Ingresando..." : "Ingresar"}
          </button>

          <Link to="/registro" className="auth-panel__link">
            ¿Todavía no tenés cuenta? Registrate
          </Link>
        </form>
      </div>
    </div>
  );
}
