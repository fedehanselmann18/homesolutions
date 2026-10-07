import { useState } from "react";

import { KeyRound } from "lucide-react";

import ModalShell, { AccionesFormulario } from "../modals/ModalShell";
import { validarPassword } from "../../utils/formValidation";
import { ErrorCampo } from "../shared/ErrorCampo";
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
      icono={KeyRound}
      contexto={usuario.nombre_usuario}
      onCerrar={onCerrar}
      onSubmit={handleSubmit}
      // El error del backend (o "escribila dos veces") va en el pie, como el
      // aviso de los modales de alta.
      aviso={error}
      acciones={
        <AccionesFormulario
          guardando={guardando}
          onCancelar={onCerrar}
          textoGuardar="Cambiar contraseña"
        />
      }
    >
      <div className="manager-form">
        <p className="manager-form__aviso">
          Al cambiarla, la sesión que <strong>{usuario.nombre_usuario}</strong> tenga abierta se
          cierra: tiene que entrar de nuevo con la contraseña nueva.
        </p>

        <label>
          Contraseña nueva
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Mínimo 8 caracteres"
            className={errorPassword ? "campo--error" : undefined}
            aria-invalid={errorPassword ? true : undefined}
          />
          <ErrorCampo texto={errorPassword} />
        </label>

        <label>
          Confirmar contraseña
          <input
            type="password"
            value={confirmarPassword}
            onChange={(e) => setConfirmarPassword(e.target.value)}
            placeholder="Repetila"
            className={passwordsNoCoinciden ? "campo--error" : undefined}
            aria-invalid={passwordsNoCoinciden ? true : undefined}
          />
          <ErrorCampo texto={passwordsNoCoinciden ? "Las contraseñas no coinciden." : null} />
        </label>
      </div>
    </ModalShell>
  );
}

export default ModalResetearPassword;
