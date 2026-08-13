import { Component } from "react";
import "./ErrorBoundary.css";

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
        <div className="error-boundary">
          <div className="error-boundary-card">
            <div className="error-boundary-header">
              <span className="error-boundary-eyebrow">Ups, algo salió mal</span>
            </div>
            <div className="error-boundary-body">
              <h1>Ocurrió un error inesperado</h1>
              <p>La página encontró un problema y no se pudo mostrar. Probá volver al inicio.</p>
              <button
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
