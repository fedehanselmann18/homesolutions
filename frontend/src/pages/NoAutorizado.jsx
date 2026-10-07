import { useNavigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { usePageTitle } from "../hooks/usePageTitle";
import logoHS from "../assets/HS_logo_blanco.png";
import "./Auth.css";

export function NoAutorizado() {
  usePageTitle("Acceso restringido");
  const navigate = useNavigate();

  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-panel__marca">
          <img src={logoHS} alt="HomeSolutions" className="auth-panel__logo" />
          <span className="badge badge--peligro auth-panel__restringido">
            <Lock size={13} aria-hidden="true" />
            Acceso restringido
          </span>
          <span className="auth-panel__pie">Uso interno</span>
        </div>

        <div className="auth-panel__form auth-panel__aviso">
          <h1>No estás autorizado para ver esta página</h1>
          <p>Iniciá sesión con tu cuenta para continuar.</p>
          <button type="button" className="btn btn-primary btn--lg" onClick={() => navigate("/login")}>
            Ir al login
          </button>
        </div>
      </div>
    </div>
  );
}
