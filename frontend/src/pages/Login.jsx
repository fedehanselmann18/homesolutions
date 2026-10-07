import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { getOpcionesLogin } from "../services/usuarioService";
import { obtenerMensajeError } from "../utils/errorHandling";
import { usePageTitle } from "../hooks/usePageTitle";
import { ChevronDown, Eye, EyeOff, Lock, User } from "lucide-react";
import "./Auth.css";
import { LogoCargando } from "../components/shared/LogoCargando";
import { ErrorCampo } from "../components/shared/ErrorCampo";
import { AuthLayout } from "../components/shared/AuthLayout";

export function Login() {
  usePageTitle("Iniciar sesión");
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
  const [mostrarPassword, setMostrarPassword] = useState(false);
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
    <AuthLayout>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1 className="auth-form__titulo">Iniciar sesión</h1>

        <div className="auth-form__campos">
          <div className="auth-form__campo">
            <div className="auth-form__label-fila">
              <label htmlFor="login-usuario" className="label-campo">
                Usuario
              </label>
              <button
                type="button"
                className="auth-form__toggle"
                onClick={() => {
                  setNombreManual((valor) => !valor);
                  setNombreUsuario("");
                }}
              >
                {nombreManual ? "Elegir de la lista" : "Ingresar manualmente"}
              </button>
            </div>
            <div className="campo">
              <User aria-hidden="true" />
              {nombreManual ? (
                <input
                  id="login-usuario"
                  type="text"
                  value={nombreUsuario}
                  onChange={(e) => setNombreUsuario(e.target.value)}
                  placeholder="Nombre de usuario"
                  autoComplete="username"
                  autoFocus
                />
              ) : (
                <>
                  <select
                    id="login-usuario"
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
                  <ChevronDown className="auth-form__chevron" aria-hidden="true" />
                </>
              )}
            </div>
          </div>

          <div className="auth-form__campo">
            <label htmlFor="login-password" className="label-campo">
              Contraseña
            </label>
            <div className="campo">
              <Lock aria-hidden="true" />
              <input
                id="login-password"
                type={mostrarPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
              <button
                type="button"
                className="auth-form__ojo"
                onClick={() => setMostrarPassword((valor) => !valor)}
                aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                aria-pressed={mostrarPassword}
              >
                {mostrarPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
              </button>
            </div>
          </div>
        </div>

        <ErrorCampo texto={error} />

        <button
          type="submit"
          className="btn btn-primary btn--lg auth-form__submit"
          disabled={enviando}
        >
          {enviando ? (
            <>
              <LogoCargando size={14} variante="blanco" />
              Ingresando...
            </>
          ) : (
            "Ingresar"
          )}
        </button>

        <p className="auth-form__pie">
          ¿Todavía no tenés cuenta?
          <Link to="/registro">Registrate</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
