import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { crearUsuario } from "../services/usuarioService";
import logoHS from "../assets/HS_logo_negro.png";
import "./Login.css"; // reusa los mismos estilos de tarjeta/inputs del login

// Mapeo fijo: quién es admin y quién es lectura. Si en algún momento cambia
// el rol de alguien, se edita acá.
const NOMBRES = [
  { nombre_usuario: "Agustin", rol: "admin" },
  { nombre_usuario: "Aldana", rol: "admin" },
  { nombre_usuario: "Alejandro", rol: "lectura" },
];

export function Registro() {
  const navigate = useNavigate();

  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const rolSeleccionado = NOMBRES.find(
    (n) => n.nombre_usuario === nombreUsuario
  )?.rol;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nombreUsuario || !password) {
      setError("Elegí tu nombre y escribí una contraseña.");
      return;
    }

    if (password !== confirmarPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setEnviando(true);
      await crearUsuario({
        nombre_usuario: nombreUsuario,
        rol: rolSeleccionado,
        password,
      });
      navigate("/login");
    } catch (err) {
      console.error("Error al crear el usuario:", err);
      // El backend devuelve 400 si ese usuario ya tiene cuenta creada
      setError("No se pudo crear la cuenta. Puede que ya exista.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={logoHS} alt="HomeSolutions" className="login-logo" />
        <h1>Crear cuenta</h1>

        <label className="login-field">
          <span>Nombre</span>
          <select
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
          >
            <option value="" disabled>
              Seleccioná tu nombre
            </option>
            {NOMBRES.map((n) => (
              <option key={n.nombre_usuario} value={n.nombre_usuario}>
                {n.nombre_usuario}
              </option>
            ))}
          </select>
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

        <label className="login-field">
          <span>Confirmar contraseña</span>
          <input
            type="password"
            value={confirmarPassword}
            onChange={(e) => setConfirmarPassword(e.target.value)}
            placeholder="••••••••"
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Creando cuenta..." : "Crear cuenta"}
        </button>

        <Link to="/login" className="login-link">
          ¿Ya tenés cuenta? Iniciá sesión
        </Link>
      </form>
    </div>
  );
}