import logoHS from "../../assets/HS_logo_negro.png";
import "./AuthLayout.css";

/**
 * La cara de las pantallas de entrada (login, registro, no autorizado y el
 * error que reemplaza a toda la app) — diseño 1a/1b de `HS Acceso`: pantalla
 * completa partida, panel de marca claro a la izquierda y el contenido
 * centrado a la derecha. El panel es igual en las cuatro, por eso vive acá y
 * cada pantalla sólo pone lo suyo como children.
 */
export function AuthLayout({ children }) {
  return (
    <div className="auth-layout">
      <aside className="auth-layout__marca">
        <img src={logoHS} alt="HomeSolutions" className="auth-layout__logo" />
        <div className="auth-layout__mensaje">
          <span className="auth-layout__barra" />
          <p className="auth-layout__titulo">Sistema de control de gastos para obras</p>
          <span className="auth-layout__firma">HomeSolutions</span>
        </div>
        <span className="auth-layout__pie">Uso interno</span>
      </aside>

      <main className="auth-layout__contenido">{children}</main>
    </div>
  );
}

export default AuthLayout;
