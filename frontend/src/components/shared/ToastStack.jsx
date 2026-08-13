import { useContext } from "react";
import { CircleAlert, CircleCheckBig, X } from "lucide-react";
import { ToastContext } from "../../context/ToastContext";
import "./ToastStack.css";

const ICONOS = {
  error: CircleAlert,
  success: CircleCheckBig,
};

export function ToastStack() {
  const ctx = useContext(ToastContext);
  if (!ctx || ctx.toasts.length === 0) return null;

  return (
    <div className="toast-stack">
      {ctx.toasts.map((t) => {
        const Icono = ICONOS[t.tipo] ?? CircleAlert;
        return (
          <div key={t.id} className={`toast toast--${t.tipo}`}>
            <Icono size={16} strokeWidth={2.25} className="toast-icono" />
            <span className="toast-mensaje">{t.mensaje}</span>
            <button
              type="button"
              className="toast-cerrar"
              onClick={() => ctx.quitar(t.id)}
              aria-label="Cerrar aviso"
            >
              <X size={13} strokeWidth={2.25} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export default ToastStack;
