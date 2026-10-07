import { useNavigate } from "react-router-dom";
import { LogIn, Lock } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";
import { AuthLayout } from "../components/shared/AuthLayout";
import "./Auth.css";

export function NoAutorizado() {
  usePageTitle("Acceso restringido");
  const navigate = useNavigate();

  return (
    <AuthLayout>
      <div className="auth-aviso">
        <span className="badge badge--peligro">
          <Lock size={13} aria-hidden="true" />
          Acceso restringido
        </span>
        <h1>No estás autorizado para ver esta página</h1>
        <p>Iniciá sesión con tu cuenta para continuar.</p>
        <button
          type="button"
          className="btn btn-primary btn--lg"
          onClick={() => navigate("/login")}
        >
          <LogIn aria-hidden="true" />
          Ir al login
        </button>
      </div>
    </AuthLayout>
  );
}
