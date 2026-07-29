import { useNavigate } from "react-router-dom";
import "./NoAutorizado.css";

export function NoAutorizado() {
  const navigate = useNavigate();

  return (
    <div className="no-autorizado">
      <div className="no-autorizado-card">
        <span className="no-autorizado-eyebrow">Acceso restringido</span>
        <h1>No estás autorizado para ver esta página</h1>
        <p>Iniciá sesión con tu cuenta para continuar.</p>
        <button onClick={() => navigate("/login")}>Ir al login</button>
      </div>
    </div>
  );
}