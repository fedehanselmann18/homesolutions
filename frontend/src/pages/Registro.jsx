import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { crearUsuario, getOpcionesRegistro } from "../services/usuarioService";
import { validarPassword } from "../utils/formValidation";
import { obtenerMensajeError } from "../utils/errorHandling";
import { usePageTitle } from "../hooks/usePageTitle";
import { Check, ChevronDown, CircleAlert, Lock, User } from "lucide-react";
import "./Auth.css"; // reusa el mismo formulario que el login
import { LogoCargando } from "../components/shared/LogoCargando";
import { ErrorCampo } from "../components/shared/ErrorCampo";
import { AuthLayout } from "../components/shared/AuthLayout";

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
  // El tilde dentro del campo de confirmación (diseño 1b): sólo cuando ya no
  // hay nada que corregir en ninguno de los dos.
  const passwordsCoinciden = confirmarPassword !== "" && !passwordsNoCoinciden && !errorPassword;
  // Nadie pendiente de registrarse: el combo y el botón quedan deshabilitados
  // y el aviso explica por qué, en vez de dejar un formulario que no lleva a
  // ningún lado.
  const sinNombres = !cargandoNombres && nombresUsuario.length === 0;

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
    <AuthLayout>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h1 className="auth-form__titulo">Crear cuenta</h1>

        <div className="auth-form__campos">
          <div className="auth-form__campo">
            <label htmlFor="registro-nombre" className="label-campo">
              Nombre
            </label>
            <div className="campo">
              <User aria-hidden="true" />
              <select
                id="registro-nombre"
                value={nombreUsuario}
                onChange={(e) => setNombreUsuario(e.target.value)}
                disabled={cargandoNombres || sinNombres}
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
              <ChevronDown className="auth-form__chevron" aria-hidden="true" />
            </div>
            {sinNombres && (
              <p className="campo-hint campo-hint--atencion">
                <CircleAlert aria-hidden="true" />
                No hay nombres pendientes de registro. Pedile al administrador que te autorice.
              </p>
            )}
          </div>

          <div className="auth-form__campo">
            <label htmlFor="registro-password" className="label-campo">
              Contraseña
            </label>
            <div className={errorPassword ? "campo campo--error" : "campo"}>
              <Lock aria-hidden="true" />
              <input
                id="registro-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={errorPassword ? true : undefined}
              />
            </div>
            <ErrorCampo texto={errorPassword} />
          </div>

          <div className="auth-form__campo">
            <label htmlFor="registro-confirmar" className="label-campo">
              Confirmar contraseña
            </label>
            <div className={passwordsNoCoinciden ? "campo campo--error" : "campo"}>
              <Lock aria-hidden="true" />
              <input
                id="registro-confirmar"
                type="password"
                value={confirmarPassword}
                onChange={(e) => setConfirmarPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="new-password"
                aria-invalid={passwordsNoCoinciden ? true : undefined}
              />
              {passwordsCoinciden && <Check className="auth-form__ok" aria-hidden="true" />}
            </div>
            <ErrorCampo texto={passwordsNoCoinciden ? "Las contraseñas no coinciden." : null} />
          </div>
        </div>

        <ErrorCampo texto={error} />

        <button
          type="submit"
          className="btn btn-primary btn--lg auth-form__submit"
          disabled={enviando || sinNombres}
        >
          {enviando ? (
            <>
              <LogoCargando size={14} variante="blanco" />
              Creando cuenta...
            </>
          ) : (
            "Crear cuenta"
          )}
        </button>

        <p className="auth-form__pie">
          ¿Ya tenés cuenta?
          <Link to="/login">Iniciá sesión</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
