import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import { crearUsuario } from "../services/usuarioService";
import logoHS from "../assets/HS_logo_blanco.png";
import "./Auth.css"; // reusa el mismo panel partido que el login

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

  const rolSeleccionado = NOMBRES.find((n) => n.nombre_usuario === nombreUsuario)?.rol;
  const passwordsNoCoinciden = confirmarPassword !== "" && password !== confirmarPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nombreUsuario || !password || !confirmarPassword) {
      setError("Elegí tu nombre y escribí una contraseña.");
      return;
    }

    // El error de coincidencia ya se muestra debajo del campo mientras se
    // escribe, así que acá solo hay que frenar el envío.
    if (passwordsNoCoinciden) return;

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
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-panel__marca">
          <img src={logoHS} alt="HomeSolutions" className="auth-panel__logo" />
          <div className="auth-panel__mensaje">
            <span className="auth-panel__barra" />
            <p>Creá tu cuenta con el nombre que ya está dado de alta en la obra.</p>
          </div>
          <span className="auth-panel__pie">Uso interno</span>
        </div>

        <form className="auth-panel__form" onSubmit={handleSubmit}>
          <div className="auth-panel__titulo">
            <h1>Crear cuenta</h1>
          </div>

          <label className="auth-campo">
            <span>Nombre</span>
            <span className="auth-campo__select">
              <select value={nombreUsuario} onChange={(e) => setNombreUsuario(e.target.value)}>
                <option value="" disabled>
                  Seleccioná tu nombre
                </option>
                {NOMBRES.map((n) => (
                  <option key={n.nombre_usuario} value={n.nombre_usuario}>
                    {n.nombre_usuario}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </span>
          </label>

          <label className="auth-campo">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </label>

          <label className={`auth-campo${passwordsNoCoinciden ? " auth-campo--error" : ""}`}>
            <span>Confirmar contraseña</span>
            <input
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="••••••••"
            />
            {passwordsNoCoinciden && (
              <span className="campo-error">Las contraseñas no coinciden.</span>
            )}
          </label>

          {error && <p className="auth-panel__error">{error}</p>}

          <button type="submit" className="auth-panel__submit" disabled={enviando}>
            {enviando ? "Creando cuenta..." : "Crear cuenta"}
          </button>

          <Link to="/login" className="auth-panel__link">
            ¿Ya tenés cuenta? Iniciá sesión
          </Link>
        </form>
      </div>
    </div>
  );
}
