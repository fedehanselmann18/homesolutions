import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  Truck,
  Tags,
  GitCompare,
  Users,
  UserPlus,
  History,
  Settings,
  FolderSearch,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/useAuth";
import {
  useProyectos,
  useProveedores,
  useFases,
  useGastos,
  useCobros,
  useCompras,
} from "../hooks/queries";
import { calcularPanel } from "../utils/panel";
import {
  RUTA_MANAGER_EQUIPO,
  RUTA_MANAGER_AUTORIZADOS,
  RUTA_MANAGER_AUDITORIA,
  RUTA_MANAGER_CONFIGURACION,
  RUTA_MANAGER_ARCHIVOS,
  esManager,
} from "../constants/manager";
import logo from "../assets/HS_logo_blanco.png";
import "./Sidebar.css";

const ITEMS_NAV = [
  { to: "/", label: "Panel", icono: LayoutDashboard, contador: null },
  { to: "/proyectos", label: "Proyectos", icono: Building2, contador: (c) => c.proyectos },
  { to: "/proveedores", label: "Proveedores", icono: Truck, contador: (c) => c.proveedores },
  { to: "/catalogos", label: "Catálogos", icono: Tags, contador: null },
  { to: "/comparador", label: "Comparador", icono: GitCompare, contador: null },
];

// Subárbol exclusivo de la cuenta "Manager" (ver constants/manager.js): antes
// era un solo link ("Gestión de cuentas") a una pantalla con secciones
// apiladas; ahora cada sección es su propia página, así que son varios links
// bajo un mismo título de grupo -- mismo patrón visual que "En curso" más
// abajo para las obras.
const ITEMS_NAV_MANAGER = [
  { to: RUTA_MANAGER_EQUIPO, label: "Equipo", icono: Users },
  { to: RUTA_MANAGER_AUTORIZADOS, label: "Autorizados", icono: UserPlus },
  { to: RUTA_MANAGER_AUDITORIA, label: "Historial", icono: History },
  { to: RUTA_MANAGER_CONFIGURACION, label: "Configuración", icono: Settings },
  { to: RUTA_MANAGER_ARCHIVOS, label: "Archivos", icono: FolderSearch },
];

// "mlopez" -> "ML", "Agustin" -> "AG" (sin separador, se usan las primeras 2
// letras). nombre_usuario es lo único que tiene el usuario -- no hay nombre
// real por separado (ver backend/app/schemas.py Usuario).
function iniciales(nombreUsuario = "") {
  const partes = nombreUsuario.split(/[.\s_-]+/).filter(Boolean);
  if (partes.length >= 2) return (partes[0][0] + partes[1][0]).toUpperCase();
  return nombreUsuario.slice(0, 2).toUpperCase();
}

// El nav "normal" vive en su propio componente porque monta 6 queries: así
// no se disparan para la cuenta "Manager", que no ve ninguna de estas
// páginas (ver constants/manager.js) ni tiene permiso para pedir esos datos.
function NavEquipo() {
  const proyectosQuery = useProyectos();
  const proveedoresQuery = useProveedores();

  // Grupo "EN CURSO" (dirección 1a): necesita el mismo "disponible" por
  // proyecto que calcula el Panel, que a su vez necesita fases/gastos/
  // cobros/compras completos. El Sidebar se monta en TODAS las páginas
  // protegidas, así que estas 4 queries pueden disparar su primer fetch acá
  // si el usuario entra directo a una página que no las pide por su cuenta
  // (Proveedores, Comparador) -- se aceptan porque React Query las cachea
  // por queryKey (ver queryKeys.js) y quedan calientes para el Panel/
  // Proyectos, pero si en el futuro esto pesa, la alternativa es sacar el
  // punto verde/rojo y dejar sólo el nombre de la obra.
  const fasesQuery = useFases();
  const gastosQuery = useGastos();
  const cobrosQuery = useCobros();
  const comprasQuery = useCompras();

  const contadores = {
    proyectos: proyectosQuery.data?.length,
    proveedores: proveedoresQuery.data?.length,
  };

  const datosListos =
    proyectosQuery.data &&
    fasesQuery.data &&
    gastosQuery.data &&
    cobrosQuery.data &&
    comprasQuery.data;

  const obrasEnCurso = datosListos
    ? calcularPanel({
        proyectos: proyectosQuery.data,
        fases: fasesQuery.data,
        gastos: gastosQuery.data,
        cobros: cobrosQuery.data,
        compras: comprasQuery.data,
      }).proyectosActivos
    : [];

  return (
    <>
      {ITEMS_NAV.map((item) => {
        const cantidad = item.contador?.(contadores);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/"}
            className={({ isActive }) =>
              isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
            }
          >
            <item.icono size={16} strokeWidth={2} className="sidebar-link-icono" />
            {item.label}
            {cantidad != null && <span className="sidebar-link-contador">{cantidad}</span>}
          </NavLink>
        );
      })}

      {obrasEnCurso.length > 0 && (
        <>
          <div className="sidebar-grupo-titulo">En curso</div>
          {obrasEnCurso.map((proyecto) => (
            <NavLink key={proyecto.id} to={`/proyectos/${proyecto.id}`} className="sidebar-obra">
              <span
                className={
                  proyecto.disponible >= 0
                    ? "sidebar-obra-punto sidebar-obra-punto--ok"
                    : "sidebar-obra-punto sidebar-obra-punto--alerta"
                }
              />
              {proyecto.nombre}
            </NavLink>
          ))}
        </>
      )}
    </>
  );
}

export function Sidebar() {
  const { usuario, logout } = useAuth();
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
        {esManager(usuario) ? (
          <>
            <div className="sidebar-grupo-titulo">Gestión de cuentas</div>
            {ITEMS_NAV_MANAGER.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? "sidebar-link sidebar-link-active" : "sidebar-link"
                }
              >
                <item.icono size={16} strokeWidth={2} className="sidebar-link-icono" />
                {item.label}
              </NavLink>
            ))}
          </>
        ) : (
          <NavEquipo />
        )}
      </nav>

      <div className="sidebar-footer">
        <span className="sidebar-avatar">{iniciales(usuario?.nombre_usuario)}</span>
        <span className="sidebar-user">
          <span className="sidebar-user-name">{usuario?.nombre_usuario}</span>
          <span className="sidebar-user-role">{usuario?.rol}</span>
        </span>
        <button
          className="sidebar-logout"
          onClick={handleLogout}
          title="Cerrar sesión"
          aria-label="Cerrar sesión"
        >
          <LogOut size={15} strokeWidth={2} />
        </button>
      </div>
    </aside>
  );
}
