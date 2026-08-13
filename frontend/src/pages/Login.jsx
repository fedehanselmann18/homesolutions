import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import { obtenerMensajeError } from "../utils/errorHandling";
import logoHS from "../assets/HS_logo_blanco.png";
import "./Login.css";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card-header">
          <img src={logoHS} alt="HomeSolutions" className="login-logo" />
        </div>

        <div className="login-card-body">
          <h1>Iniciar sesión</h1>

          <label className="login-field">
            <span>Usuario</span>
            <input
              type="text"
              value={nombreUsuario}
              onChange={(e) => setNombreUsuario(e.target.value)}
              placeholder="Tu usuario"
              autoComplete="username"
            />
          </label>

          <label className="login-field">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          {error && <p className="login-error">{error}</p>}

          <button type="submit" disabled={enviando}>
            {enviando ? "Ingresando..." : "Ingresar"}
          </button>

          <Link to="/registro" className="login-link">
            ¿Todavía no tenés cuenta? Registrate
          </Link>
        </div>
      </form>
    </div>
  );
}