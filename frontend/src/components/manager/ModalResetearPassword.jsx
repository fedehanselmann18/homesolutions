import { useState } from "react";

import ModalShell from "../modals/ModalShell";
import { validarPassword } from "../../utils/formValidation";
import "./Manager.css";

/**
 * Contraseña nueva para una persona puntual del equipo. La escribe a mano
 * quien administra el sistema: no se genera sola ni se manda por mail (ver
 * POST /usuarios/{id}/resetear-password).
 *
 * Las dos validaciones (largo mínimo y coincidencia) son las mismas de
 * /registro y se muestran debajo del campo mientras se escribe.
 */
export function ModalResetearPassword({ usuario, guardando, onConfirmar, onCerrar }) {
  const [password, setPassword] = useState("");
  const [confirmarPassword, setConfirmarPassword] = useState("");
  const [error, setError] = useState(null);

  const errorPassword = password !== "" ? validarPassword(password) : null;
  const passwordsNoCoinciden = confirmarPassword !== "" && password !== confirmarPassword;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!password || !confirmarPassword) {
      setError("Escribí la contraseña nueva dos veces.");
      return;
    }
    if (errorPassword || passwordsNoCoinciden) return;

    onConfirmar(password);
  };

  return (
    <ModalShell
      titulo="Resetear contraseña"
      contexto={usuario.nombre_usuario}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      acciones={
        <>
          <button type="button" className="btn btn-secondary" onClick={onCerrar}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={guardando}>
            {guardando ? "Guardando..." : "Cambiar contraseña"}
          </button>
        </>
      }
    >
      <div className="manager-form">
        <p className="manager-form__aviso">
          Al cambiarla, la sesión que <strong>{usuario.nombre_usuario}</strong> tenga abierta se
          cierra: tiene que entrar de nuevo con la contraseña nueva.
        </p>

        <label className={`manager-campo${errorPassword ? " manager-campo--error" : ""}`}>
          <span>Contraseña nueva</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
          {errorPassword && <span className="campo-error">{errorPassword}</span>}
        </label>

        <label className={`manager-campo${passwordsNoCoinciden ? " manager-campo--error" : ""}`}>
          <span>Confirmar contraseña</span>
          <input
            type="password"
            value={confirmarPassword}
            onChange={(e) => setConfirmarPassword(e.target.value)}
            placeholder="Repetila"
          />
          {passwordsNoCoinciden && (
            <span className="campo-error">Las contraseñas no coinciden.</span>
          )}
        </label>

        {error && <p className="manager-error">{error}</p>}
      </div>
    </ModalShell>
  );
}

export default ModalResetearPassword;
