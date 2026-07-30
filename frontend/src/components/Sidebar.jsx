import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import logo from "../assets/HS_logo_blanco.png";
import "./Sidebar.css";

const ITEMS_NAV = [
  { to: "/", label: "Panel", soloAdmin: false },
  { to: "/proyectos", label: "Proyectos", soloAdmin: false },
  { to: "/proveedores", label: "Proveedores", soloAdmin: false },
  { to: "/comparador", label: "Comparador", soloAdmin: false },
];

export function Sidebar() {
  const { usuario, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <img src={logo} alt="HomeSolutions" className="sidebar-brand" />
      </div>

      <nav className="sidebar-nav">
        {ITEMS_NAV.filter((item) => !item.soloAdmin || isAdmin).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <span className="sidebar-user-name">{usuario?.nombre_usuario}</span>
        </div>
        <button className="sidebar-logout" onClick={handleLogout}>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}