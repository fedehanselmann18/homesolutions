import { useState } from "react";
import { ChevronDown, Trash2, UserPlus } from "lucide-react";

import "./Manager.css";
import { EstadoVacio } from "../shared/EstadoVacio";

/**
 * Whitelist de autoregistro: quién puede crearse cuenta en /registro y con
 * qué rol (tabla usuarios_autorizados). Autorizar un nombre acá es lo que
 * lo hace aparecer en el combo de esa pantalla.
 *
 * Revocar solo tiene sentido mientras la persona no se haya registrado: una
 * vez que tiene cuenta, borrar la autorización no le sacaría el acceso (el
 * backend devuelve 400 y hay que desactivarle la cuenta).
 */
export function SeccionAutorizados({ autorizados, guardando, onAutorizar, onRevocar }) {
  const [nombreUsuario, setNombreUsuario] = useState("");
  const [rol, setRol] = useState("lectura");
  const [error, setError] = useState(null);

  const pendientes = autorizados.filter((a) => !a.ya_registrado);
  const registrados = autorizados.filter((a) => a.ya_registrado);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    const limpio = nombreUsuario.trim();
    if (!limpio) {
      setError("Escribí el nombre de usuario que va a usar esa persona.");
      return;
    }

    onAutorizar(limpio, rol, () => {
      setNombreUsuario("");
      setRol("lectura");
    });
  };

  return (
    <div className="manager-autorizados">
      <form className="manager-autorizar-form" onSubmit={handleSubmit}>
        <label className="manager-campo">
          <span>Nombre de usuario</span>
          <input
            type="text"
            value={nombreUsuario}
            onChange={(e) => setNombreUsuario(e.target.value)}
            placeholder="Ej: Sofia"
          />
        </label>

        <label className="manager-campo">
          <span>Rol</span>
          <span className="manager-campo__select">
            <select value={rol} onChange={(e) => setRol(e.target.value)}>
              <option value="lectura">Lectura</option>
              <option value="admin">Admin</option>
            </select>
            <ChevronDown size={16} />
          </span>
        </label>

        <button type="submit" className="manager-submit" disabled={guardando}>
          <UserPlus size={15} strokeWidth={2} />
          {guardando ? "Autorizando..." : "Autorizar"}
        </button>
      </form>

      {error && <p className="manager-error">{error}</p>}

      <div className="manager-autorizados__listas">
        <div>
          <h3 className="manager-subtitulo">Pendientes de registrarse</h3>
          {pendientes.length === 0 ? (
            <EstadoVacio mensaje="Nadie pendiente: todos los autorizados ya tienen cuenta." />
          ) : (
            <ul className="manager-lista">
              {pendientes.map((autorizado) => (
                <li key={autorizado.id} className="manager-lista__item">
                  <span className="manager-lista__nombre">{autorizado.nombre_usuario}</span>
                  <span
                    className={`badge ${
                      autorizado.rol === "admin" ? "badge--marca" : "badge--neutro"
                    }`}
                  >
                    {autorizado.rol === "admin" ? "Admin" : "Lectura"}
                  </span>
                  <button
                    type="button"
                    className="manager-accion manager-accion--peligro"
                    onClick={() => onRevocar(autorizado)}
                    title="Sacarlo de la lista de quienes pueden registrarse"
                  >
                    <Trash2 size={14} strokeWidth={2} />
                    Revocar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {registrados.length > 0 && (
          <div>
            <h3 className="manager-subtitulo">Ya registrados</h3>
            <ul className="manager-lista">
              {registrados.map((autorizado) => (
                <li key={autorizado.id} className="manager-lista__item manager-lista__item--tenue">
                  <span className="manager-lista__nombre">{autorizado.nombre_usuario}</span>
                  <span className="badge badge--neutro">Con cuenta</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

export default SeccionAutorizados;
