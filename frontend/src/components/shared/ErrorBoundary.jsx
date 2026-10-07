import { Component } from "react";
import { CircleAlert } from "lucide-react";

import logoHS from "../../assets/HS_logo_blanco.png";
// Mismo panel que "No autorizado": una pantalla que reemplaza a toda la app
// tiene la cara de las pantallas de entrada, no una propia.
import "../../pages/Auth.css";

export class ErrorBoundary extends Component {
  state = { huboError: false };

  static getDerivedStateFromError() {
    return { huboError: true };
  }

  componentDidCatch(error, info) {
    console.error("Error de render capturado por ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.huboError) {
      return (
        <div className="auth-page">
          <div className="auth-panel">
            <div className="auth-panel__marca">
              <img src={logoHS} alt="HomeSolutions" className="auth-panel__logo" />
              <span className="badge badge--peligro auth-panel__restringido">
                <CircleAlert size={13} aria-hidden="true" />
                Algo salió mal
              </span>
              <span className="auth-panel__pie">Uso interno</span>
            </div>

            <div className="auth-panel__form auth-panel__aviso">
              <h1>Ocurrió un error inesperado</h1>
              <p>La página encontró un problema y no se pudo mostrar. Probá volver al inicio.</p>
              <button
                type="button"
                className="btn btn-primary btn--lg"
                onClick={() => {
                  window.location.href = "/";
                }}
              >
                Volver al inicio
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
