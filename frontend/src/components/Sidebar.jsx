import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Building2, Truck, GitCompare } from "lucide-react";
import { useAuth } from "../context/useAuth";
import logo from "../assets/HS_logo_blanco.png";
import "./Sidebar.css";

const ITEMS_NAV = [
  { to: "/", label: "Panel", icono: LayoutDashboard, soloAdmin: false },
  { to: "/proyectos", label: "Proyectos", icono: Building2, soloAdmin: false },
  { to: "/proveedores", label: "Proveedores", icono: Truck, soloAdmin: false },
  { to: "/comparador", label: "Comparador", icono: GitCompare, soloAdmin: false },
];

export function Sidebar() {
  const { usuario, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
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
            <item.icono size={17} strokeWidth={2} className="sidebar-link-icono" />
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