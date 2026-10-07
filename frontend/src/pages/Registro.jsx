import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { crearUsuario, getOpcionesRegistro } from "../services/usuarioService";
import { validarPassword } from "../utils/formValidation";
import { obtenerMensajeError } from "../utils/errorHandling";
import { usePageTitle } from "../hooks/usePageTitle";
import logoHS from "../assets/HS_logo_blanco.png";
import "./Auth.css"; // reusa el mismo panel partido que el login
import { LogoCargando } from "../components/shared/LogoCargando";
import { ErrorCampo } from "../components/shared/ErrorCampo";

export function Registro() {
  usePageTitle("Registro");
  const navigate = useNavigate();

  // Sin sesión todavía, así que se usa el endpoint público que solo
  // devuelve los nombres autorizados que aún no tienen cuenta (ver
  // /usuarios/opciones-registro). La lista la gestiona la cuenta "Manager"
  // desde la app -- antes estaba hardcodeada acá y había que tocar código
  // para sumar a alguien al equipo.
  //
  // "Manager" nunca puede aparecer en este combo: no está en la whitelist
  // (el backend rechaza autorizarla) y el endpoint la filtra igual. Esa
  // cuenta se crea solo con backend/scripts/crear_usuario_manager.py.
  const [nombresUsuario, setNombresUsuario] = useState([]);
  const [cargandoNombres, setCargandoNombres] = useState(true);

  useEffect(() => {
    getOpcionesRegistro()
      .then(setNombresUsuario)
      .catch(() => setNombresUsuario([]))
      .finally(() => setCargandoNombres(false));
  }, []);

  const [nombreUsuario, setNombreUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  // Se muestra mientras se escribe (no recién al enviar), igual que el de
  // "no coinciden": el mínimo es el mismo que valida el backend.
  const errorPassword = password !== "" ? validarPassword(password) : null;
  const passwordsNoCoinciden = confirmarPassword !== "" && password !== confirmarPassword;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!nombreUsuario || !password || !confirmarPassword) {
      setError("Elegí tu nombre y escribí una contraseña.");
      return;
    }

    // Los errores de largo y de coincidencia ya se muestran debajo de cada
    // campo mientras se escribe, así que acá solo hay que frenar el envío.
    if (errorPassword || passwordsNoCoinciden) return;

    try {
      setEnviando(true);
      // Sin "rol": lo decide el servidor con la whitelist (ver
      // UsuarioCreate.rol y create_user en el backend). El front no lo sabe
      // y no tiene que saberlo.
      await crearUsuario({
        nombre_usuario: nombreUsuario,
        password,
      });
      navigate("/login");
    } catch (err) {
      console.error("Error al crear el usuario:", err);
      // 403: el nombre no está en la whitelist (equipo cerrado).
      // El resto usa el detail real del backend (400 "Ese usuario ya tiene
      // cuenta creada", 422 con el campo que falló, etc.): antes todo caía
      // en un "puede que ya exista" que mentía, por ejemplo cuando el 422
      // era en realidad una contraseña demasiado corta.
      if (err?.response?.status === 403) {
        setError("Ese nombre de usuario no está autorizado a crear cuenta.");
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
            <select className="campo"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                disabled={cargandoNombres}
              >
                <option value="" disabled>
                  {cargandoNombres ? "Cargando..." : "Seleccioná tu nombre"}
                </option>
                {nombresUsuario.map((nombre) => (
                  <option key={nombre} value={nombre}>
                    {nombre}
                  </option>
                ))}
              </select>
          </label>

          {!cargandoNombres && nombresUsuario.length === 0 && (
            <p className="campo-hint">
              No hay nombres pendientes de registro. Pedile al administrador que te autorice.
            </p>
          )}

          <label className="auth-campo">
            <span>Contraseña</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={errorPassword ? "campo--error" : undefined}
              aria-invalid={errorPassword ? true : undefined}
            />
            <ErrorCampo texto={errorPassword} />
          </label>

          <label className="auth-campo">
            <span>Confirmar contraseña</span>
            <input
              type="password"
              value={confirmarPassword}
              onChange={(e) => setConfirmarPassword(e.target.value)}
              placeholder="••••••••"
              className={passwordsNoCoinciden ? "campo--error" : undefined}
              aria-invalid={passwordsNoCoinciden ? true : undefined}
            />
            <ErrorCampo texto={passwordsNoCoinciden ? "Las contraseñas no coinciden." : null} />
          </label>

          <ErrorCampo texto={error} />

          <button type="submit" className="btn btn-primary btn--lg auth-panel__submit" disabled={enviando}>
            {enviando ? (
              <>
                <LogoCargando size={14} variante="blanco" />
                Creando cuenta...
              </>
            ) : (
              "Crear cuenta"
            )}
          </button>

          <Link to="/login" className="auth-panel__link">
            ¿Ya tenés cuenta? Iniciá sesión
          </Link>
        </form>
      </div>
    </div>
  );
}
