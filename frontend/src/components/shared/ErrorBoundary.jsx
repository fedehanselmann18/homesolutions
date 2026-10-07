import { Component } from "react";
import { CircleAlert, House } from "lucide-react";

// Mismo panel que "No autorizado": una pantalla que reemplaza a toda la app
// tiene la cara de las pantallas de entrada, no una propia.
import { AuthLayout } from "./AuthLayout";
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
        <AuthLayout>
          <div className="auth-aviso">
            <span className="badge badge--peligro">
              <CircleAlert size={13} aria-hidden="true" />
              Algo salió mal
            </span>
            <h1>Ocurrió un error inesperado</h1>
            <p>La página encontró un problema y no se pudo mostrar. Probá volver al inicio.</p>
            <button
              type="button"
              className="btn btn-primary btn--lg"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              <House aria-hidden="true" />
              Volver al inicio
            </button>
          </div>
        </AuthLayout>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
